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

export type ProjectJobType = 'clone' | 'sync' | 'add_repos'
export type ProjectJobStatus = 'queued' | 'running' | 'success' | 'error'
export type ProjectJob = {
  id: string
  project_id: string
  team_id: string
  type: ProjectJobType
  status: ProjectJobStatus
  payload: Record<string, unknown> | null
  attempts: number
  max_attempts: number
}

async function enqueueProjectJob(
  projectId: string,
  teamId: string,
  type: ProjectJobType,
  payload?: Record<string, unknown>
): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from('project_jobs')
    .select('id')
    .eq('project_id', projectId)
    .eq('type', type)
    .in('status', ['queued', 'running'])
    .limit(1)

  if (existingError) {
    console.error('Failed to check existing jobs:', existingError)
  }
  if (existing && existing.length > 0) return

  const { error } = await supabase
    .from('project_jobs')
    .insert({
      project_id: projectId,
      team_id: teamId,
      type,
      status: 'queued',
      payload: payload || null
    })

  if (error) {
    console.error('Failed to enqueue project job:', error)
  }
}

async function updateSyncStatus(
  projectId: string,
  status: SyncStatus,
  lastSyncedAt?: Date | null
): Promise<void> {
  const update: { sync_status: SyncStatus; last_synced_at?: string | null } = {
    sync_status: status
  }
  if (status === 'ready' && lastSyncedAt) {
    update.last_synced_at = lastSyncedAt.toISOString()
  }
  try {
    await supabase.from('projects').update(update).eq('id', projectId)
  } catch (err) {
    console.error('Failed to update sync status:', err)
  }
}

async function cloneProjectWorkspace(project: Project): Promise<void> {
  await fs.mkdir(project.workspacePath, { recursive: true })

  if (project.gitUrls && project.gitUrls.length > 0) {
    for (const repo of project.gitUrls) {
      const repoPath = path.join(project.workspacePath, repo.name)
      await cloneRepositoryToPath(
        repo.url,
        repo.branch,
        repoPath,
        project.gitProviderId,
        project.teamId,
        project.credentials
      )
    }
    return
  }

  await cloneRepository(project)
}

async function syncProjectWorkspace(
  project: Project,
  credentials?: { token: string }
): Promise<void> {
  if (credentials) {
    project.credentials = credentials
  }

  if (project.gitUrls && project.gitUrls.length > 0) {
    await fs.mkdir(project.workspacePath, { recursive: true })
    for (const repo of project.gitUrls) {
      const repoPath = path.join(project.workspacePath, repo.name)
      try {
        await fs.access(repoPath)
        const git = simpleGit(repoPath)
        await git.pull()
        console.log(`Pulled ${repo.name} successfully`)
      } catch {
        console.log(`Repo ${repo.name} missing, cloning...`)
        await cloneRepositoryToPath(
          repo.url,
          repo.branch,
          repoPath,
          project.gitProviderId,
          project.teamId,
          project.credentials
        )
      }
    }
    return
  }

  try {
    await fs.access(project.workspacePath)
    const git = createGitClient(project)
    await git.pull()
  } catch {
    await cloneProjectWorkspace(project)
  }
}

// Detect default branch from git URL using ls-remote
async function detectDefaultBranch(gitUrl: string): Promise<string> {
  try {
    const git = simpleGit()
    const result = await git.listRemote(['--symref', gitUrl, 'HEAD'])
    // Parse output like: "ref: refs/heads/main	HEAD"
    const match = result.match(/ref: refs\/heads\/(\S+)\s+HEAD/)
    if (match) {
      return match[1]
    }
  } catch (err) {
    console.warn('Failed to detect default branch:', err)
  }
  return 'main' // fallback
}

export async function createProject(
  userId: string,
  teamId: string,
  request: CreateProjectRequest
): Promise<Project> {
  const workspacePath = path.join(WORKSPACE_ROOT, `${teamId}_${Date.now()}`)

  // Auto-detect default branch if not provided
  const branch = request.branch || await detectDefaultBranch(request.gitUrl)

  // Insert into database first to get the ID
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      team_id: teamId,
      name: request.name,
      git_url: request.gitUrl,
      branch,
      workspace_path: workspacePath,
      git_provider_id: request.gitProviderId || null,
      credentials: request.credentials ? { token: request.credentials.token } : null,
      sync_status: 'pending'
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
    syncStatus: 'pending'
  }

  await enqueueProjectJob(project.id, teamId, 'clone')

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

  // Note: Don't check filesystem here - app and worker may be in different containers
  // Trust the database sync_status instead

  return projects
}

export async function syncProject(
  id: string,
  teamId: string,
  credentials?: { token: string }
): Promise<Project> {
  const project = await getProject(id, teamId)
  if (!project) {
    throw new Error(`Project not found: ${id}`)
  }

  if (project.syncStatus === 'syncing' || project.syncStatus === 'pending') {
    return project
  }

  if (credentials) {
    project.credentials = credentials
  }

  await updateSyncStatus(project.id, 'pending')
  project.syncStatus = 'pending'
  await enqueueProjectJob(project.id, teamId, 'sync', credentials ? { credentials } : undefined)

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
  const gitUrls: { url: string; branch: string; name: string }[] = []
  for (const repo of request.repos) {
    const branch = repo.branch || await detectDefaultBranch(repo.gitUrl)
    gitUrls.push({ url: repo.gitUrl, branch, name: repo.name })
  }

  // Insert into database
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      team_id: teamId,
      name: request.name,
      git_url: request.repos[0]?.gitUrl || '',  // Primary URL for compatibility
      branch: gitUrls[0]?.branch || 'main',
      git_urls: gitUrls,  // Store all repos
      workspace_path: workspacePath,
      git_provider_id: request.gitProviderId || null,
      sync_status: 'pending'
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
    gitUrls,
    syncStatus: 'pending'
  }

  await enqueueProjectJob(project.id, teamId, 'clone')

  return project
}

// Add repos to an existing project
export async function addReposToProject(
  projectId: string,
  teamId: string,
  repos: RepoInfo[],
  gitProviderId?: string,
  credentials?: { token: string }
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

  // Clone new repos to workspace (detect branch if not provided)
  const workspacePath = projectData.workspace_path
  const reposWithBranch: { gitUrl: string; branch: string; name: string }[] = []
  for (const repo of repos) {
    const branch = repo.branch || await detectDefaultBranch(repo.gitUrl)
    reposWithBranch.push({ gitUrl: repo.gitUrl, branch, name: repo.name })
    const repoPath = path.join(workspacePath, repo.name)
    await cloneRepositoryToPath(
      repo.gitUrl,
      branch,
      repoPath,
      gitProviderId || projectData.git_provider_id,
      teamId,
      credentials
    )
  }

  // Update git_urls in database
  const newGitUrls = [
    ...existingGitUrls,
    ...reposWithBranch.map(r => ({ url: r.gitUrl, branch: r.branch, name: r.name }))
  ]

  const { error: updateError } = await supabase
    .from('projects')
    .update({
      git_urls: newGitUrls,
      sync_status: 'pending'
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

  await enqueueProjectJob(project.id, teamId, 'add_repos', {
    repos: reposWithBranch,
    gitProviderId: gitProviderId || project.gitProviderId,
    credentials: credentials ? { token: credentials.token } : undefined
  })

  project.syncStatus = 'pending'
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
  teamId: string,
  credentials?: { token: string }
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

  // Fall back to manual credentials if provided
  if (!hasAuth && credentials?.token) {
    const url = new URL(gitUrl)
    url.username = getAuthUsername(gitUrl)
    url.password = credentials.token
    cloneUrl = url.toString()
    hasAuth = true
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

export async function processProjectJob(job: ProjectJob): Promise<void> {
  const project = await getProject(job.project_id, job.team_id)
  if (!project) {
    throw new Error('Project not found')
  }

  const payload = job.payload && typeof job.payload === 'object' ? job.payload : {}
  const credentials = (payload as { credentials?: { token?: string } }).credentials
  const jobCredentials = credentials?.token ? { token: credentials.token } : undefined

  await updateSyncStatus(project.id, 'syncing')

  try {
    switch (job.type) {
      case 'clone':
        await cloneProjectWorkspace(project)
        break
      case 'sync':
        await syncProjectWorkspace(project, jobCredentials)
        break
      case 'add_repos': {
        const repos = (payload as { repos?: RepoInfo[] }).repos || []
        const providerId = (payload as { gitProviderId?: string }).gitProviderId
        if (!Array.isArray(repos) || repos.length === 0) {
          throw new Error('Job payload missing repos')
        }
        await fs.mkdir(project.workspacePath, { recursive: true })
        for (const repo of repos) {
          const repoPath = path.join(project.workspacePath, repo.name)
          await cloneRepositoryToPath(
            repo.gitUrl,
            repo.branch || 'main',
            repoPath,
            providerId || project.gitProviderId,
            project.teamId,
            jobCredentials
          )
        }
        break
      }
      default:
        throw new Error(`Unknown job type: ${job.type}`)
    }

    await updateSyncStatus(project.id, 'ready', new Date())
  } catch (err) {
    await updateSyncStatus(project.id, 'error')
    throw err
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
      sync_status: 'pending'
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create demo project: ${error.message}`)
  }

  await enqueueProjectJob(data.id, teamId, 'clone')

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
    syncStatus: 'pending'
  }
}
