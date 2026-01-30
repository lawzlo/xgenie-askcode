import { z } from 'zod'
import { supabaseAnon } from '../../../../lib/supabase'
import { createTeam, getUserTeams, processInvitesForUser, type Team } from '../../../../services/team'
import { jsonResponse, optionsResponse, parseJson } from '../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const AuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

export async function POST(request: Request) {
  try {
    const parsedBody = await parseJson<{ email: string; password: string }>(request)
    if (parsedBody.response) return parsedBody.response

    const parsed = AuthSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request', details: parsed.error.errors }, 400)
    }

    const { email, password } = parsed.data
    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return jsonResponse({ error: error.message }, 401)
    }

    let joinedTeams: Team[] = []
    try {
      joinedTeams = await processInvitesForUser(data.user.id, data.user.email || '')
    } catch (inviteError) {
      console.error('Error processing invites:', inviteError)
    }

    let teams: Team[] = []
    try {
      teams = await getUserTeams(data.user.id)
      const hasOwnTeam = teams.some(t => t.owner_id === data.user.id)
      if (!hasOwnTeam) {
        const teamName = `${data.user.email?.split('@')[0] || 'My'}'s workspace`
        const newTeam = await createTeam(data.user.id, teamName)
        teams = [newTeam, ...teams]
      }
    } catch (teamsError) {
      console.error('Error getting/creating teams:', teamsError)
    }

    return jsonResponse({
      user: { id: data.user.id, email: data.user.email },
      session: data.session,
      teams,
      joined_teams: joinedTeams
    })
  } catch (error) {
    console.error('Login error:', error)
    return jsonResponse({ error: 'Failed to login' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
