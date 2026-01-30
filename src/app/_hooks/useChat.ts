'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Message, Project, Session, ToastType } from '../_types'

type UseChatParams = {
  session: Session | null
  currentTeamId: string | null
  projects: Project[]
  getAuthHeaders: () => Record<string, string>
  clearSession: () => void
  showToast: (message: string, type?: ToastType, duration?: number) => void
  showConfirm: (message: string) => Promise<boolean>
}

export function useChat({
  session,
  currentTeamId,
  projects,
  getAuthHeaders,
  clearSession,
  showToast,
  showConfirm
}: UseChatParams) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedProjectName, setSelectedProjectName] = useState('')
  const [chatMessages, setChatMessages] = useState<Message[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [questionInput, setQuestionInput] = useState('')
  const [questionSuggestions, setQuestionSuggestions] = useState<string[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  const chatContainerRef = useRef<HTMLDivElement>(null)
  const questionInputRef = useRef<HTMLTextAreaElement>(null)
  const selectedProjectIdRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setSelectedProjectId(null)
    setSelectedProjectName('')
    setChatMessages([])
  }, [session, currentTeamId])

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
        const response = await fetch(`/api/ask/${projectId}/history`, { headers })
        if (response.status === 401) {
          clearSession()
          return
        }
        if (!response.ok) {
          throw new Error('Failed to load conversation history')
        }
        const data = (await response.json()) as { messages: Message[] }
        setChatMessages(data.messages || [])
      } catch (err) {
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
        const response = await fetch(`/api/projects/${projectId}/suggestions`, { headers })
        if (response.ok) {
          const data = (await response.json()) as { suggestions: string[] }
          setQuestionSuggestions(data.suggestions || [])
        }
      } catch {
        // Silently fail - suggestions are optional
      } finally {
        setSuggestionsLoading(false)
      }
    },
    [getAuthHeaders]
  )

  const handleSelectProject = useCallback(
    async (project: Project) => {
      setSelectedProjectId(project.id)
      setSelectedProjectName(project.name)
      setQuestionInput('')
      setChatMessages([])
      setQuestionSuggestions([])
      await loadHistory(project.id)
      void loadSuggestions(project.id)
      questionInputRef.current?.focus()
    },
    [loadHistory, loadSuggestions]
  )

  const handleProjectDeleted = useCallback(
    (projectId: string) => {
      if (selectedProjectId !== projectId) return
      setSelectedProjectId(null)
      setSelectedProjectName('')
      setChatMessages([])
    },
    [selectedProjectId]
  )

  const handleClearHistory = useCallback(async () => {
    if (!selectedProjectId) return
    const confirmed = await showConfirm('Clear conversation history?')
    if (!confirmed) return
    try {
      const response = await fetch(`/api/ask/${selectedProjectId}/history`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok) {
        throw new Error('Failed to clear conversation history')
      }
      setChatMessages([])
    } catch (err) {
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

    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch(`/api/ask/${activeProjectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ question: trimmedQuestion }),
        signal: abortControllerRef.current.signal
      })

      if (response.status === 401) {
        clearSession()
        return
      }

      if (!response.ok) {
        const data = (await response.json()) as { message?: string }
        throw new Error(data.message || 'Failed to get answer')
      }

      const data = (await response.json()) as {
        id?: string
        answer: string
        filesRead: string[]
        followUpSuggestions?: string[]
      }
      if (selectedProjectIdRef.current !== activeProjectId) return

      setChatMessages((prev) =>
        prev.map((message, index) =>
          index === pendingIndex
            ? { ...message, id: data.id, answer: data.answer, filesRead: data.filesRead }
            : message
        )
      )

      // Update suggestions with follow-up questions
      if (data.followUpSuggestions && data.followUpSuggestions.length > 0) {
        setQuestionSuggestions(data.followUpSuggestions)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, reload history to remove pending message
        await loadHistory(activeProjectId)
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to get answer'
      showToast(message, 'error')
      await loadHistory(activeProjectId)
    } finally {
      abortControllerRef.current = null
      setChatLoading(false)
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
