import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface Team {
  id: string
  name: string
  owner_id: string
  created_at: string
  access_level?: number
}

export interface TeamMember {
  team_id: string
  user_id: string
  created_at: string
  // Joined fields
  email?: string
}

export interface TeamInvite {
  id: string
  team_id: string
  email: string
  invited_by: string | null
  created_at: string
}

const AUTH_USER_PAGE_SIZE = 1000

// Create a new team (called on signup)
export async function createTeam(ownerId: string, name: string): Promise<Team> {
  const { data, error } = await supabase
    .from('teams')
    .insert({ owner_id: ownerId, name })
    .select()
    .single()

  if (error) throw error
  return data
}

// Get all teams for a user (owned + member of)
export async function getUserTeams(userId: string): Promise<Team[]> {
  // Get owned teams
  const { data: ownedTeams, error: ownedError } = await supabase
    .from('teams')
    .select('*')
    .eq('owner_id', userId)

  if (ownedError) throw ownedError

  // Get teams user is a member of
  const { data: memberTeams, error: memberError } = await supabase
    .from('team_members')
    .select('team_id, access_level')
    .eq('user_id', userId)

  if (memberError) throw memberError

  const ownedTeamIds = new Set((ownedTeams || []).map(team => team.id))
  const ownedWithAccess = (ownedTeams || []).map(team => ({
    ...team,
    access_level: 100
  }))

  if (memberTeams.length === 0) {
    return ownedWithAccess
  }

  const memberTeamIds = memberTeams.map(m => m.team_id)
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('*')
    .in('id', memberTeamIds)

  if (teamsError) throw teamsError

  const accessMap = new Map(memberTeams.map(m => [m.team_id, m.access_level ?? 60]))
  const memberWithAccess = (teams || [])
    .filter(team => !ownedTeamIds.has(team.id))
    .map(team => ({
      ...team,
      access_level: accessMap.get(team.id) ?? 60
    }))

  return [...ownedWithAccess, ...memberWithAccess]
}

// Get a single team
export async function getTeam(teamId: string, userId: string): Promise<Team | null> {
  const teams = await getUserTeams(userId)
  return teams.find(t => t.id === teamId) || null
}

// Update team name (owner only)
export async function updateTeam(teamId: string, ownerId: string, name: string): Promise<Team> {
  const { data, error } = await supabase
    .from('teams')
    .update({ name })
    .eq('id', teamId)
    .eq('owner_id', ownerId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Delete team (owner only)
export async function deleteTeam(teamId: string, ownerId: string): Promise<void> {
  const { error } = await supabase
    .from('teams')
    .delete()
    .eq('id', teamId)
    .eq('owner_id', ownerId)

  if (error) throw error
}

// Get team members (including owner)
export async function getTeamMembers(teamId: string): Promise<{ user_id: string; email: string; role: 'owner' | 'member'; access_level: number }[]> {
  // Get team to find owner
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('owner_id')
    .eq('id', teamId)
    .single()

  if (teamError) throw teamError

  // Get owner info
  const { data: ownerData } = await supabase.auth.admin.getUserById(team.owner_id)

  const members: { user_id: string; email: string; role: 'owner' | 'member'; access_level: number }[] = []

  if (ownerData?.user) {
    members.push({
      user_id: team.owner_id,
      email: ownerData.user.email || '',
      role: 'owner',
      access_level: 100  // Owner always has full access
    })
  }

  // Get other members with access_level
  const { data: teamMembers, error: membersError } = await supabase
    .from('team_members')
    .select('user_id, access_level')
    .eq('team_id', teamId)

  if (membersError) throw membersError

  for (const member of teamMembers || []) {
    const { data: userData } = await supabase.auth.admin.getUserById(member.user_id)
    if (userData?.user) {
      members.push({
        user_id: member.user_id,
        email: userData.user.email || '',
        role: 'member',
        access_level: member.access_level ?? 60
      })
    }
  }

  return members
}

// Update member access level (owner only)
export async function updateMemberAccessLevel(teamId: string, userId: string, accessLevel: number): Promise<void> {
  // Validate access level
  if (![30, 60, 100].includes(accessLevel)) {
    throw new Error('Invalid access level. Must be 30, 60, or 100.')
  }

  const { error } = await supabase
    .from('team_members')
    .update({ access_level: accessLevel })
    .eq('team_id', teamId)
    .eq('user_id', userId)

  if (error) throw error
}

async function findAuthUserByEmail(email: string): Promise<User | null> {
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: AUTH_USER_PAGE_SIZE
    })

    if (error) throw error

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email)
    if (user) return user

    if (!data.nextPage || data.users.length < AUTH_USER_PAGE_SIZE) return null
    page = data.nextPage
  }
}

function hasConfirmedEmail(user: User): boolean {
  return Boolean(user.email_confirmed_at || user.confirmed_at)
}

async function getExistingTeamInvite(teamId: string, email: string): Promise<TeamInvite> {
  const { data, error } = await supabase
    .from('team_invites')
    .select('*')
    .eq('team_id', teamId)
    .eq('email', email)
    .single()

  if (error) throw error
  return data
}

async function getOrCreateTeamInvite(teamId: string, email: string, invitedBy: string): Promise<TeamInvite> {
  const { data, error } = await supabase
    .from('team_invites')
    .insert({ team_id: teamId, email, invited_by: invitedBy })
    .select()
    .single()

  if (!error) return data
  if (error.code === '23505') return getExistingTeamInvite(teamId, email)
  throw error
}

async function sendInviteEmail(email: string, redirectTo?: string): Promise<void> {
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectTo || undefined
  })

  if (error) throw error
}

async function resendSignupConfirmation(email: string, redirectTo?: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: redirectTo ? { emailRedirectTo: redirectTo } : undefined
  })

  if (error) throw error
}

// Invite a user by email
export async function inviteToTeam(teamId: string, email: string, invitedBy: string, redirectTo?: string): Promise<TeamInvite> {
  const normalizedEmail = email.toLowerCase()

  const invite = await getOrCreateTeamInvite(teamId, normalizedEmail, invitedBy)
  const existingUser = await findAuthUserByEmail(normalizedEmail)

  if (!existingUser) {
    await sendInviteEmail(normalizedEmail, redirectTo)
  } else if (!hasConfirmedEmail(existingUser)) {
    await resendSignupConfirmation(normalizedEmail, redirectTo)
  }
  // For existing users, they'll see the invite when they log in via processInvitesForUser()

  return invite
}

// Get pending invites for a team
export async function getTeamInvites(teamId: string): Promise<TeamInvite[]> {
  const { data, error } = await supabase
    .from('team_invites')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Cancel an invite
export async function cancelInvite(inviteId: string, teamId: string): Promise<void> {
  const { error } = await supabase
    .from('team_invites')
    .delete()
    .eq('id', inviteId)
    .eq('team_id', teamId)

  if (error) throw error
}

// Check and process invites for a user (called on login)
export async function processInvitesForUser(userId: string, email: string): Promise<Team[]> {
  // Find invites for this email
  const { data: invites, error: invitesError } = await supabase
    .from('team_invites')
    .select('*, teams(*)')
    .eq('email', email.toLowerCase())

  if (invitesError) throw invitesError
  if (!invites || invites.length === 0) return []

  const joinedTeams: Team[] = []

  for (const invite of invites) {
    // Add user to team
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({ team_id: invite.team_id, user_id: userId })

    if (!memberError) {
      // Delete the invite
      await supabase
        .from('team_invites')
        .delete()
        .eq('id', invite.id)

      if (invite.teams) {
        joinedTeams.push(invite.teams as Team)
      }
    }
  }

  return joinedTeams
}

// Remove a member from team (owner only)
export async function removeMember(teamId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId)

  if (error) throw error
}

// Get user's access level for a team
export async function getUserAccessLevel(teamId: string, userId: string): Promise<number> {
  // Check if user is owner (always 100)
  const { data: team } = await supabase
    .from('teams')
    .select('owner_id')
    .eq('id', teamId)
    .single()

  if (team?.owner_id === userId) {
    return 100
  }

  // Get member's access level
  const { data: member } = await supabase
    .from('team_members')
    .select('access_level')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .single()

  return member?.access_level ?? 60
}

// Leave a team (member only, not owner)
export async function leaveTeam(teamId: string, userId: string): Promise<void> {
  // Check user is not the owner
  const { data: team } = await supabase
    .from('teams')
    .select('owner_id')
    .eq('id', teamId)
    .single()

  if (team?.owner_id === userId) {
    throw new Error('Owner cannot leave team. Transfer ownership or delete team.')
  }

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId)

  if (error) throw error
}

// Check if user has access to team
export async function hasTeamAccess(teamId: string, userId: string): Promise<boolean> {
  const teams = await getUserTeams(userId)
  return teams.some(t => t.id === teamId)
}

// Check if user is team owner
export async function isTeamOwner(teamId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('owner_id', userId)
    .single()

  return !!data
}
