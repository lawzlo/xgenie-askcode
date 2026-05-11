import * as fs from 'fs/promises'
import * as path from 'path'
import { simpleGit } from 'simple-git'
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

function normalizeRepoUrl(url: string): string {
  const trimmed = url.trim()
  try {
    const parsed = new URL(trimmed)
    const normalizedPath = parsed.pathname
      .replace(/\/+$/, '')
      .replace(/\.git$/i, '')
      .toLowerCase()
    return `${parsed.hostname.toLowerCase()}${normalizedPath}`
  } catch {
    return trimmed
      .replace(/\/+$/, '')
      .replace(/\.git$/i, '')
      .toLowerCase()
  }
}

function repoListHasUrl(repos: { url: string }[] | null | undefined, gitUrl: string | null | undefined): boolean {
  if (!gitUrl) return false
  const normalizedGitUrl = normalizeRepoUrl(gitUrl)
  return (repos || []).some((repo) => normalizeRepoUrl(repo.url) === normalizedGitUrl)
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '')
  }
  return typeof error === 'string' ? error : 'Unknown error'
}

function isMissingSyncErrorColumnError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes('sync_error') &&
    (message.includes('schema cache') || message.includes('does not exist'))
  )
}

export function formatProjectSyncError(error: unknown): string {
  const raw = getErrorMessage(error)
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

function formatRepoSyncError(repoLabel: string, branch: string, error: unknown): string {
  return `${repoLabel} (${branch}): ${formatProjectSyncError(error)}`
}

async function updateProjectRow(
  projectId: string,
  values: Record<string, unknown>,
  options: { teamId?: string; errorPrefix: string }
): Promise<void> {
  let query = supabase.from('projects').update(values).eq('id', projectId)
  if (options.teamId) {
    query = query.eq('team_id', options.teamId)
  }

  let { error } = await query

  if (error && 'sync_error' in values && isMissingSyncErrorColumnError(error)) {
    const fallbackValues = { ...values }
    delete fallbackValues.sync_error
    let fallbackQuery = supabase.from('projects').update(fallbackValues).eq('id', projectId)
    if (options.teamId) {
      fallbackQuery = fallbackQuery.eq('team_id', options.teamId)
    }
    const fallbackResult = await fallbackQuery
    error = fallbackResult.error
  }

  if (error) {
    throw new Error(`${options.errorPrefix}: ${error.message}`)
  }
}

async function getLatestProjectJobErrors(projectIds: string[]): Promise<Map<string, string>> {
  if (projectIds.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('project_jobs')
    .select('project_id, error, updated_at')
    .in('project_id', projectIds)
    .not('error', 'is', null)
    .order('updated_at', { ascending: false })

  if (error) {
    console.warn('Failed to load project job errors:', error.message)
    return new Map()
  }

  const errors = new Map<string, string>()
  for (const row of data || []) {
    const projectId = row.project_id as string | null
    const jobError = row.error as string | null
    if (!projectId || !jobError || errors.has(projectId)) {
      continue
    }
    errors.set(projectId, formatProjectSyncError(jobError))
  }

  return errors
}

type ProjectRow = {
  id: string
  user_id: string
  team_id: string
  name: string
  git_url: string
  branch: string
  workspace_path: string
  last_synced_at: string | null
  created_at: string
  git_provider_id: string | null
  git_urls: { url: string; branch: string; name: string }[] | null
  credentials: { token: string } | null
  sync_status: SyncStatus | null
  sync_error: string | null
}

type ProjectJobPayload = Record<string, unknown> | null

function mergeAddReposPayload(
  existingPayload: ProjectJobPayload,
  nextPayload: Record<string, unknown> | undefined
): Record<string, unknown> {
  const existing = existingPayload && typeof existingPayload === 'object' ? existingPayload : {}
  const next = nextPayload || {}
  const existingRepos = Array.isArray(existing.repos) ? existing.repos as RepoInfo[] : []
  const nextRepos = Array.isArray(next.repos) ? next.repos as RepoInfo[] : []
  const seen = new Set(existingRepos.map((repo) => normalizeRepoUrl(repo.gitUrl)))
  const repos = [...existingRepos]

  for (const repo of nextRepos) {
    const normalized = normalizeRepoUrl(repo.gitUrl)
    if (!seen.has(normalized)) {
      seen.add(normalized)
      repos.push(repo)
    }
  }

  return {
    ...existing,
    ...next,
    repos
  }
}

function mapProjectRow(row: ProjectRow, fallbackSyncError?: string | null): Project {
  return {
    id: row.id,
    userId: row.user_id,
    teamId: row.team_id,
    name: row.name,
    gitUrl: row.git_url,
    branch: row.branch,
    workspacePath: row.workspace_path,
    lastSyncedAt: row.last_synced_at ? new Date(row.last_synced_at) : null,
    createdAt: new Date(row.created_at),
    gitProviderId: row.git_provider_id || undefined,
    gitUrls: row.git_urls || undefined,
    credentials: row.credentials || undefined,
    syncStatus: row.sync_status || 'ready',
    syncError: row.sync_error || fallbackSyncError || null
  }
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
    .select('id, status, payload')
    .eq('project_id', projectId)
    .eq('type', type)
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: true })
    .limit(1)

  if (existingError) {
    throw new Error(`Failed to check existing jobs: ${existingError.message}`)
  }
  const activeJob = existing?.[0] as { id: string; status: ProjectJobStatus; payload: ProjectJobPayload } | undefined
  if (activeJob) {
    if (type === 'add_repos' && activeJob.status === 'queued') {
      const { error } = await supabase
        .from('project_jobs')
        .update({
          payload: mergeAddReposPayload(activeJob.payload, payload),
          error: null,
          run_after: new Date().toISOString()
        })
        .eq('id', activeJob.id)

      if (error) {
        throw new Error(`Failed to update existing project job: ${error.message}`)
      }
    }
    if (type !== 'add_repos' || activeJob.status === 'queued') return
  }

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
  await updateProjectRow(projectId, update, { errorPrefix: 'Failed to update sync status' })
}

async function enqueueProjectJobOrMarkError(
  projectId: string,
  teamId: string,
  type: ProjectJobType,
  payload?: Record<string, unknown>
): Promise<void> {
  try {
    await enqueueProjectJob(projectId, teamId, type, payload)
  } catch (error) {
    try {
      await updateProjectSyncState(projectId, 'error', { syncError: formatProjectSyncError(error) })
    } catch (stateError) {
      console.error('Failed to persist project job enqueue error:', formatProjectSyncError(stateError))
    }
    throw error
  }
}

async function updateStoredProjectBranch(
  project: Project,
  gitUrl: string,
  branch: string
): Promise<void> {
  const normalizedGitUrl = normalizeRepoUrl(gitUrl)
  if (project.gitUrls && project.gitUrls.length > 0) {
    const nextGitUrls = project.gitUrls.map((repo) =>
      normalizeRepoUrl(repo.url) === normalizedGitUrl ? { ...repo, branch } : repo
    )
    const update: { git_urls: typeof nextGitUrls; branch?: string } = {
      git_urls: nextGitUrls
    }
    if (normalizeRepoUrl(project.gitUrl) === normalizedGitUrl) {
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

async function syncRepoAtPath(
  project: Project,
  gitUrl: string,
  branch: string,
  repoPath: string,
  repoLabel: string,
  options: { removeOnFailure?: boolean } = {}
): Promise<void> {
  try {
    await fs.access(repoPath)
  } catch {
    console.log(`Repo ${repoLabel} missing, cloning...`)
    await cloneProjectRepo(project, gitUrl, branch, repoPath, repoLabel)
    return
  }

  const git = simpleGit(repoPath)
  const branchSummary = await git.branchLocal()
  if (branchSummary.current !== branch) {
    if (options.removeOnFailure === false) {
      throw new Error(`Repository branch mismatch: expected ${branch} but found ${branchSummary.current || 'unknown'}`)
    }
    await fs.rm(repoPath, { recursive: true, force: true })
    console.log(`Repo ${repoLabel} is on ${branchSummary.current || 'unknown'}, recloning ${branch}...`)
    await cloneProjectRepo(project, gitUrl, branch, repoPath, repoLabel)
    return
  }

  const { cloneUrl, hasAuth } = await resolveCloneUrl(gitUrl, project.gitProviderId, project.teamId, project.credentials)
  try {
    if (hasAuth && cloneUrl !== gitUrl) {
      await git.remote(['set-url', 'origin', cloneUrl])
    }
    await git.pull('origin', branch)
    console.log(`Pulled ${repoLabel} successfully`)
  } catch (error) {
    throw new Error(formatRepoSyncError(repoLabel, branch, error))
  } finally {
    if (hasAuth && cloneUrl !== gitUrl) {
      try {
        await git.remote(['set-url', 'origin', gitUrl])
      } catch (resetError) {
        console.warn(`Failed to restore unauthenticated origin for ${repoLabel}:`, formatProjectSyncError(resetError))
      }
    }
  }
}

async function cloneProjectRepo(
  project: Project,
  gitUrl: string,
  branch: string,
  targetPath: string,
  repoLabel: string
): Promise<void> {
  try {
    await cloneRepositoryToPath(
      gitUrl,
      branch,
      targetPath,
      project.gitProviderId,
      project.teamId,
      project.credentials,
      repoLabel
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

    console.warn(`Branch ${branch} missing for ${repoLabel}, retrying with ${detectedBranch}`)
    await fs.rm(targetPath, { recursive: true, force: true })
    await cloneRepositoryToPath(
      gitUrl,
      detectedBranch,
      targetPath,
      project.gitProviderId,
      project.teamId,
      project.credentials,
      repoLabel
    )
    await updateStoredProjectBranch(project, gitUrl, detectedBranch)
  }
}

async function cloneProjectWorkspace(project: Project): Promise<void> {
  await fs.mkdir(project.workspacePath, { recursive: true })

  if (project.gitUrls && project.gitUrls.length > 0) {
    if (project.gitUrl && !repoListHasUrl(project.gitUrls, project.gitUrl)) {
      await cloneProjectRepo(project, project.gitUrl, project.branch, project.workspacePath, project.name)
    }
    for (const repo of project.gitUrls) {
      const repoPath = path.join(project.workspacePath, repo.name)
      await cloneProjectRepo(project, repo.url, repo.branch, repoPath, repo.name)
    }
    return
  }

  await cloneProjectRepo(project, project.gitUrl, project.branch, project.workspacePath, project.name)
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
    if (project.gitUrl && !repoListHasUrl(project.gitUrls, project.gitUrl)) {
      await syncRepoAtPath(
        project,
        project.gitUrl,
        project.branch,
        project.workspacePath,
        project.name,
        { removeOnFailure: false }
      )
    }
    for (const repo of project.gitUrls) {
      const repoPath = path.join(project.workspacePath, repo.name)
      await syncRepoAtPath(project, repo.url, repo.branch, repoPath, repo.name)
    }
    return
  }

  await syncRepoAtPath(
    project,
    project.gitUrl,
    project.branch,
    project.workspacePath,
    project.name
  )
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

  await enqueueProjectJobOrMarkError(project.id, teamId, 'clone')

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

  let fallbackSyncError: string | null = null
  if (data.sync_status === 'error' && !data.sync_error) {
    const jobErrors = await getLatestProjectJobErrors([data.id])
    fallbackSyncError = jobErrors.get(data.id) || null
  }

  return mapProjectRow(data as ProjectRow, fallbackSyncError)
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

  const rows = (data || []) as ProjectRow[]
  const fallbackErrors = await getLatestProjectJobErrors(
    rows
      .filter((row) => row.sync_status === 'error' && !row.sync_error)
      .map((row) => row.id)
  )

  const projects = rows.map((row) => mapProjectRow(row, fallbackErrors.get(row.id) || null))

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

  if (project.syncStatus === 'syncing') {
    return project
  }

  if (project.syncStatus === 'pending') {
    await enqueueProjectJobOrMarkError(project.id, teamId, 'sync', credentials ? { credentials } : undefined)
    return project
  }

  if (credentials) {
    project.credentials = credentials
  }

  await updateProjectSyncState(project.id, 'pending')
  project.syncStatus = 'pending'
  project.syncError = null
  await enqueueProjectJobOrMarkError(project.id, teamId, 'sync', credentials ? { credentials } : undefined)

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

  await enqueueProjectJobOrMarkError(project.id, teamId, 'clone')

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
  const existingNormalizedUrls = new Set(existingGitUrls.map((repo) => normalizeRepoUrl(repo.url)))
  if (projectData.git_url) {
    existingNormalizedUrls.add(normalizeRepoUrl(projectData.git_url))
  }

  // Check for duplicates
  const duplicates = repos.filter((repo) => existingNormalizedUrls.has(normalizeRepoUrl(repo.gitUrl)))
  if (duplicates.length > 0) {
    throw new Error(`Repository already exists in project: ${duplicates[0].gitUrl}`)
  }

  const projectCredentials =
    projectData.credentials &&
    typeof projectData.credentials === 'object' &&
    typeof projectData.credentials.token === 'string'
      ? { token: projectData.credentials.token }
      : undefined
  const effectiveCredentials = credentials || projectCredentials
  const providerId = gitProviderId || projectData.git_provider_id || undefined

  // Detect branch if not provided, then let the worker clone in the shared workspace.
  const reposWithBranch: { gitUrl: string; branch: string; name: string }[] = []
  for (const repo of repos) {
    const branch =
      repo.branch ||
      await detectDefaultBranch(
        repo.gitUrl,
        providerId,
        teamId,
        effectiveCredentials
      )
    reposWithBranch.push({ gitUrl: repo.gitUrl, branch, name: repo.name })
  }

  // Update git_urls in database
  const newGitUrls = [
    ...existingGitUrls,
    ...reposWithBranch.map(r => ({ url: r.gitUrl, branch: r.branch, name: r.name }))
  ]

  const updateValues: Record<string, unknown> = {
    git_urls: newGitUrls,
    sync_status: 'pending',
    sync_error: null
  }
  if (credentials?.token && !gitProviderId) {
    updateValues.credentials = { token: credentials.token }
  }

  await updateProjectRow(
    projectId,
    updateValues,
    { teamId, errorPrefix: 'Failed to update project' }
  )

  // Return updated project
  const project = await getProject(projectId, teamId)
  if (!project) {
    throw new Error('Failed to get updated project')
  }

  await enqueueProjectJobOrMarkError(project.id, teamId, 'add_repos', {
    repos: reposWithBranch,
    gitProviderId: providerId,
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
  const normalizedRepoUrl = normalizeRepoUrl(repoUrl)
  if (projectData.git_url && normalizeRepoUrl(projectData.git_url) === normalizedRepoUrl) {
    throw new Error('Primary repository cannot be removed. Delete the project or create a new project without it.')
  }
  const repoToRemove = existingGitUrls.find((repo) => normalizeRepoUrl(repo.url) === normalizedRepoUrl)

  if (!repoToRemove) {
    throw new Error(`Repository not found in project: ${repoUrl}`)
  }

  // Remove repo directory from workspace
  const repoPath = path.join(projectData.workspace_path, repoToRemove.name)
  await fs.rm(repoPath, { recursive: true, force: true })

  // Update git_urls in database
  const newGitUrls = existingGitUrls.filter((repo) => normalizeRepoUrl(repo.url) !== normalizedRepoUrl)

  // Update primary git_url if we removed it
  const updateData: { git_urls: DbRepoInfo[]; git_url?: string | null; branch?: string | null } = { git_urls: newGitUrls }
  if (projectData.git_url && normalizeRepoUrl(projectData.git_url) === normalizedRepoUrl) {
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

export async function updateProjectRepoBranch(
  projectId: string,
  teamId: string,
  repoUrl: string,
  branch: string
): Promise<Project> {
  const project = await getProject(projectId, teamId)
  if (!project) {
    throw new Error(`Project not found: ${projectId}`)
  }

  const nextBranch = branch.trim()
  if (!nextBranch) {
    throw new Error('Branch is required')
  }

  const normalizedRepoUrl = normalizeRepoUrl(repoUrl)

  if (project.gitUrls && project.gitUrls.length > 0) {
    let found = false
    const nextGitUrls = project.gitUrls.map((repo) => {
      if (normalizeRepoUrl(repo.url) !== normalizedRepoUrl) return repo
      found = true
      return { ...repo, branch: nextBranch }
    })

    const isPrimaryRepo = !!project.gitUrl && normalizeRepoUrl(project.gitUrl) === normalizedRepoUrl
    if (isPrimaryRepo) {
      found = true
    }
    if (!found) {
      throw new Error(`Repository not found in project: ${repoUrl}`)
    }

    const update: {
      git_urls: typeof nextGitUrls
      sync_status: SyncStatus
      sync_error: null
      branch?: string
    } = {
      git_urls: nextGitUrls,
      sync_status: 'pending',
      sync_error: null
    }

    if (isPrimaryRepo) {
      update.branch = nextBranch
    }

    await updateProjectRow(projectId, update, {
      teamId,
      errorPrefix: 'Failed to update project repo branch'
    })
  } else {
    if (normalizeRepoUrl(project.gitUrl) !== normalizedRepoUrl) {
      throw new Error(`Repository not found in project: ${repoUrl}`)
    }

    await updateProjectRow(
      projectId,
      {
        branch: nextBranch,
        sync_status: 'pending',
        sync_error: null
      },
      { teamId, errorPrefix: 'Failed to update project repo branch' }
    )
  }

  await enqueueProjectJobOrMarkError(projectId, teamId, 'sync')

  const updatedProject = await getProject(projectId, teamId)
  if (!updatedProject) {
    throw new Error('Failed to get updated project')
  }

  return updatedProject
}

async function cloneRepositoryToPath(
  gitUrl: string,
  branch: string,
  targetPath: string,
  gitProviderId: string | undefined,
  teamId: string,
  credentials?: { token: string },
  repoLabel = gitUrl
): Promise<void> {
  const { cloneUrl, hasAuth } = await resolveCloneUrl(gitUrl, gitProviderId, teamId, credentials)

  console.log(`Cloning ${repoLabel} from ${gitUrl} (branch: ${branch}, auth: ${hasAuth ? 'yes' : 'no'})`)

  try {
    const git = simpleGit()
    await git.clone(cloneUrl, targetPath, ['--branch', branch, '--single-branch'])
    await simpleGit(targetPath).remote(['set-url', 'origin', gitUrl])
    console.log(`Cloned ${repoLabel} successfully`)
  } catch (err) {
    try {
      await fs.rm(targetPath, { recursive: true, force: true })
    } catch {
      // Ignore clone cleanup failures.
    }
    const message = formatRepoSyncError(repoLabel, branch, err)
    console.error(`Failed to clone ${repoLabel}: ${message}`)
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
  const effectiveJobCredentials = jobCredentials || project.credentials

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
          effectiveJobCredentials,
          repo.name
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

  await enqueueProjectJobOrMarkError(data.id, teamId, 'clone')

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
