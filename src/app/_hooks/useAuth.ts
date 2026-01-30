'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AuthMode, ResetSession, Session, Team, ToastType } from '../_types'
import { safeParseJson } from '../_lib/utils'

const STORAGE_KEYS = {
  session: 'askcode_session',
  teams: 'askcode_teams',
  currentTeam: 'askcode_current_team'
} as const

type UseAuthParams = {
  showToast: (message: string, type?: ToastType, duration?: number) => void
}

export function useAuth({ showToast }: UseAuthParams) {
  const [session, setSession] = useState<Session | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null)

  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const [forgotModalOpen, setForgotModalOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotError, setForgotError] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  const [resetSession, setResetSession] = useState<ResetSession | null>(null)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetTitle, setResetTitle] = useState('Set New Password')
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const authEmailRef = useRef<HTMLInputElement>(null)
  const forgotEmailRef = useRef<HTMLInputElement>(null)
  const resetPasswordRef = useRef<HTMLInputElement>(null)
  const resetTimerRef = useRef<number | null>(null)

  const openAuthModal = useCallback((mode: AuthMode) => {
    setAuthMode(mode)
    setAuthError('')
    setAuthEmail('')
    setAuthPassword('')
    setAuthModalOpen(true)
    setForgotModalOpen(false)
    setResetModalOpen(false)
  }, [])

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false)
    setAuthError('')
    setAuthEmail('')
    setAuthPassword('')
  }, [])

  const openForgotModal = useCallback(() => {
    setForgotEmail('')
    setForgotError('')
    setForgotSuccess('')
    setForgotModalOpen(true)
    setAuthModalOpen(false)
  }, [])

  const closeForgotModal = useCallback(() => {
    setForgotModalOpen(false)
    setForgotError('')
    setForgotSuccess('')
  }, [])

  const openResetModal = useCallback((title: string) => {
    setResetTitle(title)
    setResetPassword('')
    setResetConfirm('')
    setResetError('')
    setResetSuccess('')
    setResetModalOpen(true)
  }, [])

  const closeResetModal = useCallback(() => {
    setResetModalOpen(false)
    setResetError('')
    setResetSuccess('')
  }, [])

  const clearSession = useCallback((reason?: 'expired' | 'logout') => {
    setSession(null)
    setTeams([])
    setCurrentTeamId(null)
    setAuthModalOpen(false)
    setForgotModalOpen(false)
    setResetModalOpen(false)
    setAuthEmail('')
    setAuthPassword('')
    setAuthError('')
    setForgotEmail('')
    setForgotError('')
    setForgotSuccess('')
    setResetPassword('')
    setResetConfirm('')
    setResetError('')
    setResetSuccess('')
    setResetSession(null)
    localStorage.removeItem(STORAGE_KEYS.session)
    localStorage.removeItem(STORAGE_KEYS.teams)
    localStorage.removeItem(STORAGE_KEYS.currentTeam)
    if (reason === 'expired') {
      showToast('Session expired. Please log in again.', 'error')
    }
  }, [showToast])

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (!session) return {}
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.access_token}`
    }
    if (currentTeamId) {
      headers['X-Team-Id'] = currentTeamId
    }
    return headers
  }, [session, currentTeamId])

  // Refresh session using refresh_token
  const refreshSession = useCallback(async () => {
    if (!session?.refresh_token) return false

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      })

      if (!response.ok) {
        clearSession('expired')
        return false
      }

      const data = await response.json() as {
        session: { access_token: string; refresh_token: string }
        user: { id: string; email: string }
      }

      const newSession: Session = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: data.user
      }
      setSession(newSession)
      localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(newSession))
      return true
    } catch {
      clearSession()
      return false
    }
  }, [session?.refresh_token, clearSession])

  // Auto-refresh token every 50 minutes (JWT expires in 1 hour by default)
  useEffect(() => {
    if (!session?.refresh_token) return

    const refreshInterval = setInterval(() => {
      void refreshSession()
    }, 50 * 60 * 1000) // 50 minutes

    return () => clearInterval(refreshInterval)
  }, [session?.refresh_token, refreshSession])

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current)
        resetTimerRef.current = null
      }
    }
  }, [])

  // Handle email confirmation (signup) - auto login
  const handleSignupConfirmation = useCallback(
    async (accessToken: string, refreshToken?: string) => {
      try {
        // Fetch user info and teams
        const response = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` }
        })

        if (!response.ok) {
          showToast('Email confirmed! Please log in.', 'success')
          openAuthModal('login')
          return
        }

        const data = (await response.json()) as {
          user?: { id: string; email: string }
          teams: Team[]
        }

        if (!data.user) {
          showToast('Email confirmed! Please log in.', 'success')
          openAuthModal('login')
          return
        }

        const newSession: Session = {
          access_token: accessToken,
          refresh_token: refreshToken,
          user: { id: data.user.id, email: data.user.email }
        }

        setSession(newSession)
        setTeams(data.teams)
        localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(newSession))
        localStorage.setItem(STORAGE_KEYS.teams, JSON.stringify(data.teams))

        if (data.teams.length > 0) {
          setCurrentTeamId(data.teams[0].id)
          localStorage.setItem(STORAGE_KEYS.currentTeam, data.teams[0].id)
        }

        showToast('Email confirmed! Welcome!', 'success')
      } catch {
        showToast('Email confirmed! Please log in.', 'success')
        openAuthModal('login')
      }
    },
    [openAuthModal, showToast]
  )

  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token') || undefined
      const type = params.get('type')

      window.history.replaceState(null, '', window.location.pathname)

      // Signup confirmation: user already has password, just log them in
      if (accessToken && type === 'signup') {
        void handleSignupConfirmation(accessToken, refreshToken)
        return
      }

      // Recovery or invite: need to set/reset password
      if (accessToken && (type === 'recovery' || type === 'invite')) {
        setResetSession({ accessToken, refreshToken })
        openResetModal(type === 'recovery' ? 'Reset password' : 'Set your password')
        return
      }
    }

    const storedSession = safeParseJson<Session>(localStorage.getItem(STORAGE_KEYS.session))
    const storedTeams = safeParseJson<Team[]>(localStorage.getItem(STORAGE_KEYS.teams)) || []
    const storedTeamId = localStorage.getItem(STORAGE_KEYS.currentTeam)

    if (storedSession?.access_token && storedSession.user?.email) {
      setSession(storedSession)
      setTeams(storedTeams)

      const nextTeamId =
        storedTeamId && storedTeams.some((team) => team.id === storedTeamId)
          ? storedTeamId
          : storedTeams[0]?.id || null

      if (nextTeamId) {
        setCurrentTeamId(nextTeamId)
        localStorage.setItem(STORAGE_KEYS.currentTeam, nextTeamId)
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.session)
      localStorage.removeItem(STORAGE_KEYS.teams)
      localStorage.removeItem(STORAGE_KEYS.currentTeam)
    }
  }, [openResetModal, handleSignupConfirmation])

  useEffect(() => {
    const url = new URL(window.location.href)
    const connected = url.searchParams.get('provider_connected')
    const error = url.searchParams.get('error')
    if (connected) {
      showToast(`${connected} connected successfully!`, 'success')
    }
    if (error) {
      showToast(`Error: ${error}`, 'error')
    }
    if (connected || error) {
      url.searchParams.delete('provider_connected')
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.pathname)
    }
  }, [showToast])

  useEffect(() => {
    if (authModalOpen) authEmailRef.current?.focus()
  }, [authModalOpen])

  useEffect(() => {
    if (forgotModalOpen) forgotEmailRef.current?.focus()
  }, [forgotModalOpen])

  useEffect(() => {
    if (resetModalOpen) resetPasswordRef.current?.focus()
  }, [resetModalOpen])

  async function handleAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      })

      const data = (await response.json()) as {
        user?: { id: string; email?: string | null }
        session?: { access_token: string; refresh_token?: string }
        teams?: Team[]
        team?: Team
        joined_teams?: Team[]
        error?: string
      }

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed')
      }

      if (authMode === 'signup' && !data.session) {
        closeAuthModal()
        showToast('Account created! Please check your email to confirm your account.', 'success', 10000)
        return
      }

      if (!data.session || !data.user) {
        throw new Error('Authentication failed')
      }

      const nextSession: Session = {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: { id: data.user.id, email: data.user.email || '' }
      }

      const nextTeams = data.teams || (data.team ? [data.team] : [])

      setSession(nextSession)
      setTeams(nextTeams)
      localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(nextSession))
      localStorage.setItem(STORAGE_KEYS.teams, JSON.stringify(nextTeams))

      const storedTeamId = localStorage.getItem(STORAGE_KEYS.currentTeam)
      const nextTeamId =
        storedTeamId && nextTeams.some((team) => team.id === storedTeamId)
          ? storedTeamId
          : nextTeams[0]?.id || null

      if (nextTeamId) {
        setCurrentTeamId(nextTeamId)
        localStorage.setItem(STORAGE_KEYS.currentTeam, nextTeamId)
      }

      if (data.joined_teams && data.joined_teams.length > 0) {
        showToast(`Joined ${data.joined_teams.length} team(s)!`, 'success')
      }

      closeAuthModal()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed'
      setAuthError(message)
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleForgotPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setForgotLoading(true)
    setForgotError('')
    setForgotSuccess('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      })

      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email')
      }

      setForgotSuccess('Check your email for the reset link!')
      setForgotEmail('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email'
      setForgotError(message)
    } finally {
      setForgotLoading(false)
    }
  }

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!resetSession?.accessToken) {
      setResetError('Missing or expired reset token')
      return
    }

    if (resetPassword !== resetConfirm) {
      setResetError('Passwords do not match')
      return
    }

    setResetLoading(true)
    setResetError('')
    setResetSuccess('')

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resetSession.accessToken}`
        },
        body: JSON.stringify({
          password: resetPassword,
          refresh_token: resetSession.refreshToken
        })
      })

      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }

      setResetSuccess('Password updated! Redirecting to login...')
      resetTimerRef.current = window.setTimeout(() => {
        setResetSession(null)
        closeResetModal()
        openAuthModal('login')
      }, 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password'
      setResetError(message)
    } finally {
      setResetLoading(false)
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: getAuthHeaders() })
    } catch {
      // ignore
    }

    clearSession()
  }

  async function handleDeleteAccount(confirm: () => Promise<boolean>) {
    const confirmed = await confirm()
    if (!confirmed) return

    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const data = (await response.json()) as { error?: string }
        throw new Error(data.error || 'Failed to delete account')
      }

      clearSession()
      showToast('Account deleted', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete account'
      showToast(message, 'error')
    }
  }

  function handleTeamSwitch(teamId: string) {
    setCurrentTeamId(teamId)
    localStorage.setItem(STORAGE_KEYS.currentTeam, teamId)
  }

  return {
    session,
    setSession,
    teams,
    setTeams,
    currentTeamId,
    setCurrentTeamId,
    authMode,
    authModalOpen,
    authEmail,
    authPassword,
    authError,
    authLoading,
    forgotModalOpen,
    forgotEmail,
    forgotError,
    forgotSuccess,
    forgotLoading,
    resetModalOpen,
    resetTitle,
    resetPassword,
    resetConfirm,
    resetError,
    resetSuccess,
    resetLoading,
    authEmailRef,
    forgotEmailRef,
    resetPasswordRef,
    openAuthModal,
    closeAuthModal,
    openForgotModal,
    closeForgotModal,
    openResetModal,
    closeResetModal,
    handleAuth,
    handleForgotPassword,
    handleResetPassword,
    handleLogout,
    handleDeleteAccount,
    handleTeamSwitch,
    getAuthHeaders,
    clearSession,
    setAuthEmail,
    setAuthPassword,
    setForgotEmail,
    setResetPassword,
    setResetConfirm
  }
}
