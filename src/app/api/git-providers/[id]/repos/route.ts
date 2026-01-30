import type { NextRequest } from 'next/server'
import { getGitProvider, getRepositories, isProviderAuthenticated } from '../../../../../services/git-provider'
import { jsonResponse, optionsResponse, requireAuth, requireTeamId } from '../../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    const provider = await getGitProvider(id, team.teamId!)
    if (!provider) {
      return jsonResponse({ error: 'Git provider not found' }, 404)
    }

    if (!isProviderAuthenticated(provider)) {
      return jsonResponse({ error: 'Provider not authenticated. Please complete the setup.' }, 400)
    }

    const repos = await getRepositories(provider)
    return jsonResponse(repos)
  } catch (error: unknown) {
    console.error('Error fetching repositories:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch repositories'
    return jsonResponse({ error: message }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
