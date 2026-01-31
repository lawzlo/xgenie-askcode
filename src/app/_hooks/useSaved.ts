'use client'

import { useState, useCallback } from 'react'
import { apiRequest } from '../_lib/api'

type SavedConversation = {
  id: string
  savedAt: string
  conversationId: string
  question: string
  answer: string
  createdAt: string
  projectName: string
}

type UseSavedProps = {
  getAuthHeaders: () => HeadersInit
  showToast: (message: string, type?: 'success' | 'error') => void
}

export function useSaved({ getAuthHeaders, showToast }: UseSavedProps) {
  const [savedModalOpen, setSavedModalOpen] = useState(false)
  const [savedLoading, setSavedLoading] = useState(false)
  const [saved, setSaved] = useState<SavedConversation[]>([])
  const [viewingId, setViewingId] = useState<string | null>(null)

  const loadSaved = useCallback(async () => {
    setSavedLoading(true)
    try {
      const data = await apiRequest<SavedConversation[]>('/api/saved-conversations', {
        headers: getAuthHeaders()
      })
      setSaved(data)
    } catch (err) {
      console.error('Failed to load saved:', err)
    } finally {
      setSavedLoading(false)
    }
  }, [getAuthHeaders])

  const openSavedModal = useCallback(async () => {
    setSavedModalOpen(true)
    setViewingId(null)
    await loadSaved()
  }, [loadSaved])

  const closeSavedModal = useCallback(() => {
    setSavedModalOpen(false)
    setViewingId(null)
  }, [])

  const handleUnsave = useCallback(
    async (id: string) => {
      try {
        await apiRequest(`/api/saved-conversations/${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        })
        setSaved((prev) => prev.filter((s) => s.id !== id))
        showToast('Removed from saved', 'success')
      } catch (err) {
        console.error('Failed to unsave:', err)
        showToast('Failed to unsave', 'error')
      }
    },
    [getAuthHeaders, showToast]
  )

  return {
    savedModalOpen,
    savedLoading,
    saved,
    savedCount: saved.length,
    viewingId,
    setViewingId,
    openSavedModal,
    closeSavedModal,
    handleUnsave,
    loadSaved
  }
}
