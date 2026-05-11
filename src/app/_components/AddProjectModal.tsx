'use client'

import { useState, type FormEvent } from 'react'
import type { GitProvider, Project, ProviderRepo, ProviderSelection, SavedCredential } from '../_types'
import { inferCredentialName } from '../_hooks/useProjectEditor'
import { normalizeGitUrl } from '../_lib/utils'

type AddProjectModalProps = {
  open: boolean
  addTab: 'manual' | 'provider'
  onSelectManualTab: () => void
  onSelectProviderTab: () => void
  projects: Project[]
  addToProjectId: string
  onAddToProjectChange: (value: string) => void
  providerAddToProjectId: string
  onProviderAddToProjectChange: (value: string) => void
  projectName: string
  onProjectNameChange: (value: string) => void
  gitUrl: string
  onGitUrlChange: (value: string) => void
  gitBranch: string
  onGitBranchChange: (value: string) => void
  isPrivateRepo: boolean
  onPrivateRepoChange: (checked: boolean) => void
  gitToken: string
  onGitTokenChange: (value: string) => void
  credentialMode: 'saved' | 'new'
  onCredentialModeChange: (mode: 'saved' | 'new') => void
  selectedCredentialId: string
  onSelectedCredentialChange: (id: string) => void
  newCredentialName: string
  onNewCredentialNameChange: (value: string) => void
  savedCredentials: SavedCredential[]
  addProjectLoading: boolean
  onSubmitAddProject: (event: FormEvent<HTMLFormElement>) => void
  connectedProviders: GitProvider[]
  providerSelectId: string
  onProviderSelectChange: (value: string) => void | Promise<void>
  providerRepoSearch: string
  onProviderRepoSearchChange: (value: string) => void
  providerReposLoading: boolean
  providerRepos: ProviderRepo[]
  filteredProviderRepos: ProviderRepo[]
  providerSelectedRepos: ProviderSelection
  branchCache: Record<string, string[]>
  onToggleProviderRepo: (repo: ProviderRepo, checked: boolean) => void
  onUpdateProviderRepoBranch: (repoUrl: string, branch: string) => void
  onImportSelectedRepos: () => void
  onOpenProvidersFromAdd: () => void
  onClose: () => void
}

export function AddProjectModal({
  open,
  addTab,
  onSelectManualTab,
  onSelectProviderTab,
  projects,
  addToProjectId,
  onAddToProjectChange,
  providerAddToProjectId,
  onProviderAddToProjectChange,
  projectName,
  onProjectNameChange,
  gitUrl,
  onGitUrlChange,
  gitBranch,
  onGitBranchChange,
  isPrivateRepo,
  onPrivateRepoChange,
  gitToken,
  onGitTokenChange,
  credentialMode,
  onCredentialModeChange,
  selectedCredentialId,
  onSelectedCredentialChange,
  newCredentialName,
  onNewCredentialNameChange,
  savedCredentials,
  addProjectLoading,
  onSubmitAddProject,
  connectedProviders,
  providerSelectId,
  onProviderSelectChange,
  providerRepoSearch,
  onProviderRepoSearchChange,
  providerReposLoading,
  providerRepos,
  filteredProviderRepos,
  providerSelectedRepos,
  branchCache,
  onToggleProviderRepo,
  onUpdateProviderRepoBranch,
  onImportSelectedRepos,
  onOpenProvidersFromAdd,
  onClose
}: AddProjectModalProps) {
  const [showToken, setShowToken] = useState(false)
  if (!open) return null

  const providerTargetProject = providerAddToProjectId
    ? projects.find((project) => project.id === providerAddToProjectId) || null
    : null
  const existingProviderRepoUrls = new Set<string>()
  if (providerTargetProject) {
    providerTargetProject.gitUrls?.forEach((repo) => existingProviderRepoUrls.add(normalizeGitUrl(repo.url)))
    if (providerTargetProject.gitUrl) {
      existingProviderRepoUrls.add(normalizeGitUrl(providerTargetProject.gitUrl))
    }
  }
  const visibleProviderRepos = filteredProviderRepos.filter(
    (repo) => !existingProviderRepoUrls.has(normalizeGitUrl(repo.clone_url))
  )
  const hiddenProviderRepoCount = filteredProviderRepos.length - visibleProviderRepos.length

  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-content" style={{ maxWidth: 600 }}>
        <div className="modal-title">Add New Project</div>

        <div className="tabs">
          <div className={`tab ${addTab === 'manual' ? 'active' : ''}`} onClick={onSelectManualTab}>
            Manual URL
          </div>
          <div className={`tab ${addTab === 'provider' ? 'active' : ''}`} onClick={onSelectProviderTab}>
            From Provider
          </div>
        </div>

        <div className={`tab-content ${addTab === 'manual' ? 'active' : ''}`}>
          <form onSubmit={onSubmitAddProject}>
            <div className="form-row">
              <span className="form-label">add to:</span>
              <select
                className="form-input"
                style={{ width: 300 }}
                value={addToProjectId}
                onChange={(event) => onAddToProjectChange(event.target.value)}
              >
                <option value="">-- create new project --</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {!addToProjectId ? (
              <div className="form-row">
                <span className="form-label">name:</span>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="my-project"
                  value={projectName}
                  onChange={(event) => onProjectNameChange(event.target.value)}
                />
              </div>
            ) : null}

            <div className="form-row">
              <span className="form-label">git url:</span>
              <input
                type="text"
                className="form-input"
                required
                placeholder="https://github.com/org/repo.git or any Git URL"
                value={gitUrl}
                onChange={(event) => onGitUrlChange(event.target.value)}
              />
            </div>
            <div className="form-row">
              <span className="form-label">branch:</span>
              <input
                type="text"
                className="form-input"
                placeholder="main (optional)"
                value={gitBranch}
                onChange={(event) => onGitBranchChange(event.target.value)}
              />
            </div>
            <div className="form-checkbox">
              <input
                type="checkbox"
                checked={isPrivateRepo}
                onChange={(event) => onPrivateRepoChange(event.target.checked)}
              />
              <label>private repository</label>
            </div>
            {isPrivateRepo ? (
              <div className="credentials">
                {savedCredentials.length > 0 && credentialMode === 'saved' ? (
                  <>
                    <div className="form-row">
                      <span className="form-label">token:</span>
                      <select
                        className="form-input"
                        value={selectedCredentialId}
                        onChange={(event) => {
                          const val = event.target.value
                          if (val === '__new__') {
                            onCredentialModeChange('new')
                            onSelectedCredentialChange('')
                          } else {
                            onSelectedCredentialChange(val)
                          }
                        }}
                      >
                        <option value="">-- select saved token --</option>
                        {savedCredentials.map((cred) => (
                          <option key={cred.id} value={cred.id}>
                            {cred.name}
                          </option>
                        ))}
                        <option value="__new__">enter new token...</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-row">
                      <span className="form-label">token:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                        <input
                          type={showToken ? 'text' : 'password'}
                          className="form-input"
                          placeholder="personal access token"
                          value={gitToken}
                          onChange={(event) => onGitTokenChange(event.target.value)}
                          style={{ flex: 1 }}
                        />
                        <span
                          className="link-button"
                          style={{ fontSize: '8pt', whiteSpace: 'nowrap' }}
                          onClick={() => setShowToken(!showToken)}
                        >
                          {showToken ? 'hide' : 'show'}
                        </span>
                      </div>
                    </div>
                    {savedCredentials.length > 0 ? (
                      <div style={{ marginBottom: 6 }}>
                        <span
                          className="link-button"
                          style={{ fontSize: '8pt' }}
                          onClick={() => {
                            onCredentialModeChange('saved')
                            onGitTokenChange('')
                          }}
                        >
                          &larr; use saved token
                        </span>
                      </div>
                    ) : null}
                    <div className="form-row">
                      <span className="form-label">save as:</span>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={inferCredentialName(gitUrl) || 'e.g. github.com - myorg'}
                        value={newCredentialName}
                        onChange={(event) => onNewCredentialNameChange(event.target.value)}
                      />
                    </div>
                    <div className="credentials-hint">
                      Use a personal access token from your Git provider (GitHub, GitLab, Bitbucket, etc.)
                    </div>
                  </>
                )}
              </div>
            ) : null}
            <div className="form-actions">
              <button type="submit" className="submit-btn" disabled={addProjectLoading}>
                {addProjectLoading ? 'adding...' : 'add'}
              </button>
              <span className="cancel-link" onClick={onClose}>
                cancel
              </span>
            </div>
          </form>
        </div>

        <div className={`tab-content ${addTab === 'provider' ? 'active' : ''}`}>
          <div className="form-row">
            <span className="form-label">add to:</span>
            <select
              className="form-input"
              style={{ width: 300 }}
              value={providerAddToProjectId}
              onChange={(event) => onProviderAddToProjectChange(event.target.value)}
            >
              <option value="">-- create new project --</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {!providerAddToProjectId ? (
            <div className="form-row">
              <span className="form-label">project name:</span>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. My Project"
                style={{ width: 300 }}
                value={projectName}
                onChange={(event) => onProjectNameChange(event.target.value)}
              />
            </div>
          ) : null}

          <div className="form-row">
            <span className="form-label">provider:</span>
            <select
              className="form-input"
              style={{ width: 300 }}
              value={providerSelectId}
              onChange={(event) => void onProviderSelectChange(event.target.value)}
            >
              <option value="">-- select provider --</option>
              {connectedProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.provider} - {provider.account_name || provider.name}
                </option>
              ))}
            </select>
          </div>

          {connectedProviders.length === 0 ? (
            <div style={{ color: '#828282', padding: '20px 0' }}>
              No providers connected.{' '}
              <button type="button" className="link-button" onClick={onOpenProvidersFromAdd}>
                Add one
              </button>{' '}
              first.
            </div>
          ) : null}

          {providerSelectId ? (
            <div style={{ marginTop: 10 }}>
              <div className="form-row">
                <span className="form-label">search:</span>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: 300 }}
                  placeholder="filter repos..."
                  value={providerRepoSearch}
                  onChange={(event) => onProviderRepoSearchChange(event.target.value)}
                />
              </div>
              <p style={{ color: '#828282', fontSize: '8pt', margin: '5px 0 10px 0' }}>
                Select repos to include in this project. AI will search across all selected repos.
              </p>
              {providerAddToProjectId && hiddenProviderRepoCount > 0 ? (
                <p style={{ color: '#828282', fontSize: '8pt', margin: '0 0 10px 0' }}>
                  {hiddenProviderRepoCount} repo(s) already in this project are hidden.
                </p>
              ) : null}
              <div className="repo-list">
                {providerReposLoading ? (
                  <div style={{ padding: 10, color: '#828282' }}>Loading repositories...</div>
                ) : null}
                {!providerReposLoading && providerRepos.length === 0 ? (
                  <div style={{ padding: 10, color: '#828282' }}>No repositories found.</div>
                ) : null}
                {!providerReposLoading && providerRepos.length > 0 && visibleProviderRepos.length === 0 ? (
                  <div style={{ padding: 10, color: '#828282' }}>
                    {providerAddToProjectId
                      ? 'All matching repositories are already in this project.'
                      : 'No repositories found.'}
                  </div>
                ) : null}
                {!providerReposLoading
                  ? visibleProviderRepos.map((repo) => {
                      const isChecked = !!providerSelectedRepos[repo.clone_url]
                      const owner = repo.owner?.login || ''
                      const cacheKey = `${owner}/${repo.name}`
                      const branches = branchCache[cacheKey] || [repo.default_branch]
                      const selectedBranch =
                        providerSelectedRepos[repo.clone_url]?.branch || repo.default_branch
                      return (
                        <div key={repo.clone_url} className="repo-item">
                          <label style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) => onToggleProviderRepo(repo, event.target.checked)}
                            />
                            <span className="repo-name">{repo.full_name}</span>
                            {repo.private ? <span className="repo-private">(private)</span> : null}
                          </label>
                          {isChecked ? (
                            <select
                              className="branch-select"
                              style={{ fontSize: '9pt', width: 120 }}
                              value={selectedBranch}
                              onChange={(event) =>
                                onUpdateProviderRepoBranch(repo.clone_url, event.target.value)
                              }
                            >
                              {branches.map((branch) => (
                                <option key={branch} value={branch}>
                                  {branch}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      )
                    })
                  : null}
              </div>

              <div className="form-actions" style={{ marginLeft: 0 }}>
                <button
                  type="button"
                  className="submit-btn"
                  onClick={() => void onImportSelectedRepos()}
                  disabled={addProjectLoading}
                >
                  {addProjectLoading
                    ? providerAddToProjectId
                      ? 'adding repos...'
                      : 'creating project...'
                    : providerAddToProjectId
                    ? 'add repos'
                    : 'create project'}
                </button>
                <span className="cancel-link" onClick={onClose}>
                  cancel
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
