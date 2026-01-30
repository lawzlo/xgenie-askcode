export type SyncStatus = 'pending' | 'syncing' | 'ready' | 'error'

export interface Project {
  id: string
  userId: string
  teamId: string
  name: string
  gitUrl: string
  branch: string
  workspacePath: string
  lastSyncedAt: Date | null
  createdAt: Date
  gitProviderId?: string
  gitUrls?: { url: string; branch: string; name: string }[]
  credentials?: {
    token: string
  }
  syncStatus: SyncStatus
}

export interface Message {
  id: string
  question: string
  answer: string
  filesRead: string[]
  timestamp: Date
}

export interface Conversation {
  projectId: string
  messages: Message[]
  createdAt: Date
}

export interface AskRequest {
  projectId: string
  question: string
}

export interface AskResponse {
  id?: string
  answer: string
  filesRead: string[]
  conversationLength?: number
  followUpSuggestions?: string[]
}

export interface CreateProjectRequest {
  name: string
  gitUrl: string
  branch?: string
  credentials?: {
    token: string
  }
  gitProviderId?: string
}

export interface RepoInfo {
  gitUrl: string
  branch?: string  // Auto-detect if not provided
  name: string  // repo name for subdirectory
}

export interface CreateMultiRepoProjectRequest {
  name: string
  repos: RepoInfo[]
  gitProviderId?: string
}
