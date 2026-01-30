'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session, Team, TeamInvite, TeamMember, ToastType } from '../_types'

type UseTeamsParams = {
  session: Session | null
  teams: Team[]
  currentTeamId: string | null
  setTeams: React.Dispatch<React.SetStateAction<Team[]>>
  getAuthHeaders: () => Record<string, string>
  clearSession: () => void
  showToast: (message: string, type?: ToastType, duration?: number) => void
  showConfirm: (message: string) => Promise<boolean>
}

export function useTeams({
  session,
  teams,
  currentTeamId,
  setTeams,
  getAuthHeaders,
  clearSession,
  showToast,
  showConfirm
}: UseTeamsParams) {
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [teamNameInput, setTeamNameInput] = useState('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([])
  const [inviteEmail, setInviteEmail] = useState('')

  const currentTeam = useMemo(
    () => (currentTeamId ? teams.find((team) => team.id === currentTeamId) : null),
    [currentTeamId, teams]
  )
  const isTeamOwner = !!(session && currentTeam && currentTeam.owner_id === session.user.id)

  // Current user's access level for this team
  const userAccessLevel = useMemo(() => {
    if (!session || !currentTeam) return 60
    // Owner always has full access
    if (currentTeam.owner_id === session.user.id) return 100
    // Find member's access level from loaded members (if available)
    const member = teamMembers.find((m) => m.user_id === session.user.id)
    return member?.access_level ?? 60
  }, [session, currentTeam, teamMembers])

  const closeTeamModal = useCallback(() => {
    setTeamModalOpen(false)
  }, [])

  const loadTeamMembers = useCallback(
    async (teamId: string) => {
      const headers = getAuthHeaders()
      // Don't make request if auth headers are incomplete
      if (!headers.Authorization || !headers['X-Team-Id']) {
        return
      }
      try {
        const response = await fetch(`/api/teams/${teamId}/members`, { headers })
        if (response.status === 401) {
          clearSession()
          return
        }
        if (!response.ok) {
          throw new Error('Failed to load team members')
        }
        const data = (await response.json()) as TeamMember[]
        setTeamMembers(data)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load team members'
        showToast(message, 'error')
      }
    },
    [clearSession, getAuthHeaders, showToast]
  )

  async function loadTeamInvites(teamId: string) {
    try {
      const response = await fetch(`/api/teams/${teamId}/invites`, { headers: getAuthHeaders() })
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok) {
        throw new Error('Failed to load invites')
      }
      const data = (await response.json()) as TeamInvite[]
      setTeamInvites(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load invites'
      showToast(message, 'error')
    }
  }

  async function openTeamModal() {
    if (!currentTeamId) return
    setTeamNameInput(currentTeam?.name || '')
    setTeamModalOpen(true)
    await loadTeamMembers(currentTeamId)
    if (session && currentTeam && currentTeam.owner_id === session.user.id) {
      await loadTeamInvites(currentTeamId)
    } else {
      setTeamInvites([])
    }
  }

  async function handleUpdateTeamName() {
    if (!currentTeamId) return
    const name = teamNameInput.trim()
    if (!name) return

    try {
      const response = await fetch(`/api/teams/${currentTeamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ name })
      })
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok) {
        throw new Error('Failed to update team')
      }

      setTeams((prev) => {
        const nextTeams = prev.map((team) =>
          team.id === currentTeamId ? { ...team, name } : team
        )
        localStorage.setItem('askcode_teams', JSON.stringify(nextTeams))
        return nextTeams
      })
      showToast('Team name updated', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update team'
      showToast(message, 'error')
    }
  }

  async function handleInviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentTeamId) return
    const email = inviteEmail.trim()
    if (!email) return

    try {
      const response = await fetch(`/api/teams/${currentTeamId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ email })
      })
      const data = (await response.json()) as { error?: string }
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite member')
      }

      setInviteEmail('')
      showToast('Invite sent!', 'success')
      await loadTeamInvites(currentTeamId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to invite member'
      showToast(message, 'error')
    }
  }

  async function handleCancelInvite(inviteId: string) {
    if (!currentTeamId) return
    try {
      const response = await fetch(`/api/teams/${currentTeamId}/invites/${inviteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok) {
        throw new Error('Failed to cancel invite')
      }
      await loadTeamInvites(currentTeamId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel invite'
      showToast(message, 'error')
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!currentTeamId) return
    const confirmed = await showConfirm('Remove this member?')
    if (!confirmed) return
    try {
      const response = await fetch(`/api/teams/${currentTeamId}/members/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok) {
        throw new Error('Failed to remove member')
      }
      await loadTeamMembers(currentTeamId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member'
      showToast(message, 'error')
    }
  }

  async function handleUpdateAccessLevel(userId: string, accessLevel: number) {
    if (!currentTeamId) return
    try {
      const response = await fetch(`/api/teams/${currentTeamId}/members/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ accessLevel })
      })
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok) {
        throw new Error('Failed to update access level')
      }
      // Update local state immediately for responsiveness
      setTeamMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, access_level: accessLevel } : m))
      )
      showToast('Access level updated', 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update access level'
      showToast(message, 'error')
    }
  }

  useEffect(() => {
    if (!session || !currentTeamId) {
      setTeamModalOpen(false)
      setTeamNameInput('')
      setTeamMembers([])
      setTeamInvites([])
      setInviteEmail('')
    } else {
      // Load team members to get current user's access level
      void loadTeamMembers(currentTeamId)
    }
  }, [session, currentTeamId, loadTeamMembers])

  return {
    teamModalOpen,
    teamNameInput,
    teamMembers,
    teamInvites,
    inviteEmail,
    isTeamOwner,
    openTeamModal,
    closeTeamModal,
    handleUpdateTeamName,
    handleInviteMember,
    handleCancelInvite,
    handleRemoveMember,
    handleUpdateAccessLevel,
    setTeamNameInput,
    setInviteEmail,
    userAccessLevel,
    loadTeamMembers
  }
}
