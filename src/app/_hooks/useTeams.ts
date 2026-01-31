'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Session, Team, TeamInvite, TeamMember, ToastType } from '../_types'
import { apiRequest } from '../_lib/api'

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
    // Prefer access level from teams list, fall back to loaded members if available
    const member = teamMembers.find((m) => m.user_id === session.user.id)
    return currentTeam.access_level ?? member?.access_level ?? 60
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
        const data = await apiRequest<TeamMember[]>(`/api/teams/${teamId}/members`, {
          headers,
          onUnauthorized: clearSession
        })
        setTeamMembers(data)
      } catch (err) {
        if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
          return
        }
        const message = err instanceof Error ? err.message : 'Failed to load team members'
        showToast(message, 'error')
      }
    },
    [clearSession, getAuthHeaders, showToast]
  )

  async function loadTeamInvites(teamId: string) {
    try {
      const data = await apiRequest<TeamInvite[]>(`/api/teams/${teamId}/invites`, {
        headers: getAuthHeaders(),
        onUnauthorized: clearSession
      })
      setTeamInvites(data)
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to load invites'
      showToast(message, 'error')
    }
  }

  async function openTeamModal() {
    if (!currentTeamId || !session) return
    setTeamNameInput(currentTeam?.name || '')
    setTeamMembers([])
    setTeamInvites([])
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
      await apiRequest(`/api/teams/${currentTeamId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: { name },
        onUnauthorized: clearSession
      })

      setTeams((prev) => {
        const nextTeams = prev.map((team) =>
          team.id === currentTeamId ? { ...team, name } : team
        )
        localStorage.setItem('askcode_teams', JSON.stringify(nextTeams))
        return nextTeams
      })
      showToast('Team name updated', 'success')
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
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
      await apiRequest(`/api/teams/${currentTeamId}/invites`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: { email },
        onUnauthorized: clearSession
      })

      setInviteEmail('')
      showToast('Invite sent!', 'success')
      await loadTeamInvites(currentTeamId)
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to invite member'
      showToast(message, 'error')
    }
  }

  async function handleCancelInvite(inviteId: string) {
    if (!currentTeamId) return
    try {
      await apiRequest(`/api/teams/${currentTeamId}/invites/${inviteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        onUnauthorized: clearSession
      })
      await loadTeamInvites(currentTeamId)
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to cancel invite'
      showToast(message, 'error')
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!currentTeamId) return
    const confirmed = await showConfirm('Remove this member?')
    if (!confirmed) return
    try {
      await apiRequest(`/api/teams/${currentTeamId}/members/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        onUnauthorized: clearSession
      })
      await loadTeamMembers(currentTeamId)
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to remove member'
      showToast(message, 'error')
    }
  }

  async function handleUpdateAccessLevel(userId: string, accessLevel: number) {
    if (!currentTeamId) return
    try {
      await apiRequest(`/api/teams/${currentTeamId}/members/${userId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: { accessLevel },
        onUnauthorized: clearSession
      })
      // Update local state immediately for responsiveness
      setTeamMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, access_level: accessLevel } : m))
      )
      showToast('Access level updated', 'success')
    } catch (err) {
      if (err instanceof Error && 'status' in err && (err as { status?: number }).status === 401) {
        return
      }
      const message = err instanceof Error ? err.message : 'Failed to update access level'
      showToast(message, 'error')
    }
  }

  const teamModalVisible = !!(session && currentTeamId && teamModalOpen)

  return {
    teamModalOpen: teamModalVisible,
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
