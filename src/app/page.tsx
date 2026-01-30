'use client'

import { useEffect } from 'react'
import { AddProjectModal } from './_components/AddProjectModal'
import { AuthModal } from './_components/AuthModal'
import { ConfirmDialog } from './_components/ConfirmDialog'
import { ConversationSection } from './_components/ConversationSection'
import { EditProjectModal } from './_components/EditProjectModal'
import { ForgotModal } from './_components/ForgotModal'
import { Header } from './_components/Header'
import { LoginNotice } from './_components/LoginNotice'
import { ProjectList } from './_components/ProjectList'
import { ProvidersModal } from './_components/ProvidersModal'
import { ResetModal } from './_components/ResetModal'
import { SavedModal } from './_components/SavedModal'
import { TeamModal } from './_components/TeamModal'
import { Toasts } from './_components/Toasts'
import { useAuth } from './_hooks/useAuth'
import { useConfirm } from './_hooks/useConfirm'
import { useProjects } from './_hooks/useProjects'
import { useProviders } from './_hooks/useProviders'
import { useSaved } from './_hooks/useSaved'
import { useTeams } from './_hooks/useTeams'
import { useToast } from './_hooks/useToast'

export default function HomePage() {
  const { toasts, showToast, dismissToast } = useToast()
  const { confirmOpen, confirmMessage, showConfirm, closeConfirm } = useConfirm()

  const auth = useAuth({ showToast })
  const teams = useTeams({
    session: auth.session,
    teams: auth.teams,
    currentTeamId: auth.currentTeamId,
    setTeams: auth.setTeams,
    getAuthHeaders: auth.getAuthHeaders,
    clearSession: auth.clearSession,
    showToast,
    showConfirm
  })
  const providers = useProviders({
    session: auth.session,
    currentTeamId: auth.currentTeamId,
    getAuthHeaders: auth.getAuthHeaders,
    clearSession: auth.clearSession,
    showToast,
    showConfirm
  })
  const projects = useProjects({
    session: auth.session,
    currentTeamId: auth.currentTeamId,
    getAuthHeaders: auth.getAuthHeaders,
    clearSession: auth.clearSession,
    showToast,
    showConfirm,
    loadProviders: providers.loadProviders
  })
  const savedHook = useSaved({
    getAuthHeaders: auth.getAuthHeaders,
    showToast
  })

  const { closeAuthModal, closeForgotModal, closeResetModal } = auth
  const { closeTeamModal } = teams
  const { closeAddProjectModal, closeEditProjectModal } = projects
  const { closeProvidersModal } = providers
  const { closeSavedModal } = savedHook

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAuthModal()
        closeForgotModal()
        closeResetModal()
        closeTeamModal()
        closeAddProjectModal()
        closeEditProjectModal()
        closeProvidersModal()
        closeSavedModal()
        if (confirmOpen) closeConfirm(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    closeAuthModal,
    closeForgotModal,
    closeResetModal,
    closeTeamModal,
    closeAddProjectModal,
    closeEditProjectModal,
    closeProvidersModal,
    closeSavedModal,
    confirmOpen,
    closeConfirm
  ])

  return (
    <>
      <Header
        session={auth.session}
        teams={auth.teams}
        currentTeamId={auth.currentTeamId}
        userAccessLevel={teams.userAccessLevel}
        onTeamSwitch={auth.handleTeamSwitch}
        onOpenAddProject={() => {
          void projects.openAddProjectModal()
        }}
        onOpenProviders={() => {
          void providers.openProvidersModal()
        }}
        onOpenTeam={() => void teams.openTeamModal()}
        onLogout={() => void auth.handleLogout()}
        onDeleteAccount={() => void auth.handleDeleteAccount(showConfirm.bind(null, 'Delete your account? This cannot be undone.'))}
        onLogin={() => auth.openAuthModal('login')}
        onSignup={() => auth.openAuthModal('signup')}
      />

      <div className="main">
        <AuthModal
          open={auth.authModalOpen}
          mode={auth.authMode}
          email={auth.authEmail}
          password={auth.authPassword}
          error={auth.authError}
          loading={auth.authLoading}
          emailRef={auth.authEmailRef}
          onEmailChange={auth.setAuthEmail}
          onPasswordChange={auth.setAuthPassword}
          onSubmit={auth.handleAuth}
          onClose={auth.closeAuthModal}
          onSwitchToLogin={() => auth.openAuthModal('login')}
          onSwitchToSignup={() => auth.openAuthModal('signup')}
          onOpenForgot={() => auth.openForgotModal()}
        />

        <ForgotModal
          open={auth.forgotModalOpen}
          email={auth.forgotEmail}
          error={auth.forgotError}
          success={auth.forgotSuccess}
          loading={auth.forgotLoading}
          emailRef={auth.forgotEmailRef}
          onEmailChange={auth.setForgotEmail}
          onSubmit={auth.handleForgotPassword}
          onClose={auth.closeForgotModal}
          onBackToLogin={() => {
            auth.closeForgotModal()
            auth.openAuthModal('login')
          }}
        />

        <ResetModal
          open={auth.resetModalOpen}
          title={auth.resetTitle}
          password={auth.resetPassword}
          confirm={auth.resetConfirm}
          error={auth.resetError}
          success={auth.resetSuccess}
          loading={auth.resetLoading}
          passwordRef={auth.resetPasswordRef}
          onPasswordChange={auth.setResetPassword}
          onConfirmChange={auth.setResetConfirm}
          onSubmit={auth.handleResetPassword}
          onClose={auth.closeResetModal}
        />

        <AddProjectModal
          open={projects.addProjectModalOpen}
          addTab={projects.addTab}
          onSelectManualTab={() => projects.setAddTab('manual')}
          onSelectProviderTab={() => {
            projects.setAddTab('provider')
            void providers.loadProviders()
          }}
          projects={projects.projects}
          addToProjectId={projects.addToProjectId}
          onAddToProjectChange={projects.setAddToProjectId}
          providerAddToProjectId={projects.providerAddToProjectId}
          onProviderAddToProjectChange={projects.setProviderAddToProjectId}
          projectName={projects.projectName}
          onProjectNameChange={projects.setProjectName}
          gitUrl={projects.gitUrl}
          onGitUrlChange={projects.setGitUrl}
          gitBranch={projects.gitBranch}
          onGitBranchChange={projects.setGitBranch}
          isPrivateRepo={projects.isPrivateRepo}
          onPrivateRepoChange={projects.setIsPrivateRepo}
          gitToken={projects.gitToken}
          onGitTokenChange={projects.setGitToken}
          addProjectLoading={projects.addProjectLoading}
          onSubmitAddProject={projects.handleAddProject}
          connectedProviders={providers.connectedProviders}
          providerSelectId={projects.providerSelectId}
          onProviderSelectChange={projects.handleProviderSelectChange}
          providerRepoSearch={projects.providerRepoSearch}
          onProviderRepoSearchChange={projects.setProviderRepoSearch}
          providerReposLoading={projects.providerReposLoading}
          providerRepos={projects.providerRepos}
          filteredProviderRepos={projects.filteredProviderRepos}
          providerSelectedRepos={projects.providerSelectedRepos}
          branchCache={projects.branchCache}
          onToggleProviderRepo={projects.toggleProviderRepo}
          onUpdateProviderRepoBranch={projects.updateProviderRepoBranch}
          onImportSelectedRepos={() => void projects.handleImportSelectedRepos()}
          onOpenProvidersFromAdd={() => {
            projects.closeAddProjectModal()
            void providers.openProvidersModal()
          }}
          onClose={projects.closeAddProjectModal}
        />

        <EditProjectModal
          open={projects.editProjectModalOpen}
          editingProject={projects.editingProject}
          editingProjectRepos={projects.editingProjectRepos}
          editTab={projects.editTab}
          onSelectManualTab={() => projects.setEditTab('manual')}
          onSelectProviderTab={() => {
            projects.setEditTab('provider')
            void providers.loadProviders()
          }}
          editGitUrl={projects.editGitUrl}
          onEditGitUrlChange={projects.setEditGitUrl}
          editBranch={projects.editBranch}
          onEditBranchChange={projects.setEditBranch}
          editName={projects.editName}
          onEditNameChange={projects.setEditName}
          onAddRepoManual={projects.handleAddRepoManual}
          connectedProviders={providers.connectedProviders}
          editProviderId={projects.editProviderId}
          onEditProviderChange={projects.handleEditProviderChange}
          editRepoSearch={projects.editRepoSearch}
          onEditRepoSearchChange={projects.setEditRepoSearch}
          filteredEditRepos={projects.filteredEditRepos}
          editSelectedRepos={projects.editSelectedRepos}
          onToggleEditRepo={projects.toggleEditRepo}
          onUpdateEditRepoBranch={projects.updateEditRepoBranch}
          onAddSelectedRepos={() => void projects.handleAddSelectedReposToProject()}
          onRemoveRepo={(repoUrl) => void projects.handleRemoveRepo(repoUrl)}
          onClose={projects.closeEditProjectModal}
        />

        <ProvidersModal
          open={providers.providersModalOpen}
          providersLoading={providers.providersLoading}
          providers={providers.providers}
          showGithubForm={providers.showGithubForm}
          showGiteaForm={providers.showGiteaForm}
          githubName={providers.githubName}
          githubAppId={providers.githubAppId}
          githubAppName={providers.githubAppName}
          githubPrivateKey={providers.githubPrivateKey}
          giteaName={providers.giteaName}
          giteaUrl={providers.giteaUrl}
          giteaClientId={providers.giteaClientId}
          giteaClientSecret={providers.giteaClientSecret}
          isProviderConnected={providers.isProviderConnected}
          onShowGithubForm={() => {
            providers.setShowGithubForm(true)
            providers.setShowGiteaForm(false)
          }}
          onShowGiteaForm={() => {
            providers.setShowGiteaForm(true)
            providers.setShowGithubForm(false)
          }}
          onCancelGithubForm={() => providers.setShowGithubForm(false)}
          onCancelGiteaForm={() => providers.setShowGiteaForm(false)}
          onGithubNameChange={providers.setGithubName}
          onGithubAppIdChange={providers.setGithubAppId}
          onGithubAppNameChange={providers.setGithubAppName}
          onGithubPrivateKeyChange={providers.setGithubPrivateKey}
          onGiteaNameChange={providers.setGiteaName}
          onGiteaUrlChange={providers.setGiteaUrl}
          onGiteaClientIdChange={providers.setGiteaClientId}
          onGiteaClientSecretChange={providers.setGiteaClientSecret}
          onConnectGithub={() => void providers.handleConnectGithub()}
          onConnectGitea={() => void providers.handleConnectGitea()}
          onDeleteProvider={(providerId) => void providers.handleDeleteProvider(providerId)}
          onClose={providers.closeProvidersModal}
        />

        <TeamModal
          open={teams.teamModalOpen}
          teamNameInput={teams.teamNameInput}
          onTeamNameChange={teams.setTeamNameInput}
          onUpdateTeamName={teams.handleUpdateTeamName}
          teamMembers={teams.teamMembers}
          teamInvites={teams.teamInvites}
          isTeamOwner={teams.isTeamOwner}
          inviteEmail={teams.inviteEmail}
          onInviteEmailChange={teams.setInviteEmail}
          onInviteMember={teams.handleInviteMember}
          onRemoveMember={(userId) => void teams.handleRemoveMember(userId)}
          onUpdateAccessLevel={(userId, level) => void teams.handleUpdateAccessLevel(userId, level)}
          onCancelInvite={(inviteId) => void teams.handleCancelInvite(inviteId)}
          onClose={teams.closeTeamModal}
        />

        <SavedModal
          open={savedHook.savedModalOpen}
          loading={savedHook.savedLoading}
          saved={savedHook.saved}
          viewingId={savedHook.viewingId}
          onView={savedHook.setViewingId}
          onUnsave={savedHook.handleUnsave}
          onClose={savedHook.closeSavedModal}
        />

        {!auth.session ? (
          <LoginNotice onLogin={() => auth.openAuthModal('login')} onSignup={() => auth.openAuthModal('signup')} />
        ) : (
          <>
            <ProjectList
              projectsLoading={projects.projectsLoading}
              projects={projects.projects}
              selectedProjectId={projects.selectedProjectId}
              userAccessLevel={teams.userAccessLevel}
              savedCount={savedHook.saved.length}
              demoAvailable={projects.demoAvailable}
              demoLoading={projects.demoLoading}
              onSelectProject={(project) => void projects.handleSelectProject(project)}
              onOpenAddProject={() => void projects.openAddProjectModal()}
              onOpenSaved={() => void savedHook.openSavedModal()}
              onCreateDemo={() => void projects.handleCreateDemo()}
              onSyncProject={(projectId) => void projects.handleSyncProject(projectId)}
              onEditProject={(projectId) => void projects.openEditProjectModal(projectId)}
              onDeleteProject={(projectId) => void projects.handleDeleteProject(projectId)}
            />

            <ConversationSection
              selectedProjectId={projects.selectedProjectId}
              selectedProjectName={projects.selectedProjectName}
              chatContainerRef={projects.chatContainerRef}
              historyLoading={projects.historyLoading}
              chatMessages={projects.chatMessages}
              chatLoading={projects.chatLoading}
              questionInput={projects.questionInput}
              onQuestionInputChange={projects.setQuestionInput}
              questionInputRef={projects.questionInputRef}
              onAskQuestion={() => void projects.handleAskQuestion()}
              onCancelAsk={projects.handleCancelAsk}
              onClearHistory={() => void projects.handleClearHistory()}
              getAuthHeaders={auth.getAuthHeaders}
              questionSuggestions={projects.questionSuggestions}
              suggestionsLoading={projects.suggestionsLoading}
              showToast={showToast}
            />
          </>
        )}
      </div>

      <div className="footer">&copy; 2026 xGenie LLC | AskCode - AI-powered codebase Q&amp;A</div>

      <ConfirmDialog
        open={confirmOpen}
        message={confirmMessage}
        onCancel={() => closeConfirm(false)}
        onOk={() => closeConfirm(true)}
      />

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}
