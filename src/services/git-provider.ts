import { supabase } from '../lib/supabase'
import { Octokit } from 'octokit'
import { createAppAuth } from '@octokit/auth-app'

export const DEFAULT_GITEA_URL = 'https://gitea.com'

export type GitProviderType = 'github' | 'gitea' | 'gitlab' | 'bitbucket'

export interface GitProvider {
  id: string
  user_id: string
  team_id: string
  provider: GitProviderType
  name: string
  api_url: string | null
  client_id: string | null
  client_secret: string | null
  redirect_uri: string | null
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  account_id: string | null
  account_name: string | null
  created_at: string
  // GitHub App specific fields
  github_app_id: number | null
  github_app_name: string | null
  github_installation_id: string | null
  github_private_key: string | null
  github_webhook_secret: string | null
}

export interface Repository {
  id: string | number
  name: string
  full_name: string
  clone_url: string
  default_branch: string
  private: boolean
  owner: {
    login: string
  }
}

type ProviderRepo = {
  id: string | number
  name: string
  full_name: string
  clone_url: string
  default_branch?: string
  private?: boolean
  owner?: { login?: string; username?: string }
}

type GithubBranch = { name: string }

// Check if a provider is properly authenticated
export function isProviderAuthenticated(provider: GitProvider): boolean {
  switch (provider.provider) {
    case 'github':
      return haveGithubAppRequirements(provider)
    case 'gitea':
    case 'gitlab':
    case 'bitbucket':
      return !!provider.access_token
    default:
      return false
  }
}

// Get authentication username for git clone URL
export function getAuthUsername(provider: GitProvider): string {
  switch (provider.provider) {
    case 'github':
      return 'x-access-token'
    case 'bitbucket':
      return 'x-token-auth'
    case 'gitea':
      return provider.account_name || 'oauth2'
    case 'gitlab':
      return 'oauth2'
    default:
      return 'oauth2'
  }
}

// Get authentication token for a provider
export async function getProviderToken(provider: GitProvider): Promise<string | null> {
  switch (provider.provider) {
    case 'github':
      if (!haveGithubAppRequirements(provider)) return null
      return getGithubAppToken(provider)
    case 'gitea':
      return refreshGiteaToken(provider)
    case 'gitlab':
    case 'bitbucket':
      return provider.access_token
    default:
      return null
  }
}

// Get all git providers for a team
export async function getGitProviders(teamId: string): Promise<GitProvider[]> {
  const { data, error } = await supabase
    .from('git_providers')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Get a single git provider
export async function getGitProvider(id: string, teamId: string): Promise<GitProvider | null> {
  const { data, error } = await supabase
    .from('git_providers')
    .select('*')
    .eq('id', id)
    .eq('team_id', teamId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

// Get git provider by ID only (for OAuth callbacks where user is not authenticated)
// Security: The provider ID (used as OAuth state) is a UUID, which is unpredictable
export async function getGitProviderById(id: string): Promise<GitProvider | null> {
  const { data, error } = await supabase
    .from('git_providers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

// Create a git provider (before OAuth)
export async function createGitProvider(
  userId: string,
  teamId: string,
  provider: GitProviderType,
  name: string,
  options: {
    api_url?: string
    client_id?: string
    client_secret?: string
    redirect_uri?: string
  } = {}
): Promise<GitProvider> {
  const { data, error } = await supabase
    .from('git_providers')
    .insert({
      user_id: userId,
      team_id: teamId,
      provider,
      name,
      api_url: options.api_url || null,
      client_id: options.client_id || null,
      client_secret: options.client_secret || null,
      redirect_uri: options.redirect_uri || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Create GitHub App provider
export async function createGitHubAppProvider(
  userId: string,
  teamId: string,
  name: string,
  options: {
    github_app_id: number
    github_app_name: string
    github_installation_id: string
    github_private_key: string
    github_client_id?: string
    github_client_secret?: string
    github_webhook_secret?: string
  }
): Promise<GitProvider> {
  const { data, error } = await supabase
    .from('git_providers')
    .insert({
      user_id: userId,
      team_id: teamId,
      provider: 'github',
      name,
      github_app_id: options.github_app_id,
      github_app_name: options.github_app_name,
      github_installation_id: options.github_installation_id,
      github_private_key: options.github_private_key,
      client_id: options.github_client_id || null,
      client_secret: options.github_client_secret || null,
      github_webhook_secret: options.github_webhook_secret || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Update GitHub App installation ID
export async function updateGitHubAppInstallation(
  id: string,
  installationId: string,
  accountName?: string
): Promise<GitProvider> {
  const { data, error } = await supabase
    .from('git_providers')
    .update({
      github_installation_id: installationId,
      account_name: accountName || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Update git provider with OAuth tokens
export async function updateGitProviderTokens(
  id: string,
  tokens: {
    access_token: string
    refresh_token?: string
    expires_in?: number
    account_id?: string
    account_name?: string
  }
): Promise<GitProvider> {
  const updateData: {
    access_token: string
    refresh_token?: string
    token_expires_at?: string
    account_id?: string
    account_name?: string
  } = {
    access_token: tokens.access_token,
  }

  if (tokens.refresh_token) {
    updateData.refresh_token = tokens.refresh_token
  }

  if (tokens.expires_in) {
    updateData.token_expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  }

  if (tokens.account_id) {
    updateData.account_id = tokens.account_id
  }

  if (tokens.account_name) {
    updateData.account_name = tokens.account_name
  }

  const { data, error } = await supabase
    .from('git_providers')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Delete a git provider
export async function deleteGitProvider(id: string, teamId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('git_provider_id', id)

  if (countError) throw countError
  if ((count || 0) > 0) {
    throw new Error(`Provider is used by ${count} project${count === 1 ? '' : 's'}. Reassign or delete those projects first.`)
  }

  const { error } = await supabase
    .from('git_providers')
    .delete()
    .eq('id', id)
    .eq('team_id', teamId)

  if (error) throw error
}

// Refresh token if expired (for Gitea)
export async function refreshGiteaToken(provider: GitProvider): Promise<string | null> {
  if (!provider.client_id || !provider.client_secret || !provider.refresh_token) {
    return provider.access_token
  }

  // Check if token is still valid (5 min buffer)
  if (provider.token_expires_at) {
    const expiresAt = new Date(provider.token_expires_at).getTime()
    const now = Date.now()
    if (expiresAt > now + 5 * 60 * 1000) {
      return provider.access_token
    }
  }

  // Token expired, refresh it
  const baseUrl = provider.api_url || DEFAULT_GITEA_URL
  const response = await fetch(`${baseUrl}/login/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: provider.refresh_token,
      client_id: provider.client_id,
      client_secret: provider.client_secret,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.error(`Failed to refresh Gitea token for provider ${provider.id}: ${response.status} ${response.statusText} ${body}`)
    return provider.access_token
  }

  const data = await response.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  if (!data.access_token) {
    return provider.access_token
  }

  // Update tokens in database
  await updateGitProviderTokens(provider.id, {
    access_token: data.access_token,
    refresh_token: data.refresh_token || provider.refresh_token || undefined,
    expires_in: data.expires_in,
  })

  return data.access_token
}

// Get repositories from Gitea
export async function getGiteaRepositories(provider: GitProvider): Promise<Repository[]> {
  const token = await refreshGiteaToken(provider)
  if (!token) {
    throw new Error('No access token available')
  }

  const baseUrl = (provider.api_url || DEFAULT_GITEA_URL).replace(/\/+$/, '')
  const repos: Repository[] = []
  let page = 1
  const limit = 50

  while (true) {
    const response = await fetch(`${baseUrl}/api/v1/user/repos?page=${page}&limit=${limit}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `token ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch repositories: ${response.statusText}`)
    }

    const data = await response.json()
    if (!Array.isArray(data) || data.length === 0) break

    const rawRepos = data as ProviderRepo[]
    repos.push(
      ...rawRepos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        clone_url: repo.clone_url,
        default_branch: repo.default_branch || 'main',
        private: !!repo.private,
        owner: { login: repo.owner?.login || repo.owner?.username || '' },
      }))
    )

    if (data.length < limit) break
    page++
  }

  return repos
}

// Check if GitHub App provider has required fields
export function haveGithubAppRequirements(provider: GitProvider): boolean {
  return !!(
    provider.github_app_id &&
    provider.github_private_key &&
    provider.github_installation_id
  )
}

// Create authenticated Octokit client for GitHub App
export function createGithubAppOctokit(provider: GitProvider): Octokit {
  if (!haveGithubAppRequirements(provider)) {
    throw new Error('GitHub App not configured correctly')
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: provider.github_app_id!,
      privateKey: provider.github_private_key!,
      installationId: provider.github_installation_id!,
    },
  })
}

// Get GitHub App installation token
export async function getGithubAppToken(provider: GitProvider): Promise<string> {
  const octokit = createGithubAppOctokit(provider)
  const installation = await octokit.auth({
    type: 'installation',
  }) as { token: string }
  return installation.token
}

// Get repositories from GitHub (using GitHub App)
export async function getGithubRepositories(provider: GitProvider): Promise<Repository[]> {
  if (!haveGithubAppRequirements(provider)) {
    throw new Error('GitHub App not configured. Please set up a GitHub App.')
  }

  const octokit = createGithubAppOctokit(provider)

  // Use paginate to get all repos accessible to the installation
  const repositories = (await octokit.paginate(
    octokit.rest.apps.listReposAccessibleToInstallation,
    { per_page: 100 }
  )) as ProviderRepo[]

  return repositories.map((repo) => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    clone_url: repo.clone_url,
    default_branch: repo.default_branch || 'main',
    private: !!repo.private,
    owner: { login: repo.owner?.login || '' },
  }))
}

// Get repositories from any provider
export async function getRepositories(provider: GitProvider): Promise<Repository[]> {
  switch (provider.provider) {
    case 'gitea':
      return getGiteaRepositories(provider)
    case 'github':
      return getGithubRepositories(provider)
    default:
      throw new Error(`Provider ${provider.provider} not implemented yet`)
  }
}

// Get branches from Gitea
export async function getGiteaBranches(provider: GitProvider, owner: string, repo: string): Promise<string[]> {
  const token = await refreshGiteaToken(provider)
  if (!token) {
    throw new Error('No access token available')
  }

  const baseUrl = (provider.api_url || DEFAULT_GITEA_URL).replace(/\/+$/, '')
  const response = await fetch(`${baseUrl}/api/v1/repos/${owner}/${repo}/branches`, {
    headers: {
      Accept: 'application/json',
      Authorization: `token ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch branches: ${response.statusText}`)
  }

  const data = await response.json() as { name: string }[]
  return data.map((branch) => branch.name)
}

// Get branches from GitHub
export async function getGithubBranches(provider: GitProvider, owner: string, repo: string): Promise<string[]> {
  if (!haveGithubAppRequirements(provider)) {
    throw new Error('GitHub App not configured')
  }

  const octokit = createGithubAppOctokit(provider)
  const branches = await octokit.paginate(
    octokit.rest.repos.listBranches,
    { owner, repo, per_page: 100 }
  )

  const branchList = branches as GithubBranch[]
  return branchList.map((branch) => branch.name)
}

// Get branches from any provider
export async function getBranches(provider: GitProvider, owner: string, repo: string): Promise<string[]> {
  switch (provider.provider) {
    case 'gitea':
      return getGiteaBranches(provider, owner, repo)
    case 'github':
      return getGithubBranches(provider, owner, repo)
    default:
      throw new Error(`Provider ${provider.provider} not implemented yet`)
  }
}

// Build clone URL with OAuth token
export async function getAuthenticatedCloneUrl(provider: GitProvider, repoCloneUrl: string): Promise<string> {
  const token = await getProviderToken(provider)
  if (!token) {
    return repoCloneUrl
  }

  const url = new URL(repoCloneUrl)
  url.username = getAuthUsername(provider)
  url.password = token

  return url.toString()
}
