import { getUserTeams, createTeam, processInvitesForUser } from '../../../services/team'
import { jsonResponse, optionsResponse, requireAuth } from '../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    // Process any pending team invites for this user
    const joinedTeams = await processInvitesForUser(auth.user!.id, auth.user!.email || '')

    let teams = await getUserTeams(auth.user!.id)

    // Create default team if user has none
    const hasOwnTeam = teams.some(t => t.owner_id === auth.user!.id)
    if (!hasOwnTeam) {
      const teamName = `${auth.user!.email?.split('@')[0] || 'My'}'s workspace`
      const newTeam = await createTeam(auth.user!.id, teamName)
      teams = [newTeam, ...teams]
    }

    return jsonResponse({ teams, joined_teams: joinedTeams.length > 0 ? joinedTeams : undefined })
  } catch (error) {
    console.error('Error listing teams:', error)
    return jsonResponse({ error: 'Failed to list teams' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
