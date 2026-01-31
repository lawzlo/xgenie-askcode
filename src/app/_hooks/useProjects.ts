'use client'

import { useCallback } from 'react'
import type { Session, ToastType } from '../_types'
import { useChat } from './useChat'
import { useProjectEditor } from './useProjectEditor'
import { useProjectList } from './useProjectList'

type UseProjectsParams = {
  session: Session | null
  currentTeamId: string | null
  getAuthHeaders: () => Record<string, string>
  clearSession: () => void
  showToast: (message: string, type?: ToastType, duration?: number) => void
  showConfirm: (message: string) => Promise<boolean>
  loadProviders: () => Promise<void>
  initialProjectId?: string | null
  onSelectedProjectChange?: (projectId: string | null) => void
}

export function useProjects({
  session,
  currentTeamId,
  getAuthHeaders,
  clearSession,
  showToast,
  showConfirm,
  loadProviders,
  initialProjectId,
  onSelectedProjectChange
}: UseProjectsParams) {
  const list = useProjectList({
    session,
    currentTeamId,
    getAuthHeaders,
    clearSession,
    showToast,
    showConfirm
  })

  const chat = useChat({
    session,
    currentTeamId,
    projects: list.projects,
    getAuthHeaders,
    clearSession,
    showToast,
    showConfirm,
    initialProjectId,
    onSelectedProjectChange
  })

  const editor = useProjectEditor({
    session,
    currentTeamId,
    getAuthHeaders,
    clearSession,
    showToast,
    showConfirm,
    loadProjects: list.loadProjects,
    loadProviders
  })

  const { handleDeleteProject: deleteProject } = list
  const { handleProjectDeleted } = chat

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      const deleted = await deleteProject(projectId)
      if (deleted) {
        handleProjectDeleted(projectId)
      }
    },
    [deleteProject, handleProjectDeleted]
  )

  return {
    projects: list.projects,
    projectsLoading: list.projectsLoading,
    demoAvailable: list.demoAvailable,
    demoLoading: list.demoLoading,
    handleCreateDemo: list.handleCreateDemo,
    selectedProjectId: chat.selectedProjectId,
    selectedProjectName: chat.selectedProjectName,
    addProjectModalOpen: editor.addProjectModalOpen,
    addTab: editor.addTab,
    addToProjectId: editor.addToProjectId,
    providerAddToProjectId: editor.providerAddToProjectId,
    projectName: editor.projectName,
    gitUrl: editor.gitUrl,
    gitBranch: editor.gitBranch,
    isPrivateRepo: editor.isPrivateRepo,
    gitToken: editor.gitToken,
    addProjectLoading: editor.addProjectLoading,
    providerSelectId: editor.providerSelectId,
    providerRepoSearch: editor.providerRepoSearch,
    providerRepos: editor.providerRepos,
    providerReposLoading: editor.providerReposLoading,
    providerSelectedRepos: editor.providerSelectedRepos,
    branchCache: editor.branchCache,
    editProjectModalOpen: editor.editProjectModalOpen,
    editingProject: editor.editingProject,
    editTab: editor.editTab,
    editGitUrl: editor.editGitUrl,
    editBranch: editor.editBranch,
    editName: editor.editName,
    editProviderId: editor.editProviderId,
    editProviderRepos: editor.editProviderRepos,
    editRepoSearch: editor.editRepoSearch,
    editSelectedRepos: editor.editSelectedRepos,
    chatMessages: chat.chatMessages,
    chatLoading: chat.chatLoading,
    historyLoading: chat.historyLoading,
    questionInput: chat.questionInput,
    questionSuggestions: chat.questionSuggestions,
    suggestionsLoading: chat.suggestionsLoading,
    chatContainerRef: chat.chatContainerRef,
    questionInputRef: chat.questionInputRef,
    filteredProviderRepos: editor.filteredProviderRepos,
    editingProjectRepos: editor.editingProjectRepos,
    filteredEditRepos: editor.filteredEditRepos,
    loadProjects: list.loadProjects,
    openAddProjectModal: editor.openAddProjectModal,
    closeAddProjectModal: editor.closeAddProjectModal,
    handleAddProject: editor.handleAddProject,
    handleProviderSelectChange: editor.handleProviderSelectChange,
    toggleProviderRepo: editor.toggleProviderRepo,
    updateProviderRepoBranch: editor.updateProviderRepoBranch,
    handleImportSelectedRepos: editor.handleImportSelectedRepos,
    openEditProjectModal: editor.openEditProjectModal,
    closeEditProjectModal: editor.closeEditProjectModal,
    handleRemoveRepo: editor.handleRemoveRepo,
    handleAddRepoManual: editor.handleAddRepoManual,
    handleEditProviderChange: editor.handleEditProviderChange,
    toggleEditRepo: editor.toggleEditRepo,
    updateEditRepoBranch: editor.updateEditRepoBranch,
    handleAddSelectedReposToProject: editor.handleAddSelectedReposToProject,
    handleSelectProject: chat.handleSelectProject,
    handleSyncProject: list.handleSyncProject,
    handleDeleteProject,
    handleClearHistory: chat.handleClearHistory,
    handleAskQuestion: chat.handleAskQuestion,
    handleCancelAsk: chat.handleCancelAsk,
    setAddTab: editor.setAddTab,
    setAddToProjectId: editor.setAddToProjectId,
    setProviderAddToProjectId: editor.setProviderAddToProjectId,
    setProjectName: editor.setProjectName,
    setGitUrl: editor.setGitUrl,
    setGitBranch: editor.setGitBranch,
    setIsPrivateRepo: editor.setIsPrivateRepo,
    setGitToken: editor.setGitToken,
    setProviderRepoSearch: editor.setProviderRepoSearch,
    setEditTab: editor.setEditTab,
    setEditGitUrl: editor.setEditGitUrl,
    setEditBranch: editor.setEditBranch,
    setEditName: editor.setEditName,
    setEditProviderId: editor.setEditProviderId,
    setEditRepoSearch: editor.setEditRepoSearch,
    setQuestionInput: chat.setQuestionInput
  }
}
