import type { NextRequest } from 'next/server'
import { deleteGitProvider, getGitProvider } from '../../../../services/git-provider'
import { jsonResponse, optionsResponse, requireAuth, requireTeamId } from '../../../../server/api'

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

    const { client_secret: _clientSecret, access_token, refresh_token: _refreshToken, ...safe } = provider
    void _clientSecret
    void _refreshToken
    return jsonResponse({ ...safe, has_token: !!access_token })
  } catch (error) {
    console.error('Error getting git provider:', error)
    return jsonResponse({ error: 'Failed to get git provider' }, 500)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    await deleteGitProvider(id, team.teamId!)
    return jsonResponse({ success: true })
  } catch (error) {
    console.error('Error deleting git provider:', error)
    return jsonResponse({ error: 'Failed to delete git provider' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
