'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SavedCredential, Session, ToastType } from '../_types'
import { apiRequest } from '../_lib/api'

type UseSavedCredentialsParams = {
  session: Session | null
  currentTeamId: string | null
  getAuthHeaders: () => Record<string, string>
  clearSession: () => void
  showToast: (message: string, type?: ToastType, duration?: number) => void
}

export function useSavedCredentials({
  session,
  currentTeamId,
  getAuthHeaders,
  clearSession,
  showToast
}: UseSavedCredentialsParams) {
  const [savedCredentials, setSavedCredentials] = useState<SavedCredential[]>([])
  const [savedCredentialsLoading, setSavedCredentialsLoading] = useState(false)

  const loadSavedCredentials = useCallback(async () => {
    if (!session || !currentTeamId) {
      setSavedCredentials([])
      return
    }
    setSavedCredentialsLoading(true)
    try {
      const data = await apiRequest<SavedCredential[]>('/api/saved-credentials', {
        headers: getAuthHeaders(),
        onUnauthorized: clearSession
      })
      setSavedCredentials(data)
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      console.error('Failed to load saved credentials:', err)
    } finally {
      setSavedCredentialsLoading(false)
    }
  }, [clearSession, currentTeamId, getAuthHeaders, session])

  const createSavedCredential = useCallback(async (name: string, platform: string, token: string): Promise<SavedCredential | null> => {
    try {
      const data = await apiRequest<SavedCredential>('/api/saved-credentials', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: { name, platform, token },
        onUnauthorized: clearSession
      })
      setSavedCredentials(prev => [data, ...prev])
      return data
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return null
      }
      const message = err instanceof Error ? err.message : 'Failed to save credential'
      showToast(message, 'error')
      return null
    }
  }, [clearSession, getAuthHeaders, showToast])

  const deleteSavedCredential = useCallback(async (id: string) => {
    try {
      await apiRequest(`/api/saved-credentials/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        onUnauthorized: clearSession
      })
      setSavedCredentials(prev => prev.filter(c => c.id !== id))
      showToast('Credential deleted', 'success')
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to delete credential'
      showToast(message, 'error')
    }
  }, [clearSession, getAuthHeaders, showToast])

  useEffect(() => {
    setSavedCredentials([])
  }, [currentTeamId])

  return {
    savedCredentials,
    savedCredentialsLoading,
    loadSavedCredentials,
    createSavedCredential,
    deleteSavedCredential
  }
}
