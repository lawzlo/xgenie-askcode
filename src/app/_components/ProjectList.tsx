'use client'

import type { Project } from '../_types'
import { timeAgo, truncateUrl } from '../_lib/utils'

type ProjectListProps = {
  projectsLoading: boolean
  projects: Project[]
  selectedProjectId: string | null
  userAccessLevel: number
  savedCount: number
  demoAvailable: boolean
  demoLoading: boolean
  onSelectProject: (project: Project) => void
  onOpenAddProject: () => void
  onOpenSaved: () => void
  onCreateDemo: () => void
  onSyncProject: (projectId: string) => void
  onEditProject: (projectId: string) => void
  onDeleteProject: (projectId: string) => void
}

export function ProjectList({
  projectsLoading,
  projects,
  selectedProjectId,
  userAccessLevel,
  savedCount,
  demoAvailable,
  demoLoading,
  onSelectProject,
  onOpenAddProject,
  onOpenSaved,
  onCreateDemo,
  onSyncProject,
  onEditProject,
  onDeleteProject
}: ProjectListProps) {
  const isFullAccess = userAccessLevel >= 100
  return (
    <div className="project-list">
      {projectsLoading ? (
        <div className="empty-state">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <div>No projects yet.</div>
          {demoAvailable && (
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                onClick={onCreateDemo}
                disabled={demoLoading}
                style={{
                  background: '#ff6600',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  cursor: demoLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {demoLoading ? 'Creating...' : 'Quick start with demo'}
              </button>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            or{' '}
            <button type="button" className="link-button" onClick={onOpenAddProject}>
              add your own project
            </button>
          </div>
        </div>
      ) : (
        projects.map((project, index) => {
          const isSyncing = project.syncStatus === 'syncing' || project.syncStatus === 'pending'
          const isError = project.syncStatus === 'error'
          const isDisabled = isSyncing

          return (
            <div key={project.id}>
              <div
                className={`project-item ${selectedProjectId === project.id ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => !isDisabled && onSelectProject(project)}
                style={isDisabled ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
              >
                <span className="project-num">{index + 1}.</span>
                <button
                  type="button"
                  disabled={isDisabled}
                  className={`project-name link-button ${
                    selectedProjectId === project.id ? 'selected-name' : ''
                  }`}
                  style={isDisabled ? { cursor: 'not-allowed' } : undefined}
                >
                  {project.name}
                </button>
                {isError && <span style={{ marginLeft: 8, color: '#c00', fontSize: '9pt' }}>sync failed</span>}
              </div>
              <div className="project-meta">
                {isFullAccess && (
                  <>
                    {project.gitUrls && project.gitUrls.length > 0 ? (
                      project.gitUrls.map((repo, repoIndex) => (
                        <div key={`${project.id}-${repoIndex}`}>
                          {truncateUrl(repo.url)} ({repo.branch})
                        </div>
                      ))
                    ) : (
                      <div>{truncateUrl(project.gitUrl)}</div>
                    )}
                  </>
                )}
                <div>
                  {timeAgo(project.lastSyncedAt)} |{' '}
                  <button
                    type="button"
                    className="link-button"
                    disabled={isSyncing}
                    style={isSyncing ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (!isSyncing) onSyncProject(project.id)
                    }}
                  >
                    {isSyncing ? 'syncing...' : 'sync'}
                  </button>
                  {isFullAccess && (
                    <>
                      {' '}|{' '}
                      <button
                        type="button"
                        className="link-button"
                        disabled={isDisabled}
                        style={isDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!isDisabled) onEditProject(project.id)
                        }}
                      >
                        edit
                      </button>{' '}
                      |{' '}
                      <button
                        type="button"
                        className="link-button"
                        disabled={isDisabled}
                        style={isDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!isDisabled) onDeleteProject(project.id)
                        }}
                      >
                        delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}

      <div className="project-list-footer">
        <button type="button" className="link-button" onClick={onOpenAddProject}>
          + add project
        </button>
        {' | '}
        <button type="button" className="link-button" onClick={onOpenSaved}>
          saved{savedCount > 0 ? ` (${savedCount})` : ''}
        </button>
      </div>
    </div>
  )
}
