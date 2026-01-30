export type AuthMode = 'login' | 'signup'

export type Session = {
  access_token: string
  refresh_token?: string
  user: {
    id: string
    email: string
  }
}

export type Team = {
  id: string
  name: string
  owner_id: string
}

export type TeamMember = {
  user_id: string
  email: string
  role: 'owner' | 'member'
  access_level: number
}

export type TeamInvite = {
  id: string
  email: string
}

export type GitProvider = {
  id: string
  provider: 'github' | 'gitea' | 'gitlab' | 'bitbucket'
  name: string
  account_name?: string | null
  access_token?: string | null
  github_installation_id?: string | null
}

export type ProviderRepo = {
  id: string | number
  name: string
  full_name: string
  clone_url: string
  default_branch: string
  private: boolean
  owner: { login?: string }
}

export type ProjectRepo = {
  url: string
  branch: string
  name: string
}

export type SyncStatus = 'pending' | 'syncing' | 'ready' | 'error'

export type Project = {
  id: string
  name: string
  gitUrl: string
  branch?: string
  lastSyncedAt?: string | null
  gitUrls?: ProjectRepo[] | null
  syncStatus?: SyncStatus
}

export type Message = {
  id?: string
  question: string
  answer: string
  filesRead: string[]
  timestamp: string
}

export type ToastType = 'info' | 'success' | 'error'

export type Toast = {
  id: string
  message: string
  type: ToastType
  duration: number
}

export type ProviderSelection = Record<
  string,
  { name: string; owner: string; repo: string; branch: string; defaultBranch: string }
>

export type EditRepoSelection = Record<
  string,
  { name: string; branch: string; defaultBranch: string }
>
