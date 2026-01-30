import * as fs from 'fs/promises'
import * as path from 'path'
import { simpleGit, SimpleGit } from 'simple-git'
import { supabase } from '../lib/supabase'
import { getGitProvider, getAuthenticatedCloneUrl, haveGithubAppRequirements } from './git-provider'
import type { Project, CreateProjectRequest, CreateMultiRepoProjectRequest, RepoInfo, SyncStatus } from '../types'

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || './workspaces'

/**
 * Auto-detect the correct username for Git authentication based on the URL.
 * Different platforms require different usernames for token-based auth.
 */
function getAuthUsername(gitUrl: string): string {
  try {
    const host = new URL(gitUrl).hostname.toLowerCase()

    // GitLab requires 'oauth2' as username
    if (host.includes('gitlab')) {
      return 'oauth2'
    }

    // Bitbucket Cloud requires 'x-token-auth' as username
    if (host === 'bitbucket.org') {
      return 'x-token-auth'
    }

    // GitHub, Bitbucket Server, Gitea, etc. - 'git' works for all
    return 'git'
  } catch {
    return 'git'
  }
}

export async function initWorkspaceRoot(): Promise<void> {
  await fs.mkdir(WORKSPACE_ROOT, { recursive: true })
}

export async function createProject(
  userId: string,
  teamId: string,
  request: CreateProjectRequest
): Promise<Project> {
  const workspacePath = path.join(WORKSPACE_ROOT, `${teamId}_${Date.now()}`)

  // Insert into database first to get the ID
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      team_id: teamId,
      name: request.name,
      git_url: request.gitUrl,
      branch: request.branch || 'main',
      workspace_path: workspacePath,
      git_provider_id: request.gitProviderId || null,
      credentials: request.credentials ? { token: request.credentials.token } : null
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Project with name "${request.name}" already exists`)
    }
    throw new Error(`Failed to create project: ${error.message}`)
  }

  const project: Project = {
    id: data.id,
    userId: data.user_id,
    teamId: data.team_id,
    name: data.name,
    gitUrl: data.git_url,
    branch: data.branch,
    workspacePath: data.workspace_path,
    lastSyncedAt: null,
    createdAt: new Date(data.created_at),
    gitProviderId: data.git_provider_id,
    credentials: request.credentials,
    syncStatus: 'syncing'
  }

  try {
    // Clone the repository
    await cloneRepository(project)

    // Update last_synced_at and sync_status
    await supabase
      .from('projects')
      .update({ last_synced_at: new Date().toISOString(), sync_status: 'ready' })
      .eq('id', data.id)

    project.lastSyncedAt = new Date()
    project.syncStatus = 'ready'
  } catch (cloneError) {
    // Clean up if clone fails
    await supabase.from('projects').delete().eq('id', data.id)
    await fs.rm(workspacePath, { recursive: true, force: true })
    throw cloneError
  }

  return project
}

export async function getProject(id: string, teamId?: string): Promise<Project | undefined> {
  let query = supabase.from('projects').select().eq('id', id)

  if (teamId) {
    query = query.eq('team_id', teamId)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return undefined
  }

  return {
    id: data.id,
    userId: data.user_id,
    teamId: data.team_id,
    name: data.name,
    gitUrl: data.git_url,
    branch: data.branch,
    workspacePath: data.workspace_path,
    lastSyncedAt: data.last_synced_at ? new Date(data.last_synced_at) : null,
    createdAt: new Date(data.created_at),
    gitProviderId: data.git_provider_id,
    gitUrls: data.git_urls || null,
    credentials: data.credentials || undefined,
    syncStatus: (data.sync_status as SyncStatus) || 'ready'
  }
}

export async function listProjects(teamId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select()
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to list projects: ${error.message}`)
  }

  const projects = (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    teamId: row.team_id,
    name: row.name,
    gitUrl: row.git_url,
    branch: row.branch,
    workspacePath: row.workspace_path,
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at) : null,
    createdAt: new Date(row.created_at),
    gitUrls: row.git_urls || null,
    gitProviderId: row.git_provider_id || undefined,
    credentials: row.credentials || undefined,
    syncStatus: (row.sync_status as SyncStatus) || 'ready'
  }))

  // Check which projects need sync (workspace doesn't exist)
  // and trigger background sync for them
  for (const project of projects) {
    if (project.syncStatus === 'ready') {
      try {
        await fs.access(project.workspacePath)
      } catch {
        // Workspace missing, mark as pending and trigger sync
        project.syncStatus = 'pending'
        void triggerBackgroundSync(project)
      }
    }
  }

  return projects
}

// Trigger background sync without blocking
async function triggerBackgroundSync(project: Project): Promise<void> {
  // Update status to syncing
  await supabase
    .from('projects')
    .update({ sync_status: 'syncing' })
    .eq('id', project.id)

  console.log(`Starting background sync for project ${project.name}...`)

  try {
    if (project.gitUrls && project.gitUrls.length > 0) {
      // Multi-repo project
      await fs.mkdir(project.workspacePath, { recursive: true })
      for (const repo of project.gitUrls) {
        const repoPath = path.join(project.workspacePath, repo.name)
        await cloneRepositoryToPath(
          repo.url,
          repo.branch,
          repoPath,
          project.gitProviderId,
          project.teamId
        )
      }
    } else {
      // Single repo project - need to get credentials
      await fs.mkdir(project.workspacePath, { recursive: true })
      const git = simpleGit()

      let cloneUrl = project.gitUrl

      // Try git provider authentication first
      if (project.gitProviderId) {
        try {
          const provider = await getGitProvider(project.gitProviderId, project.teamId)
          if (provider) {
            const hasAuth = provider.access_token || haveGithubAppRequirements(provider)
            if (hasAuth) {
              cloneUrl = await getAuthenticatedCloneUrl(provider, project.gitUrl)
            }
          }
        } catch (err) {
          console.warn('Failed to get git provider for background sync:', err)
        }
      }

      // Fall back to stored credentials (manual add with token)
      if (cloneUrl === project.gitUrl && project.credentials?.token) {
        const url = new URL(project.gitUrl)
        url.username = getAuthUsername(project.gitUrl)
        url.password = project.credentials.token
        cloneUrl = url.toString()
      }

      await git.clone(cloneUrl, project.workspacePath, ['--branch', project.branch, '--single-branch'])
    }

    // Update status to ready
    await supabase
      .from('projects')
      .update({ last_synced_at: new Date().toISOString(), sync_status: 'ready' })
      .eq('id', project.id)

    console.log(`Background sync completed for project ${project.name}`)
  } catch (err) {
    console.error(`Background sync failed for project ${project.name}:`, err)
    await supabase
      .from('projects')
      .update({ sync_status: 'error' })
      .eq('id', project.id)
  }
}

export async function syncProject(
  id: string,
  teamId: string,
  credentials?: { username: string; token: string }
): Promise<Project> {
  const project = await getProject(id, teamId)
  if (!project) {
    throw new Error(`Project not found: ${id}`)
  }

  // Add credentials for pulling if provided
  if (credentials) {
    project.credentials = credentials
  }

  if (project.gitUrls && project.gitUrls.length > 0) {
    // Multi-repo project: pull each repo
    for (const repo of project.gitUrls) {
      const repoPath = path.join(project.workspacePath, repo.name)
      try {
        await fs.access(repoPath)
        const git = simpleGit(repoPath)
        await git.pull()
        console.log(`Pulled ${repo.name} successfully`)
      } catch {
        // Repo doesn't exist, clone it
        console.log(`Repo ${repo.name} missing, cloning...`)
        await cloneRepositoryToPath(
          repo.url,
          repo.branch,
          repoPath,
          project.gitProviderId,
          project.teamId
        )
      }
    }
  } else {
    // Single repo project
    const git = createGitClient(project)
    await git.pull()
  }

  const { error } = await supabase
    .from('projects')
    .update({ last_synced_at: new Date().toISOString(), sync_status: 'ready' })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to update sync time: ${error.message}`)
  }

  project.lastSyncedAt = new Date()
  project.syncStatus = 'ready'
  return project
}

export async function deleteProject(id: string, teamId: string): Promise<void> {
  const project = await getProject(id, teamId)
  if (!project) {
    throw new Error(`Project not found: ${id}`)
  }

  // Delete from database (cascades to conversations)
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('team_id', teamId)

  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`)
  }

  // Remove workspace directory
  await fs.rm(project.workspacePath, { recursive: true, force: true })
}

async function cloneRepository(project: Project): Promise<void> {
  await fs.mkdir(project.workspacePath, { recursive: true })

  let cloneUrl = project.gitUrl

  // Try git provider authentication first
  if (project.gitProviderId) {
    try {
      const provider = await getGitProvider(project.gitProviderId, project.teamId)
      if (provider) {
        // Check for GitHub App or OAuth token
        const hasAuth = provider.access_token || haveGithubAppRequirements(provider)
        if (hasAuth) {
          cloneUrl = await getAuthenticatedCloneUrl(provider, project.gitUrl)
        }
      }
    } catch (err) {
      console.warn('Failed to get git provider, falling back to manual credentials:', err)
    }
  }

  // Fall back to manual credentials if provided
  if (cloneUrl === project.gitUrl && project.credentials?.token) {
    const url = new URL(project.gitUrl)
    url.username = getAuthUsername(project.gitUrl)
    url.password = project.credentials.token
    cloneUrl = url.toString()
  }

  const git = simpleGit()
  await git.clone(cloneUrl, project.workspacePath, ['--branch', project.branch, '--single-branch'])
}

function createGitClient(project: Project): SimpleGit {
  return simpleGit(project.workspacePath)
}

// Create a project with multiple repos
export async function createMultiRepoProject(
  userId: string,
  teamId: string,
  request: CreateMultiRepoProjectRequest
): Promise<Project> {
  const workspacePath = path.join(WORKSPACE_ROOT, `${teamId}_${Date.now()}`)

  // Store git_urls as JSON array with branch info
  const gitUrls = request.repos.map(r => ({
    url: r.gitUrl,
    branch: r.branch,
    name: r.name
  }))

  // Insert into database
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      team_id: teamId,
      name: request.name,
      git_url: request.repos[0]?.gitUrl || '',  // Primary URL for compatibility
      branch: request.repos[0]?.branch || 'main',
      git_urls: gitUrls,  // Store all repos
      workspace_path: workspacePath,
      git_provider_id: request.gitProviderId || null
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Project with name "${request.name}" already exists`)
    }
    throw new Error(`Failed to create project: ${error.message}`)
  }

  const project: Project = {
    id: data.id,
    userId: data.user_id,
    teamId: data.team_id,
    name: data.name,
    gitUrl: data.git_url,
    branch: data.branch,
    workspacePath: data.workspace_path,
    lastSyncedAt: null,
    createdAt: new Date(data.created_at),
    gitProviderId: data.git_provider_id,
    syncStatus: 'syncing'
  }

  try {
    // Create workspace directory
    await fs.mkdir(workspacePath, { recursive: true })

    // Clone all repositories
    for (const repo of request.repos) {
      const repoPath = path.join(workspacePath, repo.name)
      await cloneRepositoryToPath(
        repo.gitUrl,
        repo.branch,
        repoPath,
        request.gitProviderId,
        teamId
      )
    }

    // Update last_synced_at and sync_status
    await supabase
      .from('projects')
      .update({ last_synced_at: new Date().toISOString(), sync_status: 'ready' })
      .eq('id', data.id)

    project.lastSyncedAt = new Date()
    project.syncStatus = 'ready'
  } catch (cloneError) {
    // Clean up if clone fails
    await supabase.from('projects').delete().eq('id', data.id)
    await fs.rm(workspacePath, { recursive: true, force: true })
    throw cloneError
  }

  return project
}

// Add repos to an existing project
export async function addReposToProject(
  projectId: string,
  teamId: string,
  repos: RepoInfo[],
  gitProviderId?: string
): Promise<Project> {
  // Get existing project
  const { data: projectData, error: fetchError } = await supabase
    .from('projects')
    .select()
    .eq('id', projectId)
    .eq('team_id', teamId)
    .single()

  if (fetchError || !projectData) {
    throw new Error(`Project not found: ${projectId}`)
  }

  // Database stores { url, branch, name } format
  const existingGitUrls: { url: string; branch: string; name: string }[] = projectData.git_urls || []

  // Check for duplicates
  const existingUrls = new Set(existingGitUrls.map(r => r.url))
  const duplicates = repos.filter(r => existingUrls.has(r.gitUrl))
  if (duplicates.length > 0) {
    throw new Error(`Repository already exists in project: ${duplicates[0].gitUrl}`)
  }

  // Clone new repos to workspace
  const workspacePath = projectData.workspace_path
  for (const repo of repos) {
    const repoPath = path.join(workspacePath, repo.name)
    await cloneRepositoryToPath(
      repo.gitUrl,
      repo.branch,
      repoPath,
      gitProviderId || projectData.git_provider_id,
      teamId
    )
  }

  // Update git_urls in database
  const newGitUrls = [
    ...existingGitUrls,
    ...repos.map(r => ({ url: r.gitUrl, branch: r.branch, name: r.name }))
  ]

  const { error: updateError } = await supabase
    .from('projects')
    .update({
      git_urls: newGitUrls,
      last_synced_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .eq('team_id', teamId)

  if (updateError) {
    throw new Error(`Failed to update project: ${updateError.message}`)
  }

  // Return updated project
  const project = await getProject(projectId, teamId)
  if (!project) {
    throw new Error('Failed to get updated project')
  }
  return project
}

// Remove a repo from an existing project
export async function removeRepoFromProject(
  projectId: string,
  teamId: string,
  repoUrl: string
): Promise<Project> {
  // Get existing project
  const { data: projectData, error: fetchError } = await supabase
    .from('projects')
    .select()
    .eq('id', projectId)
    .eq('team_id', teamId)
    .single()

  if (fetchError || !projectData) {
    throw new Error(`Project not found: ${projectId}`)
  }

  // Database stores { url, branch, name } format
  type DbRepoInfo = { url: string; branch: string; name: string }
  const existingGitUrls: DbRepoInfo[] = projectData.git_urls || []
  const repoToRemove = existingGitUrls.find(r => r.url === repoUrl)

  if (!repoToRemove) {
    throw new Error(`Repository not found in project: ${repoUrl}`)
  }

  // Remove repo directory from workspace
  const repoPath = path.join(projectData.workspace_path, repoToRemove.name)
  await fs.rm(repoPath, { recursive: true, force: true })

  // Update git_urls in database
  const newGitUrls = existingGitUrls.filter(r => r.url !== repoUrl)

  // Update primary git_url if we removed it
  const updateData: { git_urls: DbRepoInfo[]; git_url?: string; branch?: string } = { git_urls: newGitUrls }
  if (projectData.git_url === repoUrl && newGitUrls.length > 0) {
    updateData.git_url = newGitUrls[0].url
    updateData.branch = newGitUrls[0].branch
  }

  const { error: updateError } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', projectId)
    .eq('team_id', teamId)

  if (updateError) {
    throw new Error(`Failed to update project: ${updateError.message}`)
  }

  // Return updated project
  const project = await getProject(projectId, teamId)
  if (!project) {
    throw new Error('Failed to get updated project')
  }
  return project
}

async function cloneRepositoryToPath(
  gitUrl: string,
  branch: string,
  targetPath: string,
  gitProviderId: string | undefined,
  teamId: string
): Promise<void> {
  let cloneUrl = gitUrl
  let hasAuth = false

  // Try git provider authentication
  if (gitProviderId) {
    try {
      const provider = await getGitProvider(gitProviderId, teamId)
      if (provider) {
        hasAuth = !!(provider.access_token || haveGithubAppRequirements(provider))
        if (hasAuth) {
          cloneUrl = await getAuthenticatedCloneUrl(provider, gitUrl)
        }
      }
    } catch (err) {
      console.warn('Failed to get git provider:', err)
    }
  }

  console.log(`Cloning ${gitUrl} (branch: ${branch}, auth: ${hasAuth ? 'yes' : 'no'})`)

  try {
    const git = simpleGit()
    await git.clone(cloneUrl, targetPath, ['--branch', branch, '--single-branch'])
    console.log(`Cloned ${gitUrl} successfully`)
  } catch (err) {
    console.error(`Failed to clone ${gitUrl}:`, err)
    throw err
  }
}

// Clone repository in background and update project status
async function cloneInBackground(
  projectId: string,
  gitUrl: string,
  branch: string,
  workspacePath: string
): Promise<void> {
  try {
    await fs.mkdir(workspacePath, { recursive: true })
    const git = simpleGit()
    await git.clone(gitUrl, workspacePath, ['--branch', branch, '--single-branch'])

    await supabase
      .from('projects')
      .update({ last_synced_at: new Date().toISOString(), sync_status: 'ready' })
      .eq('id', projectId)
  } catch (err) {
    console.error(`Failed to clone demo project:`, err)
    await supabase
      .from('projects')
      .update({ sync_status: 'error' })
      .eq('id', projectId)
  }
}

// Demo project configuration
const DEMO_PROJECT_NAME = 'AskCode Demo'
const DEMO_GIT_URL = 'https://github.com/lawzlo/xgenie-askcode.git'
const DEMO_BRANCH = 'dev'

// Demo is always available (clones from GitHub)
export async function hasDemoTemplate(): Promise<boolean> {
  return true
}

// Create demo project by cloning from GitHub
export async function createDemoProject(
  userId: string,
  teamId: string
): Promise<Project> {
  // Check if user already has the demo project
  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('team_id', teamId)
    .eq('name', DEMO_PROJECT_NAME)
    .single()

  if (existing) {
    throw new Error('Demo project already exists in this team')
  }

  const workspacePath = path.join(WORKSPACE_ROOT, `${teamId}_${Date.now()}`)

  // Insert into database
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      team_id: teamId,
      name: DEMO_PROJECT_NAME,
      git_url: DEMO_GIT_URL,
      branch: DEMO_BRANCH,
      workspace_path: workspacePath,
      sync_status: 'syncing'
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create demo project: ${error.message}`)
  }

  // Clone in background (don't wait)
  cloneInBackground(data.id, DEMO_GIT_URL, DEMO_BRANCH, workspacePath)

  return {
    id: data.id,
    userId: data.user_id,
    teamId: data.team_id,
    name: data.name,
    gitUrl: data.git_url,
    branch: data.branch,
    workspacePath: data.workspace_path,
    lastSyncedAt: null,
    createdAt: new Date(data.created_at),
    syncStatus: 'syncing'
  }
}
