'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AuthMode, Session, Team, ToastType } from '../_types'
import { supabase } from '../_lib/supabase'

const STORAGE_KEYS = {
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
  const [initializing, setInitializing] = useState(true)

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

  // Fetch teams from API and update state
  const fetchTeams = useCallback(async (accessToken: string) => {
    try {
      const response = await fetch('/api/teams', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!response.ok) return
      const data = (await response.json()) as { teams?: Team[] }
      const fetchedTeams = data.teams || []
      setTeams(fetchedTeams)
      localStorage.setItem(STORAGE_KEYS.teams, JSON.stringify(fetchedTeams))

      const storedTeamId = localStorage.getItem(STORAGE_KEYS.currentTeam)
      const nextTeamId = storedTeamId && fetchedTeams.some(t => t.id === storedTeamId)
        ? storedTeamId
        : fetchedTeams[0]?.id || null

      if (nextTeamId) {
        setCurrentTeamId(nextTeamId)
        localStorage.setItem(STORAGE_KEYS.currentTeam, nextTeamId)
      }
    } catch {
      // Ignore fetch errors
    }
  }, [])

  // Initialize Supabase auth listener
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: supaSession } }) => {
      if (supaSession) {
        setSession({
          access_token: supaSession.access_token,
          refresh_token: supaSession.refresh_token,
          user: { id: supaSession.user.id, email: supaSession.user.email || '' }
        })
        // Fetch teams from API
        void fetchTeams(supaSession.access_token)
      }
      setInitializing(false)
    })

    // Listen for auth changes (handles token refresh automatically)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, supaSession) => {
      if (event === 'SIGNED_OUT' || !supaSession) {
        clearSession()
      } else if (event === 'TOKEN_REFRESHED') {
        setSession({
          access_token: supaSession.access_token,
          refresh_token: supaSession.refresh_token,
          user: { id: supaSession.user.id, email: supaSession.user.email || '' }
        })
      } else if (event === 'SIGNED_IN') {
        setSession({
          access_token: supaSession.access_token,
          refresh_token: supaSession.refresh_token,
          user: { id: supaSession.user.id, email: supaSession.user.email || '' }
        })
        void fetchTeams(supaSession.access_token)
      }
    })

    return () => subscription.unsubscribe()
  }, [clearSession, fetchTeams])

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current)
        resetTimerRef.current = null
      }
    }
  }, [])

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
      if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        })
        if (error) throw error
        if (!data.session || !data.user) throw new Error('Authentication failed')

        // Fetch teams from API
        const teamsResponse = await fetch('/api/teams', {
          headers: { Authorization: `Bearer ${data.session.access_token}` }
        })
        const teamsData = (await teamsResponse.json()) as { teams?: Team[]; joined_teams?: Team[] }
        const nextTeams = teamsData.teams || []

        setTeams(nextTeams)
        localStorage.setItem(STORAGE_KEYS.teams, JSON.stringify(nextTeams))

        const storedTeamId = localStorage.getItem(STORAGE_KEYS.currentTeam)
        const nextTeamId = storedTeamId && nextTeams.some(t => t.id === storedTeamId)
          ? storedTeamId
          : nextTeams[0]?.id || null

        if (nextTeamId) {
          setCurrentTeamId(nextTeamId)
          localStorage.setItem(STORAGE_KEYS.currentTeam, nextTeamId)
        }

        if (teamsData.joined_teams && teamsData.joined_teams.length > 0) {
          showToast(`Joined ${teamsData.joined_teams.length} team(s)!`, 'success')
        }

        closeAuthModal()
      } else {
        // Signup
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword
        })
        if (error) throw error

        if (!data.session) {
          // Email confirmation required
          closeAuthModal()
          showToast('Account created! Please check your email to confirm your account.', 'success', 10000)
          return
        }

        // Auto-confirmed, fetch teams
        const teamsResponse = await fetch('/api/teams', {
          headers: { Authorization: `Bearer ${data.session.access_token}` }
        })
        const teamsData = (await teamsResponse.json()) as { teams?: Team[] }
        const nextTeams = teamsData.teams || []

        setTeams(nextTeams)
        localStorage.setItem(STORAGE_KEYS.teams, JSON.stringify(nextTeams))

        if (nextTeams.length > 0) {
          setCurrentTeamId(nextTeams[0].id)
          localStorage.setItem(STORAGE_KEYS.currentTeam, nextTeams[0].id)
        }

        closeAuthModal()
      }
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
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}`
      })
      if (error) throw error

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

    if (resetPassword !== resetConfirm) {
      setResetError('Passwords do not match')
      return
    }

    setResetLoading(true)
    setResetError('')
    setResetSuccess('')

    try {
      const { error } = await supabase.auth.updateUser({ password: resetPassword })
      if (error) throw error

      setResetSuccess('Password updated! Redirecting...')
      resetTimerRef.current = window.setTimeout(() => {
        closeResetModal()
      }, 2000)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password'
      setResetError(message)
    } finally {
      setResetLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    clearSession('logout')
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

      await supabase.auth.signOut()
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
    initializing,
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
