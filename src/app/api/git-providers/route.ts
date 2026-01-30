import { getGitProviders } from '../../../services/git-provider'
import { jsonResponse, optionsResponse, requireAuth, requireTeamId } from '../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    const providers = await getGitProviders(team.teamId!)
    return jsonResponse(providers)
  } catch (error) {
    console.error('Error listing git providers:', error)
    return jsonResponse({ error: 'Failed to list git providers' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
