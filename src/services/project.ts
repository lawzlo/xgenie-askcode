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

function redactUrlCredentials(value: string): string {
  return value.replace(/(https?:\/\/)([^@\s/]+)@/gi, (_match, protocol: string, auth: string) => {
    const username = auth.split(':')[0] || 'git'
    return `${protocol}${username}:***@`
  })
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function formatProjectSyncError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : 'Unknown error'
  const sanitized = redactUrlCredentials(raw)
  const lines = sanitized
    .split('\n')
    .map(collapseWhitespace)
    .filter(Boolean)

  const importantLines = lines.filter((line) =>
    /(fatal:|warning:|remote:|unable to access|authentication failed|not found|failed to connect|couldn't connect)/i.test(line)
  )

  const message = collapseWhitespace((importantLines.length > 0 ? importantLines : lines).join(' '))
  return message.slice(0, 500) || 'Unknown error'
}

async function resolveCloneUrl(
  gitUrl: string,
  gitProviderId: string | undefined,
  teamId: string | undefined,
  credentials?: { token: string }
): Promise<{ cloneUrl: string; hasAuth: boolean }> {
  let cloneUrl = gitUrl
  let hasAuth = false

  if (gitProviderId && teamId) {
    try {
      const provider = await getGitProvider(gitProviderId, teamId)
      if (provider) {
        hasAuth = !!(provider.access_token || haveGithubAppRequirements(provider))
        if (hasAuth) {
          cloneUrl = await getAuthenticatedCloneUrl(provider, gitUrl)
        }
      }
    } catch (err) {
      console.warn('Failed to get git provider, falling back to manual credentials:', formatProjectSyncError(err))
    }
  }

  if (!hasAuth && credentials?.token) {
    const url = new URL(gitUrl)
    url.username = getAuthUsername(gitUrl)
    url.password = credentials.token
    cloneUrl = url.toString()
    hasAuth = true
  }

  return { cloneUrl, hasAuth }
}

async function tryDetectDefaultBranch(
  gitUrl: string,
  gitProviderId?: string,
  teamId?: string,
  credentials?: { token: string }
): Promise<string | null> {
  try {
    const { cloneUrl } = await resolveCloneUrl(gitUrl, gitProviderId, teamId, credentials)
    const git = simpleGit()
    const result = await git.listRemote(['--symref', cloneUrl, 'HEAD'])
    const match = result.match(/ref: refs\/heads\/(\S+)\s+HEAD/)
    if (match) {
      return match[1]
    }
  } catch (err) {
    console.warn('Failed to detect default branch:', formatProjectSyncError(err))
  }

  return null
}

function isMissingRemoteBranchError(error: unknown): boolean {
  const message = formatProjectSyncError(error).toLowerCase()
  return (
    message.includes('could not find remote branch') ||
    (message.includes('remote branch') && message.includes('not found')) ||
    message.includes('couldn\'t find remote ref') ||
    message.includes('remote ref does not exist')
  )
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
    throw new Error(`Failed to check existing jobs: ${existingError.message}`)
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
    throw new Error(`Failed to enqueue project job: ${error.message}`)
  }
}

export async function updateProjectSyncState(
  projectId: string,
  status: SyncStatus,
  options: { lastSyncedAt?: Date | null; syncError?: string | null } = {}
): Promise<void> {
  const update: { sync_status: SyncStatus; last_synced_at?: string | null; sync_error?: string | null } = {
    sync_status: status
  }
  if (status === 'ready' && options.lastSyncedAt) {
    update.last_synced_at = options.lastSyncedAt.toISOString()
  }
  if (status === 'error') {
    update.sync_error = options.syncError ? formatProjectSyncError(options.syncError) : 'Sync failed'
  } else {
    update.sync_error = null
  }
  const { error } = await supabase.from('projects').update(update).eq('id', projectId)
  if (error) {
    throw new Error(`Failed to update sync status: ${error.message}`)
  }
}

async function updateStoredProjectBranch(
  project: Project,
  gitUrl: string,
  branch: string
): Promise<void> {
  if (project.gitUrls && project.gitUrls.length > 0) {
    const nextGitUrls = project.gitUrls.map((repo) =>
      repo.url === gitUrl ? { ...repo, branch } : repo
    )
    const update: { git_urls: typeof nextGitUrls; branch?: string } = {
      git_urls: nextGitUrls
    }
    if (project.gitUrl === gitUrl) {
      update.branch = branch
      project.branch = branch
    }
    const { error } = await supabase.from('projects').update(update).eq('id', project.id)
    if (error) {
      throw new Error(`Failed to update project branch: ${error.message}`)
    }
    project.gitUrls = nextGitUrls
    return
  }

  const { error } = await supabase
    .from('projects')
    .update({ branch })
    .eq('id', project.id)

  if (error) {
    throw new Error(`Failed to update project branch: ${error.message}`)
  }

  project.branch = branch
}

async function cloneProjectRepo(
  project: Project,
  gitUrl: string,
  branch: string,
  targetPath: string
): Promise<void> {
  try {
    await cloneRepositoryToPath(
      gitUrl,
      branch,
      targetPath,
      project.gitProviderId,
      project.teamId,
      project.credentials
    )
  } catch (error) {
    if (!isMissingRemoteBranchError(error)) {
      throw error
    }

    const detectedBranch = await tryDetectDefaultBranch(
      gitUrl,
      project.gitProviderId,
      project.teamId,
      project.credentials
    )

    if (!detectedBranch || detectedBranch === branch) {
      throw error
    }

    console.warn(`Branch ${branch} missing for ${gitUrl}, retrying with ${detectedBranch}`)
    await fs.rm(targetPath, { recursive: true, force: true })
    await cloneRepositoryToPath(
      gitUrl,
      detectedBranch,
      targetPath,
      project.gitProviderId,
      project.teamId,
      project.credentials
    )
    await updateStoredProjectBranch(project, gitUrl, detectedBranch)
  }
}

async function cloneProjectWorkspace(project: Project): Promise<void> {
  await fs.mkdir(project.workspacePath, { recursive: true })

  if (project.gitUrls && project.gitUrls.length > 0) {
    for (const repo of project.gitUrls) {
      const repoPath = path.join(project.workspacePath, repo.name)
      await cloneProjectRepo(project, repo.url, repo.branch, repoPath)
    }
    return
  }

  await cloneProjectRepo(project, project.gitUrl, project.branch, project.workspacePath)
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
        // Remove existing directory if it exists (may be corrupted/partial clone)
        try {
          await fs.rm(repoPath, { recursive: true, force: true })
        } catch {
          // Ignore if directory doesn't exist
        }
        console.log(`Repo ${repo.name} missing or corrupted, cloning...`)
        await cloneProjectRepo(project, repo.url, repo.branch, repoPath)
      }
    }
    return
  }

  try {
    await fs.access(project.workspacePath)
    const git = createGitClient(project)
    await git.pull()
  } catch {
    // Remove existing directory if it exists (may be corrupted/partial clone)
    try {
      await fs.rm(project.workspacePath, { recursive: true, force: true })
    } catch {
      // Ignore if directory doesn't exist
    }
    await cloneProjectWorkspace(project)
  }
}

async function detectDefaultBranch(
  gitUrl: string,
  gitProviderId?: string,
  teamId?: string,
  credentials?: { token: string }
): Promise<string> {
  return await tryDetectDefaultBranch(gitUrl, gitProviderId, teamId, credentials) || 'main'
}

export async function createProject(
  userId: string,
  teamId: string,
  request: CreateProjectRequest
): Promise<Project> {
  const workspacePath = path.join(WORKSPACE_ROOT, `${teamId}_${Date.now()}`)

  // Auto-detect default branch if not provided
  const branch =
    request.branch ||
    await detectDefaultBranch(request.gitUrl, request.gitProviderId, teamId, request.credentials)

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
    syncStatus: 'pending',
    syncError: null
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
    syncStatus: (data.sync_status as SyncStatus) || 'ready',
    syncError: data.sync_error || null
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
    syncStatus: (row.sync_status as SyncStatus) || 'ready',
    syncError: row.sync_error || null
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

  await updateProjectSyncState(project.id, 'pending')
  project.syncStatus = 'pending'
  project.syncError = null
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
    const branch =
      repo.branch ||
      await detectDefaultBranch(repo.gitUrl, request.gitProviderId, teamId)
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
    syncStatus: 'pending',
    syncError: null
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
    const branch =
      repo.branch ||
      await detectDefaultBranch(
        repo.gitUrl,
        gitProviderId || projectData.git_provider_id || undefined,
        teamId,
        credentials
      )
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
      sync_status: 'pending',
      sync_error: null
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
  project.syncError = null
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
  const updateData: { git_urls: DbRepoInfo[]; git_url?: string | null; branch?: string | null } = { git_urls: newGitUrls }
  if (projectData.git_url === repoUrl) {
    if (newGitUrls.length > 0) {
      updateData.git_url = newGitUrls[0].url
      updateData.branch = newGitUrls[0].branch
    } else {
      updateData.git_url = null
      updateData.branch = null
    }
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
  const { cloneUrl, hasAuth } = await resolveCloneUrl(gitUrl, gitProviderId, teamId, credentials)

  console.log(`Cloning ${gitUrl} (branch: ${branch}, auth: ${hasAuth ? 'yes' : 'no'})`)

  try {
    const git = simpleGit()
    await git.clone(cloneUrl, targetPath, ['--branch', branch, '--single-branch'])
    console.log(`Cloned ${gitUrl} successfully`)
  } catch (err) {
    const message = formatProjectSyncError(err)
    console.error(`Failed to clone ${gitUrl}: ${message}`)
    throw new Error(message)
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

  await updateProjectSyncState(project.id, 'syncing')

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
        try {
          await fs.access(repoPath)
          console.log(`Repo ${repo.name} already exists, skipping clone`)
          continue
        } catch {
          // Directory doesn't exist, proceed with clone
        }
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

  await updateProjectSyncState(project.id, 'ready', { lastSyncedAt: new Date() })
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
    syncStatus: 'pending',
    syncError: null
  }
}
