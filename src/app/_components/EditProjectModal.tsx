'use client'

import type { EditRepoSelection, GitProvider, Project, ProjectRepo, ProviderRepo } from '../_types'
import { truncateUrl } from '../_lib/utils'

type EditProjectModalProps = {
  open: boolean
  editingProject: Project | null
  editingProjectRepos: ProjectRepo[]
  editTab: 'manual' | 'provider'
  onSelectManualTab: () => void
  onSelectProviderTab: () => void
  editGitUrl: string
  onEditGitUrlChange: (value: string) => void
  editBranch: string
  onEditBranchChange: (value: string) => void
  editName: string
  onEditNameChange: (value: string) => void
  onAddRepoManual: () => void
  connectedProviders: GitProvider[]
  editProviderId: string
  onEditProviderChange: (value: string) => void | Promise<void>
  editRepoSearch: string
  onEditRepoSearchChange: (value: string) => void
  filteredEditRepos: ProviderRepo[]
  editSelectedRepos: EditRepoSelection
  onToggleEditRepo: (repo: ProviderRepo, checked: boolean) => void
  onUpdateEditRepoBranch: (repoUrl: string, branch: string) => void
  onAddSelectedRepos: () => void
  onRemoveRepo: (repoUrl: string) => void
  onClose: () => void
}

export function EditProjectModal({
  open,
  editingProject,
  editingProjectRepos,
  editTab,
  onSelectManualTab,
  onSelectProviderTab,
  editGitUrl,
  onEditGitUrlChange,
  editBranch,
  onEditBranchChange,
  editName,
  onEditNameChange,
  onAddRepoManual,
  connectedProviders,
  editProviderId,
  onEditProviderChange,
  editRepoSearch,
  onEditRepoSearchChange,
  filteredEditRepos,
  editSelectedRepos,
  onToggleEditRepo,
  onUpdateEditRepoBranch,
  onAddSelectedRepos,
  onRemoveRepo,
  onClose
}: EditProjectModalProps) {
  if (!open || !editingProject) return null

  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-content" style={{ maxWidth: 600 }}>
        <div className="modal-title">Edit Project: {editingProject.name}</div>

        <div style={{ marginBottom: 15 }}>
          {editingProjectRepos.length > 0 ? (
            editingProjectRepos.map((repo) => (
              <div
                key={repo.url}
                style={{
                  padding: 8,
                  background: '#fff',
                  border: '1px solid #e0e0d8',
                  marginBottom: 5,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontFamily: 'monospace', fontSize: '9pt' }}>
                  {repo.name}: {truncateUrl(repo.url)} ({repo.branch})
                </span>
                {editingProjectRepos.length > 1 ? (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => onRemoveRepo(repo.url)}
                    style={{ color: '#c00', fontSize: '8pt' }}
                  >
                    remove
                  </button>
                ) : (
                  <span style={{ color: '#828282', fontSize: '8pt' }}>primary repo</span>
                )}
              </div>
            ))
          ) : (
            <div
              style={{
                padding: 8,
                background: '#fff',
                border: '1px solid #e0e0d8',
                marginBottom: 5,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontFamily: 'monospace', fontSize: '9pt' }}>
                {truncateUrl(editingProject.gitUrl)} ({editingProject.branch || 'main'})
              </span>
              <span style={{ color: '#828282', fontSize: '8pt' }}>primary repo</span>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #e0e0d8', paddingTop: 15, marginTop: 15 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 10 }}>Add Repository</div>

          <div className="tabs" style={{ marginBottom: 10 }}>
            <div className={`tab ${editTab === 'manual' ? 'active' : ''}`} onClick={onSelectManualTab}>
              Manual URL
            </div>
            <div className={`tab ${editTab === 'provider' ? 'active' : ''}`} onClick={onSelectProviderTab}>
              From Provider
            </div>
          </div>

          <div className={`tab-content ${editTab === 'manual' ? 'active' : ''}`}>
            <div className="form-row">
              <span className="form-label">git url:</span>
              <input
                type="text"
                className="form-input"
                placeholder="https://github.com/org/repo.git"
                style={{ width: 350 }}
                value={editGitUrl}
                onChange={(event) => onEditGitUrlChange(event.target.value)}
              />
            </div>
            <div className="form-row">
              <span className="form-label">branch:</span>
              <input
                type="text"
                className="form-input"
                placeholder="main"
                style={{ width: 150 }}
                value={editBranch}
                onChange={(event) => onEditBranchChange(event.target.value)}
              />
            </div>
            <div className="form-row">
              <span className="form-label">name:</span>
              <input
                type="text"
                className="form-input"
                placeholder="repo-name (for subdirectory)"
                style={{ width: 200 }}
                value={editName}
                onChange={(event) => onEditNameChange(event.target.value)}
              />
            </div>
            <div className="form-actions" style={{ marginLeft: 100 }}>
              <button type="button" className="submit-btn" onClick={onAddRepoManual}>
                add repo
              </button>
            </div>
          </div>

          <div className={`tab-content ${editTab === 'provider' ? 'active' : ''}`}>
            <div className="form-row">
              <span className="form-label">provider:</span>
              <select
                className="form-input"
                style={{ width: 250 }}
                value={editProviderId}
                onChange={(event) => void onEditProviderChange(event.target.value)}
              >
                <option value="">-- select provider --</option>
                {connectedProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.provider} - {provider.account_name || provider.name}
                  </option>
                ))}
              </select>
            </div>

            {editProviderId ? (
              <div>
                <div className="form-row">
                  <span className="form-label">search:</span>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="filter repos..."
                    style={{ width: 250 }}
                    value={editRepoSearch}
                    onChange={(event) => onEditRepoSearchChange(event.target.value)}
                  />
                </div>
                <div className="repo-list" style={{ maxHeight: 200 }}>
                  {filteredEditRepos.length === 0 ? (
                    <div style={{ padding: 10, color: '#828282' }}>No repositories available.</div>
                  ) : (
                    filteredEditRepos.map((repo) => {
                      const isChecked = !!editSelectedRepos[repo.clone_url]
                      const selectedBranch =
                        editSelectedRepos[repo.clone_url]?.branch || repo.default_branch
                      return (
                        <div key={repo.clone_url} className="repo-item">
                          <label style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) => onToggleEditRepo(repo, event.target.checked)}
                            />
                            <span className="repo-name">{repo.full_name}</span>
                            {repo.private ? <span className="repo-private">(private)</span> : null}
                          </label>
                          {isChecked ? (
                            <select
                              className="branch-select"
                              style={{ fontSize: '9pt', width: 100 }}
                              value={selectedBranch}
                              onChange={(event) =>
                                onUpdateEditRepoBranch(repo.clone_url, event.target.value)
                              }
                            >
                              <option value={repo.default_branch}>{repo.default_branch}</option>
                            </select>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
                <div className="form-actions" style={{ marginLeft: 0 }}>
                  <button type="button" className="submit-btn" onClick={() => void onAddSelectedRepos()}>
                    add selected
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className="form-actions"
          style={{ marginLeft: 0, marginTop: 20, borderTop: '1px solid #e0e0d8', paddingTop: 15 }}
        >
          <button type="button" className="submit-btn" onClick={onClose}>
            done
          </button>
        </div>
      </div>
    </div>
  )
}
