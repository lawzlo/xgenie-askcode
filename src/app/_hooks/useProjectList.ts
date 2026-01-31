'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Project, Session, ToastType } from '../_types'
import { apiRequest } from '../_lib/api'

type UseProjectListParams = {
  session: Session | null
  currentTeamId: string | null
  getAuthHeaders: () => Record<string, string>
  clearSession: () => void
  showToast: (message: string, type?: ToastType, duration?: number) => void
  showConfirm: (message: string) => Promise<boolean>
}

export function useProjectList({
  session,
  currentTeamId,
  getAuthHeaders,
  clearSession,
  showToast,
  showConfirm
}: UseProjectListParams) {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [demoAvailable, setDemoAvailable] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Check if demo template is available
  useEffect(() => {
    async function checkDemo() {
      try {
        const data = await apiRequest<{ available?: boolean }>('/api/projects/demo')
        setDemoAvailable(data.available === true)
      } catch {
        setDemoAvailable(false)
      }
    }
    checkDemo()
  }, [])

  const loadProjects = useCallback(async (silent = false) => {
    if (!session || !currentTeamId) return
    if (!silent) setProjectsLoading(true)
    try {
      const data = await apiRequest<Project[]>('/api/projects', {
        headers: getAuthHeaders(),
        onUnauthorized: clearSession
      })
      setProjects(data)
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      if (!silent) {
        const message = err instanceof Error ? err.message : 'Failed to load projects'
        showToast(message, 'error')
      }
    } finally {
      if (!silent) setProjectsLoading(false)
    }
  }, [session, currentTeamId, getAuthHeaders, clearSession, showToast])

  useEffect(() => {
    if (!session || !currentTeamId) {
      setProjects([])
      return
    }
    void loadProjects()
  }, [session, currentTeamId, loadProjects])

  // Poll for updates when there are syncing projects
  useEffect(() => {
    const hasSyncingProjects = projects.some(
      (p) => p.syncStatus === 'syncing' || p.syncStatus === 'pending'
    )

    if (hasSyncingProjects) {
      // Poll every 3 seconds
      pollingRef.current = setInterval(() => {
        void loadProjects(true) // silent refresh
      }, 3000)
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [projects, loadProjects])

  const handleSyncProject = useCallback(
    async (projectId: string) => {
      try {
        await apiRequest(`/api/projects/${projectId}/sync`, {
          method: 'POST',
          headers: getAuthHeaders(),
          onUnauthorized: clearSession
        })
        await loadProjects()
      } catch (err) {
        if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
          return
        }
        const message = err instanceof Error ? err.message : 'Failed to sync project'
        showToast(message, 'error')
      }
    },
    [clearSession, getAuthHeaders, loadProjects, showToast]
  )

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      const confirmed = await showConfirm('Delete this project?')
      if (!confirmed) return false
      try {
        await apiRequest(`/api/projects/${projectId}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
          onUnauthorized: clearSession
        })
        setProjects((prev) => prev.filter((project) => project.id !== projectId))
        return true
      } catch (err) {
        if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
          return false
        }
        const message = err instanceof Error ? err.message : 'Failed to delete project'
        showToast(message, 'error')
        return false
      }
    },
    [clearSession, getAuthHeaders, showConfirm, showToast]
  )

  const handleCreateDemo = useCallback(async () => {
    if (!session || !currentTeamId) return
    setDemoLoading(true)
    try {
      await apiRequest('/api/projects/demo', {
        method: 'POST',
        headers: getAuthHeaders(),
        onUnauthorized: clearSession
      })
      showToast('Demo project created!', 'success')
      await loadProjects()
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 409) {
        showToast('Demo project already exists', 'error')
        return
      }
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to create demo project'
      showToast(message, 'error')
    } finally {
      setDemoLoading(false)
    }
  }, [session, currentTeamId, getAuthHeaders, clearSession, showToast, loadProjects])

  return {
    projects,
    projectsLoading,
    demoAvailable,
    demoLoading,
    loadProjects,
    handleSyncProject,
    handleDeleteProject,
    handleCreateDemo
  }
}
