import { z } from 'zod'
import { createGitProvider } from '../../../../services/git-provider'
import {
  getRequestOrigin,
  jsonResponse,
  optionsResponse,
  parseJson,
  requireAuth,
  requireTeamId
} from '../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CreateGiteaSchema = z.object({
  name: z.string().min(1),
  api_url: z.string().url(),
  client_id: z.string().min(1),
  client_secret: z.string().min(1)
})

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    const parsedBody = await parseJson<z.infer<typeof CreateGiteaSchema>>(request)
    if (parsedBody.response) return parsedBody.response

    const parsed = CreateGiteaSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request', details: parsed.error.errors }, 400)
    }

    const { name, api_url, client_id, client_secret } = parsed.data
    const redirectUri = `${getRequestOrigin(request)}/api/git-providers/gitea/callback`

    const provider = await createGitProvider(auth.user!.id, team.teamId!, 'gitea', name, {
      api_url,
      client_id,
      client_secret,
      redirect_uri: redirectUri
    })

    const scopes = 'read:repository read:user read:organization'
    const oauthUrl = `${api_url}/login/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${provider.id}`

    return jsonResponse(
      {
        provider: { id: provider.id, name: provider.name, provider: provider.provider },
        oauth_url: oauthUrl
      },
      201
    )
  } catch (error: unknown) {
    console.error('Error creating Gitea provider:', error)
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: string }).code
        : undefined
    if (code === '23505') {
      return jsonResponse({ error: 'Provider already exists' }, 409)
    }
    return jsonResponse({ error: 'Failed to create git provider' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
