import { jsonResponse, optionsResponse, requireAuth } from '../../../../server/api'
import { getUserTeams, createTeam } from '../../../../services/team'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response

  // Get user's teams
  let teams: { id: string; name: string; owner_id: string; created_at: string }[] = []
  try {
    teams = await getUserTeams(auth.user!.id)

    // Create default team if user has none
    const hasOwnTeam = teams.some(t => t.owner_id === auth.user!.id)
    if (!hasOwnTeam) {
      const teamName = `${auth.user!.email?.split('@')[0] || 'My'}'s workspace`
      const newTeam = await createTeam(auth.user!.id, teamName)
      teams = [newTeam, ...teams]
    }
  } catch (err) {
    console.error('Error getting teams:', err)
  }

  return jsonResponse({ user: auth.user, teams })
}

export function OPTIONS() {
  return optionsResponse()
}
