import { getUserTeams } from '../../../services/team'
import { jsonResponse, optionsResponse, requireAuth } from '../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const teams = await getUserTeams(auth.user!.id)
    return jsonResponse(teams)
  } catch (error) {
    console.error('Error listing teams:', error)
    return jsonResponse({ error: 'Failed to list teams' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
