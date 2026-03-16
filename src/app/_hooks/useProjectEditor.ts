'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  EditRepoSelection,
  Project,
  ProjectRepo,
  ProviderRepo,
  ProviderSelection,
  SavedCredential,
  Session,
  ToastType
} from '../_types'
import { extractRepoName, normalizeGitUrl } from '../_lib/utils'
import { apiRequest } from '../_lib/api'

function inferPlatform(gitUrl: string): string {
  try {
    const url = new URL(gitUrl)
    const host = url.hostname.toLowerCase()
    if (host.includes('github')) return 'github'
    if (host.includes('gitlab')) return 'gitlab'
    if (host.includes('bitbucket')) return 'bitbucket'
    if (host.includes('gitea')) return 'gitea'
    return 'other'
  } catch {
    return 'other'
  }
}

export function inferCredentialName(gitUrl: string): string {
  try {
    const url = new URL(gitUrl)
    const host = url.hostname.replace(/^www\./, '')
    const parts = url.pathname.split('/').filter(Boolean)
    const owner = parts[0] || ''
    return owner ? `${host} - ${owner}` : host
  } catch {
    return ''
  }
}

function getProjectRepos(project: Project | null | undefined): ProjectRepo[] {
  if (!project) return []
  if (project.gitUrls && project.gitUrls.length > 0) {
    return project.gitUrls
  }
  if (!project.gitUrl) return []
  return [{
    url: project.gitUrl,
    branch: project.branch || 'main',
    name: extractRepoName(project.gitUrl)
  }]
}

function getProjectRepoUrlSet(project: Project | null | undefined): Set<string> {
  return new Set(getProjectRepos(project).map((repo) => normalizeGitUrl(repo.url)))
}

function getProjectRepoBranchMap(project: Project | null | undefined): Record<string, string> {
  return Object.fromEntries(getProjectRepos(project).map((repo) => [repo.url, repo.branch]))
}

type UseProjectEditorParams = {
  session: Session | null
  currentTeamId: string | null
  projects: Project[]
  getAuthHeaders: () => Record<string, string>
  clearSession: () => void
  showToast: (message: string, type?: ToastType, duration?: number) => void
  showConfirm: (message: string) => Promise<boolean>
  loadProjects: () => Promise<void>
  loadProviders: () => Promise<void>
  savedCredentials: SavedCredential[]
  loadSavedCredentials: () => Promise<void>
  createSavedCredential: (name: string, platform: string, token: string) => Promise<SavedCredential | null>
}

export function useProjectEditor({
  session,
  currentTeamId,
  projects,
  getAuthHeaders,
  clearSession,
  showToast,
  showConfirm,
  loadProjects,
  loadProviders,
  savedCredentials,
  loadSavedCredentials,
  createSavedCredential
}: UseProjectEditorParams) {
  const [addProjectModalOpen, setAddProjectModalOpen] = useState(false)
  const [addTab, setAddTab] = useState<'manual' | 'provider'>('manual')
  const [addToProjectId, setAddToProjectId] = useState('')
  const [providerAddToProjectId, setProviderAddToProjectId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [gitUrl, setGitUrl] = useState('')
  const [gitBranch, setGitBranch] = useState('')
  const [isPrivateRepo, setIsPrivateRepo] = useState(false)
  const [gitToken, setGitToken] = useState('')
  const [credentialMode, setCredentialMode] = useState<'saved' | 'new'>('new')
  const [selectedCredentialId, setSelectedCredentialId] = useState('')
  const [newCredentialName, setNewCredentialName] = useState('')
  const [addProjectLoading, setAddProjectLoading] = useState(false)

  const [providerSelectId, setProviderSelectId] = useState('')
  const [providerRepoSearch, setProviderRepoSearch] = useState('')
  const [providerRepos, setProviderRepos] = useState<ProviderRepo[]>([])
  const [providerReposLoading, setProviderReposLoading] = useState(false)
  const [providerSelectedRepos, setProviderSelectedRepos] = useState<ProviderSelection>({})
  const [branchCache, setBranchCache] = useState<Record<string, string[]>>({})

  const [editProjectModalOpen, setEditProjectModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editTab, setEditTab] = useState<'manual' | 'provider'>('manual')
  const [editGitUrl, setEditGitUrl] = useState('')
  const [editBranch, setEditBranch] = useState('')
  const [editName, setEditName] = useState('')
  const [editProviderId, setEditProviderId] = useState('')
  const [editProviderRepos, setEditProviderRepos] = useState<ProviderRepo[]>([])
  const [editRepoSearch, setEditRepoSearch] = useState('')
  const [editSelectedRepos, setEditSelectedRepos] = useState<EditRepoSelection>({})
  const [editExistingRepoBranches, setEditExistingRepoBranches] = useState<Record<string, string>>({})
  const [editExistingRepoSavingUrl, setEditExistingRepoSavingUrl] = useState<string | null>(null)

  useEffect(() => {
    setProviderSelectId('')
    setProviderRepoSearch('')
    setProviderRepos([])
    setProviderSelectedRepos({})
    setBranchCache({})
    setEditProviderId('')
    setEditRepoSearch('')
    setEditProviderRepos([])
    setEditSelectedRepos({})
    setEditExistingRepoBranches({})
    setEditExistingRepoSavingUrl(null)
    setAddProjectModalOpen(false)
    setEditProjectModalOpen(false)
  }, [currentTeamId])

  useEffect(() => {
    if (!session) {
      setAddProjectModalOpen(false)
      setEditProjectModalOpen(false)
    }
  }, [session])

  useEffect(() => {
    if (!providerAddToProjectId) return

    const existingRepoUrls = getProjectRepoUrlSet(
      projects.find((project) => project.id === providerAddToProjectId)
    )

    setProviderSelectedRepos((prev) => {
      const nextEntries = Object.entries(prev).filter(
        ([repoUrl]) => !existingRepoUrls.has(normalizeGitUrl(repoUrl))
      )

      if (nextEntries.length === Object.keys(prev).length) {
        return prev
      }

      return Object.fromEntries(nextEntries)
    })
  }, [projects, providerAddToProjectId])

  useEffect(() => {
    if (isPrivateRepo && credentialMode === 'new' && gitUrl && !newCredentialName) {
      const inferred = inferCredentialName(gitUrl)
      if (inferred) setNewCredentialName(inferred)
    }
  }, [isPrivateRepo, credentialMode, gitUrl, newCredentialName])

  async function openAddProjectModal() {
    setAddProjectModalOpen(true)
    setAddTab('manual')
    setAddToProjectId('')
    setProviderAddToProjectId('')
    setProjectName('')
    setGitUrl('')
    setGitBranch('')
    setIsPrivateRepo(false)
    setGitToken('')
    setCredentialMode(savedCredentials.length > 0 ? 'saved' : 'new')
    setSelectedCredentialId('')
    setNewCredentialName('')
    setProviderSelectId('')
    setProviderRepoSearch('')
    setProviderRepos([])
    setProviderSelectedRepos({})
    setBranchCache({})
    await loadProjects()
    await Promise.all([loadProviders(), loadSavedCredentials()])
  }

  const closeAddProjectModal = useCallback(() => {
    setAddProjectModalOpen(false)
    setAddProjectLoading(false)
    setAddTab('manual')
    setAddToProjectId('')
    setProviderAddToProjectId('')
    setProjectName('')
    setGitUrl('')
    setGitBranch('')
    setIsPrivateRepo(false)
    setGitToken('')
    setCredentialMode('new')
    setSelectedCredentialId('')
    setNewCredentialName('')
    setProviderSelectId('')
    setProviderRepoSearch('')
    setProviderRepos([])
    setProviderSelectedRepos({})
    setBranchCache({})
  }, [])

  async function handleAddProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!gitUrl.trim()) {
      showToast('Please enter a git URL', 'error')
      return
    }
    setAddProjectLoading(true)
    try {
      // Resolve credentials: saved mode uses savedCredentialId, new mode uses inline token
      let credentialsPayload: { token: string } | undefined
      let savedCredentialIdPayload: string | undefined

      if (isPrivateRepo) {
        if (credentialMode === 'saved' && selectedCredentialId) {
          savedCredentialIdPayload = selectedCredentialId
        } else if (credentialMode === 'new' && gitToken) {
          credentialsPayload = { token: gitToken }
          // Always save the credential for reuse
          const credName = newCredentialName.trim() || inferCredentialName(gitUrl.trim())
          if (credName) {
            const platform = inferPlatform(gitUrl.trim())
            await createSavedCredential(credName, platform, gitToken)
          }
        }
      }

      if (addToProjectId) {
        const targetProject = projects.find((project) => project.id === addToProjectId)
        if (getProjectRepoUrlSet(targetProject).has(normalizeGitUrl(gitUrl.trim()))) {
          showToast('Repository already exists in this project', 'error')
          return
        }
        const repoName = extractRepoName(gitUrl.trim())
        const repo: { gitUrl: string; name: string; branch?: string } = {
          gitUrl: gitUrl.trim(),
          name: repoName
        }
        if (gitBranch.trim()) repo.branch = gitBranch.trim()
        const body: { repos: typeof repo[]; credentials?: { token: string }; savedCredentialId?: string } = { repos: [repo] }
        if (credentialsPayload) body.credentials = credentialsPayload
        if (savedCredentialIdPayload) body.savedCredentialId = savedCredentialIdPayload
        await apiRequest(`/api/projects/${addToProjectId}/repos`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body,
          onUnauthorized: clearSession
        })
        showToast('Repository added to project', 'success')
      } else {
        if (!projectName.trim()) {
          showToast('Please enter a project name', 'error')
          return
        }
        const body: {
          name: string
          gitUrl: string
          branch?: string
          credentials?: { token: string }
          savedCredentialId?: string
        } = {
          name: projectName.trim(),
          gitUrl: gitUrl.trim()
        }
        if (gitBranch.trim()) body.branch = gitBranch.trim()
        if (credentialsPayload) body.credentials = credentialsPayload
        if (savedCredentialIdPayload) body.savedCredentialId = savedCredentialIdPayload
        await apiRequest('/api/projects', {
          method: 'POST',
          headers: getAuthHeaders(),
          body,
          onUnauthorized: clearSession
        })
      }

      closeAddProjectModal()
      await loadProjects()
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to add project'
      showToast(message, 'error')
    } finally {
      setAddProjectLoading(false)
    }
  }

  async function loadProviderRepos(providerId: string) {
    if (!providerId) {
      setProviderRepos([])
      return
    }
    setProviderReposLoading(true)
    try {
      const data = await apiRequest<ProviderRepo[]>(`/api/git-providers/${providerId}/repos`, {
        headers: getAuthHeaders(),
        onUnauthorized: clearSession
      })
      setProviderRepos(Array.isArray(data) ? data : [])
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to load repositories'
      showToast(message, 'error')
      setProviderRepos([])
    } finally {
      setProviderReposLoading(false)
    }
  }

  async function handleProviderSelectChange(providerId: string) {
    setProviderSelectId(providerId)
    setProviderSelectedRepos({})
    setBranchCache({})
    setProviderRepos([])
    setProviderRepoSearch('')
    if (!providerId) return
    await loadProviderRepos(providerId)
  }

  async function loadBranchesForRepo(providerId: string, owner: string, repo: string, fallback: string) {
    if (!owner) return
    const key = `${owner}/${repo}`
    if (branchCache[key]) return
    try {
      const data = await apiRequest<string[]>(
        `/api/git-providers/${providerId}/repos/${owner}/${repo}/branches`,
        { headers: getAuthHeaders(), onUnauthorized: clearSession }
      )
      setBranchCache((prev) => ({ ...prev, [key]: data }))
    } catch {
      setBranchCache((prev) => ({ ...prev, [key]: [fallback] }))
    }
  }

  function toggleProviderRepo(repo: ProviderRepo, checked: boolean) {
    const owner = repo.owner?.login || ''
    if (checked) {
      setProviderSelectedRepos((prev) => ({
        ...prev,
        [repo.clone_url]: {
          name: repo.name,
          owner,
          repo: repo.name,
          branch: repo.default_branch,
          defaultBranch: repo.default_branch
        }
      }))
      if (providerSelectId) {
        void loadBranchesForRepo(providerSelectId, owner, repo.name, repo.default_branch)
      }
    } else {
      setProviderSelectedRepos((prev) => {
        const next = { ...prev }
        delete next[repo.clone_url]
        return next
      })
    }
  }

  function updateProviderRepoBranch(repoUrl: string, branch: string) {
    setProviderSelectedRepos((prev) => ({
      ...prev,
      [repoUrl]: { ...prev[repoUrl], branch }
    }))
  }

  async function handleImportSelectedRepos() {
    const existingRepoUrls = providerAddToProjectId
      ? getProjectRepoUrlSet(projects.find((project) => project.id === providerAddToProjectId))
      : new Set<string>()

    const selectedEntries = Object.entries(providerSelectedRepos).filter(
      ([gitUrlValue]) => !existingRepoUrls.has(normalizeGitUrl(gitUrlValue))
    )
    const skippedCount = Object.keys(providerSelectedRepos).length - selectedEntries.length

    if (selectedEntries.length === 0) {
      showToast(
        skippedCount > 0
          ? 'Selected repositories are already in this project'
          : 'Please select at least one repository',
        'error'
      )
      return
    }
    if (!providerSelectId) {
      showToast('Please select a provider', 'error')
      return
    }
    if (!providerAddToProjectId && !projectName.trim()) {
      showToast('Please enter a project name', 'error')
      return
    }

    const repos = selectedEntries.map(([gitUrlValue, repoInfo]) => ({
      gitUrl: gitUrlValue,
      branch: repoInfo.branch || repoInfo.defaultBranch,
      name: repoInfo.name
    }))

    setAddProjectLoading(true)
    try {
      if (providerAddToProjectId) {
        await apiRequest(`/api/projects/${providerAddToProjectId}/repos`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: { repos, gitProviderId: providerSelectId },
          onUnauthorized: clearSession
        })
        if (skippedCount > 0) {
          showToast(`Skipped ${skippedCount} repo(s) already in the project`, 'info')
        }
        showToast(`Added ${repos.length} repo(s) to project`, 'success')
      } else {
        await apiRequest('/api/projects/multi', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: { name: projectName.trim(), repos, gitProviderId: providerSelectId },
          onUnauthorized: clearSession
        })
        showToast('Project created successfully', 'success')
      }
      closeAddProjectModal()
      await loadProjects()
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to add repos'
      showToast(message, 'error')
    } finally {
      setAddProjectLoading(false)
    }
  }

  async function openEditProjectModal(projectId: string) {
    try {
      const data = await apiRequest<Project>(`/api/projects/${projectId}`, {
        headers: getAuthHeaders(),
        onUnauthorized: clearSession
      })
      setEditingProject(data)
      setEditExistingRepoBranches(getProjectRepoBranchMap(data))
      setEditExistingRepoSavingUrl(null)
      setEditProjectModalOpen(true)
      setEditTab('manual')
      setEditProviderId('')
      setBranchCache({})
      setEditProviderRepos([])
      setEditRepoSearch('')
      setEditSelectedRepos({})
      await loadProviders()
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to load project'
      showToast(message, 'error')
    }
  }

  const closeEditProjectModal = useCallback(() => {
    setEditProjectModalOpen(false)
    setEditingProject(null)
    setEditGitUrl('')
    setEditBranch('')
    setEditName('')
    setEditProviderId('')
    setEditProviderRepos([])
    setEditRepoSearch('')
    setEditSelectedRepos({})
    setEditExistingRepoBranches({})
    setEditExistingRepoSavingUrl(null)
    void loadProjects()
  }, [loadProjects])

  async function handleRemoveRepo(repoUrl: string) {
    if (!editingProject) return
    const confirmed = await showConfirm('Remove this repository from the project?')
    if (!confirmed) return
    try {
      const data = await apiRequest<Project>(`/api/projects/${editingProject.id}/repos`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: { repoUrl },
        onUnauthorized: clearSession
      })
      setEditingProject(data)
      setEditExistingRepoBranches(getProjectRepoBranchMap(data))
      showToast('Repository removed', 'success')
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to remove repo'
      showToast(message, 'error')
    }
  }

  async function handleAddRepoManual() {
    if (!editingProject) return
    const url = editGitUrl.trim()
    const name = editName.trim()
    const branch = editBranch.trim() || 'main'
    if (!url) {
      showToast('Please enter a git URL', 'error')
      return
    }
    if (!name) {
      showToast('Please enter a name for the repo subdirectory', 'error')
      return
    }
    if (getProjectRepoUrlSet(editingProject).has(normalizeGitUrl(url))) {
      showToast('Repository already exists in this project', 'error')
      return
    }
    try {
      const data = await apiRequest<Project>(`/api/projects/${editingProject.id}/repos`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: { repos: [{ gitUrl: url, branch, name }] },
        onUnauthorized: clearSession
      })
      setEditingProject(data)
      setEditExistingRepoBranches(getProjectRepoBranchMap(data))
      setEditGitUrl('')
      setEditBranch('')
      setEditName('')
      showToast('Repository added', 'success')
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to add repo'
      showToast(message, 'error')
    }
  }

  async function loadEditProviderRepos(providerId: string) {
    if (!providerId) {
      setEditProviderRepos([])
      return
    }
    try {
      const data = await apiRequest<ProviderRepo[]>(`/api/git-providers/${providerId}/repos`, {
        headers: getAuthHeaders(),
        onUnauthorized: clearSession
      })
      setEditProviderRepos(Array.isArray(data) ? data : [])
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to load repositories'
      showToast(message, 'error')
      setEditProviderRepos([])
    }
  }

  async function handleEditProviderChange(providerId: string) {
    setEditProviderId(providerId)
    setEditSelectedRepos({})
    setBranchCache({})
    setEditProviderRepos([])
    setEditRepoSearch('')
    if (!providerId) return
    await loadEditProviderRepos(providerId)
  }

  function toggleEditRepo(repo: ProviderRepo, checked: boolean) {
    if (checked) {
      const owner = repo.owner?.login || ''
      setEditSelectedRepos((prev) => ({
        ...prev,
        [repo.clone_url]: {
          name: repo.name,
          branch: repo.default_branch,
          defaultBranch: repo.default_branch
        }
      }))
      if (editProviderId) {
        void loadBranchesForRepo(editProviderId, owner, repo.name, repo.default_branch)
      }
    } else {
      setEditSelectedRepos((prev) => {
        const next = { ...prev }
        delete next[repo.clone_url]
        return next
      })
    }
  }

  function updateEditRepoBranch(repoUrl: string, branch: string) {
    setEditSelectedRepos((prev) => ({
      ...prev,
      [repoUrl]: { ...prev[repoUrl], branch }
    }))
  }

  async function handleAddSelectedReposToProject() {
    if (!editingProject) return
    const existingRepoUrls = getProjectRepoUrlSet(editingProject)
    const selectedEntries = Object.entries(editSelectedRepos).filter(
      ([gitUrlValue]) => !existingRepoUrls.has(normalizeGitUrl(gitUrlValue))
    )
    const skippedCount = Object.keys(editSelectedRepos).length - selectedEntries.length

    if (selectedEntries.length === 0) {
      showToast(
        skippedCount > 0
          ? 'Selected repositories are already in this project'
          : 'Please select at least one repository',
        'error'
      )
      return
    }
    if (!editProviderId) {
      showToast('Please select a provider', 'error')
      return
    }

    const repos = selectedEntries.map(([gitUrlValue, repoInfo]) => ({
      gitUrl: gitUrlValue,
      branch: repoInfo.branch || repoInfo.defaultBranch,
      name: repoInfo.name
    }))

    try {
      const data = await apiRequest<Project>(`/api/projects/${editingProject.id}/repos`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: { repos, gitProviderId: editProviderId },
        onUnauthorized: clearSession
      })
      setEditingProject(data)
      setEditExistingRepoBranches(getProjectRepoBranchMap(data))
      setEditSelectedRepos({})
      if (skippedCount > 0) {
        showToast(`Skipped ${skippedCount} repo(s) already in the project`, 'info')
      }
      showToast(`Added ${repos.length} repo(s)`, 'success')
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to add repos'
      showToast(message, 'error')
    }
  }

  function updateExistingRepoBranchInput(repoUrl: string, branch: string) {
    setEditExistingRepoBranches((prev) => ({
      ...prev,
      [repoUrl]: branch
    }))
  }

  async function handleUpdateExistingRepoBranch(repoUrl: string) {
    if (!editingProject) return

    const nextBranch = editExistingRepoBranches[repoUrl]?.trim()
    if (!nextBranch) {
      showToast('Please enter a branch name', 'error')
      return
    }

    const currentRepo = getProjectRepos(editingProject).find(
      (repo) => normalizeGitUrl(repo.url) === normalizeGitUrl(repoUrl)
    )

    if (!currentRepo) {
      showToast('Repository not found in this project', 'error')
      return
    }

    if (currentRepo.branch === nextBranch) {
      showToast('Branch is unchanged', 'info')
      return
    }

    setEditExistingRepoSavingUrl(repoUrl)
    try {
      const data = await apiRequest<Project>(`/api/projects/${editingProject.id}/repos`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: { repoUrl, branch: nextBranch },
        onUnauthorized: clearSession
      })
      setEditingProject(data)
      setEditExistingRepoBranches(getProjectRepoBranchMap(data))
      showToast('Branch updated. Sync queued.', 'success')
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to update repo branch'
      showToast(message, 'error')
    } finally {
      setEditExistingRepoSavingUrl(null)
    }
  }

  const filteredProviderRepos = useMemo(() => {
    const search = providerRepoSearch.toLowerCase()
    return providerRepos
      .filter((repo) => {
        return (
          repo.full_name.toLowerCase().includes(search) || repo.name.toLowerCase().includes(search)
        )
      })
      .slice(0, 50)
  }, [providerRepos, providerRepoSearch])

  const editingProjectRepos = useMemo(() => getProjectRepos(editingProject), [editingProject])

  const filteredEditRepos = useMemo(() => {
    const editExistingUrls = getProjectRepoUrlSet(editingProject)
    const search = editRepoSearch.toLowerCase()
    return editProviderRepos
      .filter((repo) => {
        if (editExistingUrls.has(normalizeGitUrl(repo.clone_url))) return false
        return (
          repo.full_name.toLowerCase().includes(search) || repo.name.toLowerCase().includes(search)
        )
      })
      .slice(0, 30)
  }, [editProviderRepos, editRepoSearch, editingProject])

  return {
    addProjectModalOpen,
    addTab,
    addToProjectId,
    providerAddToProjectId,
    projectName,
    gitUrl,
    gitBranch,
    isPrivateRepo,
    gitToken,
    credentialMode,
    selectedCredentialId,
    newCredentialName,
    addProjectLoading,
    providerSelectId,
    providerRepoSearch,
    providerRepos,
    providerReposLoading,
    providerSelectedRepos,
    branchCache,
    editProjectModalOpen,
    editingProject,
    editTab,
    editGitUrl,
    editBranch,
    editName,
    editProviderId,
    editProviderRepos,
    editRepoSearch,
    editSelectedRepos,
    editExistingRepoBranches,
    editExistingRepoSavingUrl,
    filteredProviderRepos,
    editingProjectRepos,
    filteredEditRepos,
    openAddProjectModal,
    closeAddProjectModal,
    handleAddProject,
    handleProviderSelectChange,
    toggleProviderRepo,
    updateProviderRepoBranch,
    handleImportSelectedRepos,
    openEditProjectModal,
    closeEditProjectModal,
    handleRemoveRepo,
    handleAddRepoManual,
    handleEditProviderChange,
    toggleEditRepo,
    updateEditRepoBranch,
    updateExistingRepoBranchInput,
    handleUpdateExistingRepoBranch,
    handleAddSelectedReposToProject,
    setAddTab,
    setAddToProjectId,
    setProviderAddToProjectId,
    setProjectName,
    setGitUrl,
    setGitBranch,
    setIsPrivateRepo,
    setGitToken,
    setCredentialMode,
    setSelectedCredentialId,
    setNewCredentialName,
    setProviderRepoSearch,
    setEditTab,
    setEditGitUrl,
    setEditBranch,
    setEditName,
    setEditProviderId,
    setEditRepoSearch
  }
}
