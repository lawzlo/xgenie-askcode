import { getUserTeams } from '../../../services/team'
import { jsonResponse, optionsResponse, requireAuth } from '../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  console.log('[Teams API] GET request received')
  try {
    const auth = await requireAuth(request)
    if (auth.response) {
      console.log('[Teams API] Auth failed')
      return auth.response
    }

    console.log('[Teams API] User:', auth.user!.id, auth.user!.email)
    const teams = await getUserTeams(auth.user!.id)
    console.log('[Teams API] Returning teams:', teams.length)
    return jsonResponse(teams)
  } catch (error) {
    console.error('Error listing teams:', error)
    return jsonResponse({ error: 'Failed to list teams' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
