import type { NextRequest } from 'next/server'
import { getProject, syncProject } from '../../../../../services/project'
import { getGitProvider, refreshGiteaToken } from '../../../../../services/git-provider'
import { getRequestOrigin, jsonResponse, optionsResponse, requireAuth, requireTeamId } from '../../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ id: string }>
}

function buildOAuthUrl(provider: { api_url: string | null; client_id: string | null; redirect_uri: string | null; provider: string; id: string }, origin: string): string | null {
  if (!provider.client_id || !provider.api_url) return null
  const redirectUri = provider.redirect_uri || `${origin}/api/git-providers/${provider.provider}/callback`
  const scopes = 'read:repository read:user read:organization'
  return `${provider.api_url}/login/oauth/authorize?client_id=${provider.client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${provider.id}`
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    // Check if provider token needs re-authorization before enqueuing
    const project = await getProject(id, team.teamId!)
    if (!project) {
      return jsonResponse({ error: 'Project not found' }, 404)
    }

    if (project.gitProviderId) {
      const provider = await getGitProvider(project.gitProviderId, project.teamId)
      if (provider && provider.provider !== 'github') {
        // Check if token is expired
        const isExpired = provider.token_expires_at && new Date(provider.token_expires_at) < new Date()
        if (isExpired) {
          // Try to refresh
          const newToken = await refreshGiteaToken(provider)
          const stillExpired = !newToken || newToken === provider.access_token
          if (stillExpired) {
            const oauthUrl = buildOAuthUrl(provider, getRequestOrigin(request))
            if (oauthUrl) {
              return jsonResponse({ needs_reauth: true, oauth_url: oauthUrl })
            }
          }
        }
      }
    }

    const synced = await syncProject(id, team.teamId!)
    return jsonResponse(
      {
        ...synced,
        credentials: synced.credentials ? { hasToken: true } : undefined
      },
      202
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return jsonResponse({ error: 'Project not found' }, 404)
    }
    return jsonResponse({ error: 'Failed to sync project' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
