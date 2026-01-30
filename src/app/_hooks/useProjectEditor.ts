'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  EditRepoSelection,
  Project,
  ProviderRepo,
  ProviderSelection,
  Session,
  ToastType
} from '../_types'
import { extractRepoName } from '../_lib/utils'

type UseProjectEditorParams = {
  session: Session | null
  currentTeamId: string | null
  getAuthHeaders: () => Record<string, string>
  clearSession: () => void
  showToast: (message: string, type?: ToastType, duration?: number) => void
  showConfirm: (message: string) => Promise<boolean>
  loadProjects: () => Promise<void>
  loadProviders: () => Promise<void>
}

export function useProjectEditor({
  session,
  currentTeamId,
  getAuthHeaders,
  clearSession,
  showToast,
  showConfirm,
  loadProjects,
  loadProviders
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
    setAddProjectModalOpen(false)
    setEditProjectModalOpen(false)
  }, [currentTeamId])

  useEffect(() => {
    if (!session) {
      setAddProjectModalOpen(false)
      setEditProjectModalOpen(false)
    }
  }, [session])

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
    setProviderSelectId('')
    setProviderRepoSearch('')
    setProviderRepos([])
    setProviderSelectedRepos({})
    setBranchCache({})
    await loadProjects()
    await loadProviders()
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
      if (addToProjectId) {
        const repoName = extractRepoName(gitUrl.trim())
        const repo: { gitUrl: string; name: string; branch?: string } = {
          gitUrl: gitUrl.trim(),
          name: repoName
        }
        if (gitBranch.trim()) repo.branch = gitBranch.trim()
        const body: { repos: typeof repo[]; credentials?: { token: string } } = { repos: [repo] }
        if (isPrivateRepo && gitToken) {
          body.credentials = { token: gitToken }
        }
        const response = await fetch(`/api/projects/${addToProjectId}/repos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(body)
        })
        const data = (await response.json()) as { error?: string; message?: string }
        if (response.status === 401) {
          clearSession()
          return
        }
        if (!response.ok) {
          throw new Error(data.error || data.message || 'Failed to add repo')
        }
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
        } = {
          name: projectName.trim(),
          gitUrl: gitUrl.trim()
        }
        if (gitBranch.trim()) body.branch = gitBranch.trim()
        if (isPrivateRepo && gitToken) {
          body.credentials = {
            token: gitToken
          }
        }
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(body)
        })
        const data = (await response.json()) as { error?: string; message?: string }
        if (response.status === 401) {
          clearSession()
          return
        }
        if (!response.ok) {
          throw new Error(data.error || data.message || 'Failed to add project')
        }
      }

      closeAddProjectModal()
      await loadProjects()
    } catch (err) {
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
      const response = await fetch(`/api/git-providers/${providerId}/repos`, {
        headers: getAuthHeaders()
      })
      const data = (await response.json()) as ProviderRepo[] | { error?: string }
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok || !Array.isArray(data)) {
        const message = !Array.isArray(data) ? data.error : 'Failed to load repositories'
        throw new Error(message || 'Failed to load repositories')
      }
      setProviderRepos(data)
    } catch (err) {
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
      const response = await fetch(
        `/api/git-providers/${providerId}/repos/${owner}/${repo}/branches`,
        { headers: getAuthHeaders() }
      )
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok) {
        throw new Error('Failed to load branches')
      }
      const data = (await response.json()) as string[]
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
    const selectedEntries = Object.entries(providerSelectedRepos)
    if (selectedEntries.length === 0) {
      showToast('Please select at least one repository', 'error')
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
        const response = await fetch(`/api/projects/${providerAddToProjectId}/repos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            repos,
            gitProviderId: providerSelectId
          })
        })
        const data = (await response.json()) as { error?: string; message?: string }
        if (response.status === 401) {
          clearSession()
          return
        }
        if (!response.ok) {
          throw new Error(data.error || data.message || 'Failed to add repos')
        }
        showToast(`Added ${repos.length} repo(s) to project`, 'success')
      } else {
        const response = await fetch('/api/projects/multi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            name: projectName.trim(),
            repos,
            gitProviderId: providerSelectId
          })
        })
        const data = (await response.json()) as { error?: string; message?: string }
        if (response.status === 401) {
          clearSession()
          return
        }
        if (!response.ok) {
          throw new Error(data.error || data.message || 'Failed to create project')
        }
        showToast('Project created successfully', 'success')
      }
      closeAddProjectModal()
      await loadProjects()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add repos'
      showToast(message, 'error')
    } finally {
      setAddProjectLoading(false)
    }
  }

  async function openEditProjectModal(projectId: string) {
    try {
      const response = await fetch(`/api/projects/${projectId}`, { headers: getAuthHeaders() })
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok) {
        throw new Error('Failed to load project')
      }
      const data = (await response.json()) as Project
      setEditingProject(data)
      setEditProjectModalOpen(true)
      setEditTab('manual')
      setEditProviderId('')
      setEditProviderRepos([])
      setEditRepoSearch('')
      setEditSelectedRepos({})
      await loadProviders()
    } catch (err) {
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
    void loadProjects()
  }, [loadProjects])

  async function handleRemoveRepo(repoUrl: string) {
    if (!editingProject) return
    const confirmed = await showConfirm('Remove this repository from the project?')
    if (!confirmed) return
    try {
      const response = await fetch(`/api/projects/${editingProject.id}/repos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ repoUrl })
      })
      const data = (await response.json()) as Project | { error?: string }
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok || !('id' in data)) {
        const message = 'error' in data ? data.error : 'Failed to remove repo'
        throw new Error(message || 'Failed to remove repo')
      }
      setEditingProject(data)
      showToast('Repository removed', 'success')
    } catch (err) {
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
    try {
      const response = await fetch(`/api/projects/${editingProject.id}/repos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          repos: [{ gitUrl: url, branch, name }]
        })
      })
      const data = (await response.json()) as Project | { error?: string }
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok || !('id' in data)) {
        const message = 'error' in data ? data.error : 'Failed to add repo'
        throw new Error(message || 'Failed to add repo')
      }
      setEditingProject(data)
      setEditGitUrl('')
      setEditBranch('')
      setEditName('')
      showToast('Repository added', 'success')
    } catch (err) {
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
      const response = await fetch(`/api/git-providers/${providerId}/repos`, {
        headers: getAuthHeaders()
      })
      const data = (await response.json()) as ProviderRepo[] | { error?: string }
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok || !Array.isArray(data)) {
        const message = !Array.isArray(data) ? data.error : 'Failed to load repositories'
        throw new Error(message || 'Failed to load repositories')
      }
      setEditProviderRepos(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load repositories'
      showToast(message, 'error')
      setEditProviderRepos([])
    }
  }

  async function handleEditProviderChange(providerId: string) {
    setEditProviderId(providerId)
    setEditSelectedRepos({})
    setEditProviderRepos([])
    setEditRepoSearch('')
    if (!providerId) return
    await loadEditProviderRepos(providerId)
  }

  function toggleEditRepo(repo: ProviderRepo, checked: boolean) {
    if (checked) {
      setEditSelectedRepos((prev) => ({
        ...prev,
        [repo.clone_url]: {
          name: repo.name,
          branch: repo.default_branch,
          defaultBranch: repo.default_branch
        }
      }))
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
    const selectedEntries = Object.entries(editSelectedRepos)
    if (selectedEntries.length === 0) {
      showToast('Please select at least one repository', 'error')
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
      const response = await fetch(`/api/projects/${editingProject.id}/repos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          repos,
          gitProviderId: editProviderId
        })
      })
      const data = (await response.json()) as Project | { error?: string; message?: string }
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok) {
        const errorData = data as { error?: string; message?: string }
        throw new Error(errorData.error || errorData.message || 'Failed to add repos')
      }
      if (!('id' in data)) {
        throw new Error('Failed to add repos')
      }
      setEditingProject(data)
      setEditSelectedRepos({})
      showToast(`Added ${repos.length} repo(s)`, 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add repos'
      showToast(message, 'error')
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

  const editingProjectRepos = useMemo(() => editingProject?.gitUrls ?? [], [editingProject])

  const filteredEditRepos = useMemo(() => {
    const editExistingUrls = new Set<string>()
    if (editingProject) {
      editingProjectRepos.forEach((repo) => editExistingUrls.add(repo.url))
      if (!editingProjectRepos.length && editingProject.gitUrl) {
        editExistingUrls.add(editingProject.gitUrl)
      }
    }
    const search = editRepoSearch.toLowerCase()
    return editProviderRepos
      .filter((repo) => {
        if (editExistingUrls.has(repo.clone_url)) return false
        return (
          repo.full_name.toLowerCase().includes(search) || repo.name.toLowerCase().includes(search)
        )
      })
      .slice(0, 30)
  }, [editProviderRepos, editRepoSearch, editingProject, editingProjectRepos])

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
    handleAddSelectedReposToProject,
    setAddTab,
    setAddToProjectId,
    setProviderAddToProjectId,
    setProjectName,
    setGitUrl,
    setGitBranch,
    setIsPrivateRepo,
    setGitToken,
    setProviderRepoSearch,
    setEditTab,
    setEditGitUrl,
    setEditBranch,
    setEditName,
    setEditProviderId,
    setEditRepoSearch
  }
}
