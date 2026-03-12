import type { NextRequest } from 'next/server'
import { deleteGitProvider, getGitProvider } from '../../../../services/git-provider'
import { getRequestOrigin, jsonResponse, optionsResponse, requireAuth, requireTeamId } from '../../../../server/api'

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

// Re-authorize: generate a new OAuth URL for an existing provider
export async function POST(request: NextRequest, { params }: Params) {
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

    if (!provider.client_id || !provider.api_url) {
      return jsonResponse({ error: 'Provider missing OAuth configuration' }, 400)
    }

    const redirectUri = provider.redirect_uri || `${getRequestOrigin(request)}/api/git-providers/${provider.provider}/callback`
    const scopes = 'read:repository read:user read:organization'
    const oauthUrl = `${provider.api_url}/login/oauth/authorize?client_id=${provider.client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${provider.id}`

    return jsonResponse({ oauth_url: oauthUrl })
  } catch (error) {
    console.error('Error re-authorizing git provider:', error)
    return jsonResponse({ error: 'Failed to re-authorize git provider' }, 500)
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
