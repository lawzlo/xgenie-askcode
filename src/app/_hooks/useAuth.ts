'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AuthMode, Session, Team, ToastType } from '../_types'
import { supabase } from '../_lib/supabase'
import { apiRequest } from '../_lib/api'

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

  // Use ref for showToast to avoid effect re-runs
  const showToastRef = useRef(showToast)
  showToastRef.current = showToast

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
      showToastRef.current('Session expired. Please log in again.', 'error')
    }
  }, [])

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
      const data = await apiRequest<{ teams?: Team[]; joined_teams?: Team[] }>('/api/teams', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
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

      // Show toast if user just joined teams via invite
      if (data.joined_teams && data.joined_teams.length > 0) {
        showToastRef.current(`Joined ${data.joined_teams.length} team(s)!`, 'success')
      }
    } catch {
      // Ignore fetch errors
    }
  }, [])

  // Initialize Supabase auth listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, supaSession) => {
      if (event === 'SIGNED_OUT' || !supaSession) {
        clearSession()
        setInitializing(false)
        return
      }

      // Update session for all authenticated events
      setSession({
        access_token: supaSession.access_token,
        refresh_token: supaSession.refresh_token,
        user: { id: supaSession.user.id, email: supaSession.user.email || '' }
      })

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        void fetchTeams(supaSession.access_token).finally(() => setInitializing(false))
      } else if (event === 'PASSWORD_RECOVERY') {
        // User clicked password reset link in email
        setInitializing(false)
        openResetModal('Reset password')
      } else {
        setInitializing(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [clearSession, fetchTeams, openResetModal])

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
      const nextSearch = url.searchParams.toString()
      const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`
      window.history.replaceState({}, '', nextUrl)
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
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword
        })
        if (error) throw error
        // onAuthStateChange will handle session and teams
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

        // Auto-confirmed - onAuthStateChange will handle session and teams
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
    // onAuthStateChange will handle clearSession via SIGNED_OUT event
    await supabase.auth.signOut()
  }

  async function handleDeleteAccount(confirm: () => Promise<boolean>) {
    const confirmed = await confirm()
    if (!confirmed) return

    try {
      await apiRequest('/api/auth/delete-account', {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      showToast('Account deleted', 'success')
      // onAuthStateChange will handle clearSession via SIGNED_OUT event
      await supabase.auth.signOut()
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
