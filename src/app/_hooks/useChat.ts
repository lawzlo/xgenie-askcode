'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Message, Project, Session, ToastType } from '../_types'
import { apiRequest } from '../_lib/api'

type UseChatParams = {
  session: Session | null
  currentTeamId: string | null
  projects: Project[]
  getAuthHeaders: () => Record<string, string>
  clearSession: () => void
  showToast: (message: string, type?: ToastType, duration?: number) => void
  showConfirm: (message: string) => Promise<boolean>
  initialProjectId?: string | null
  onSelectedProjectChange?: (projectId: string | null) => void
}

export function useChat({
  session,
  currentTeamId,
  projects,
  getAuthHeaders,
  clearSession,
  showToast,
  showConfirm,
  initialProjectId,
  onSelectedProjectChange
}: UseChatParams) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedProjectName, setSelectedProjectName] = useState('')
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatStatusText, setChatStatusText] = useState('')
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [questionInput, setQuestionInput] = useState('')
  const [questionSuggestions, setQuestionSuggestions] = useState<string[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const chatContainerRef = useRef<HTMLDivElement>(null)
  const questionInputRef = useRef<HTMLTextAreaElement>(null)
  const selectedProjectIdRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Only reset when user or team actually changes, not on token refresh
  const userId = session?.user?.id
  useEffect(() => {
    setSelectedProjectId(null)
    setSelectedProjectName('')
    setChatMessages([])
    if (onSelectedProjectChange) onSelectedProjectChange(null)
  }, [userId, currentTeamId, onSelectedProjectChange])

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedProjectName('')
      return
    }
    const project = projects.find((item) => item.id === selectedProjectId)
    if (!project) {
      setSelectedProjectId(null)
      setSelectedProjectName('')
      setChatMessages([])
      return
    }
    setSelectedProjectName(project.name)
  }, [projects, selectedProjectId])

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId
  }, [selectedProjectId])

  const loadHistory = useCallback(
    async (projectId: string) => {
      const headers = getAuthHeaders()
      // Don't make request if auth headers are incomplete
      if (!headers.Authorization || !headers['X-Team-Id']) {
        return
      }
      setHistoryLoading(true)
      try {
        const data = await apiRequest<{ messages: Message[] }>(`/api/ask/${projectId}/history`, {
          headers,
          onUnauthorized: clearSession
        })
        setChatMessages(data.messages || [])
      } catch (err) {
        if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
          return
        }
        const message = err instanceof Error ? err.message : 'Failed to load conversation history'
        showToast(message, 'error')
      } finally {
        setHistoryLoading(false)
      }
    },
    [clearSession, getAuthHeaders, showToast]
  )

  const loadSuggestions = useCallback(
    async (projectId: string) => {
      const headers = getAuthHeaders()
      // Don't make request if auth headers are incomplete
      if (!headers.Authorization || !headers['X-Team-Id']) {
        return
      }
      setSuggestionsLoading(true)
      setQuestionSuggestions([])
      try {
        const data = await apiRequest<{ suggestions: string[] }>(
          `/api/projects/${projectId}/suggestions`,
          { headers, onUnauthorized: clearSession }
        )
        setQuestionSuggestions(data.suggestions || [])
      } catch {
        // Silently fail - suggestions are optional
      } finally {
        setSuggestionsLoading(false)
      }
    },
    [clearSession, getAuthHeaders]
  )

  const handleSelectProject = useCallback(
    async (project: Project) => {
      setSelectedProjectId(project.id)
      setSelectedProjectName(project.name)
      setQuestionInput('')
      setChatMessages([])
      setQuestionSuggestions([])
      if (onSelectedProjectChange) onSelectedProjectChange(project.id)
      await loadHistory(project.id)
      void loadSuggestions(project.id)
      questionInputRef.current?.focus()
    },
    [loadHistory, loadSuggestions, onSelectedProjectChange]
  )

  const handleProjectDeleted = useCallback(
    (projectId: string) => {
      if (selectedProjectId !== projectId) return
      setSelectedProjectId(null)
      setSelectedProjectName('')
      setChatMessages([])
      if (onSelectedProjectChange) onSelectedProjectChange(null)
    },
    [onSelectedProjectChange, selectedProjectId]
  )

  const handleClearHistory = useCallback(async () => {
    if (!selectedProjectId) return
    const confirmed = await showConfirm('Clear conversation history?')
    if (!confirmed) return
    try {
      await apiRequest(`/api/ask/${selectedProjectId}/history`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        onUnauthorized: clearSession
      })
      setChatMessages([])
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to clear conversation history'
      showToast(message, 'error')
    }
  }, [clearSession, getAuthHeaders, selectedProjectId, showConfirm, showToast])

  const handleAskQuestion = useCallback(async () => {
    if (!selectedProjectId || chatLoading) return
    const trimmedQuestion = questionInput.trim()
    if (!trimmedQuestion) return

    const activeProjectId = selectedProjectId
    const timestamp = new Date().toISOString()
    const pendingIndex = chatMessages.length

    setQuestionInput('')
    setChatMessages((prev) => [
      ...prev,
      {
        question: trimmedQuestion,
        answer: '',
        filesRead: [],
        timestamp
      }
    ])
    setChatLoading(true)
    setChatStatusText('Thinking...')
    setCompletedSteps([])

    abortControllerRef.current = new AbortController()

    try {
      const headers = getAuthHeaders()
      const response = await fetch(`/api/ask/${activeProjectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({ question: trimmedQuestion }),
        signal: abortControllerRef.current.signal
      })

      if (response.status === 401) {
        clearSession()
        return
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get answer')
      }

      // Handle SSE stream
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6)
            try {
              const event = JSON.parse(jsonStr)

              if (event.type === 'status') {
                setChatStatusText(event.message)
              } else if (event.type === 'step_complete') {
                setCompletedSteps((prev) => [...prev, event.message])
              } else if (event.type === 'complete') {
                if (selectedProjectIdRef.current !== activeProjectId) return

                setChatMessages((prev) =>
                  prev.map((message, index) =>
                    index === pendingIndex
                      ? {
                          ...message,
                          id: event.data.id,
                          answer: event.data.answer,
                          filesRead: event.data.filesRead
                        }
                      : message
                  )
                )

                // Update suggestions with follow-up questions
                if (event.data.followUpSuggestions && event.data.followUpSuggestions.length > 0) {
                  setQuestionSuggestions(event.data.followUpSuggestions)
                }
              } else if (event.type === 'error') {
                throw new Error(event.message)
              }
            } catch (parseErr) {
              console.error('Failed to parse SSE event:', parseErr)
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, reload history to remove pending message
        await loadHistory(activeProjectId)
        return
      }
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to get answer'
      showToast(message, 'error')
      await loadHistory(activeProjectId)
    } finally {
      abortControllerRef.current = null
      setChatLoading(false)
      setChatStatusText('')
      setCompletedSteps([])
      questionInputRef.current?.focus()
    }
  }, [
    chatMessages.length,
    chatLoading,
    clearSession,
    getAuthHeaders,
    loadHistory,
    questionInput,
    selectedProjectId,
    showToast
  ])

  useEffect(() => {
    if (!initialProjectId || initialProjectId === selectedProjectId) return
    const project = projects.find((item) => item.id === initialProjectId)
    if (project) {
      void handleSelectProject(project)
    }
  }, [handleSelectProject, initialProjectId, projects, selectedProjectId])

  useEffect(() => {
    if (initialProjectId || !selectedProjectId) return
    setSelectedProjectId(null)
    setSelectedProjectName('')
    setChatMessages([])
    setQuestionInput('')
    setQuestionSuggestions([])
    if (onSelectedProjectChange) onSelectedProjectChange(null)
  }, [initialProjectId, onSelectedProjectChange, selectedProjectId])

  const handleCancelAsk = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  useEffect(() => {
    const container = chatContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [chatMessages, chatLoading, historyLoading])

  return {
    selectedProjectId,
    selectedProjectName,
    chatMessages,
    chatLoading,
    chatStatusText,
    completedSteps,
    historyLoading,
    questionInput,
    questionSuggestions,
    suggestionsLoading,
    chatContainerRef,
    questionInputRef,
    handleSelectProject,
    handleProjectDeleted,
    handleClearHistory,
    handleAskQuestion,
    handleCancelAsk,
    setQuestionInput
  }
}
