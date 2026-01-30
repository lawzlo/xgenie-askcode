import { z } from 'zod'
import { createGitHubAppProvider } from '../../../../services/git-provider'
import { jsonResponse, optionsResponse, parseJson, requireAuth, requireTeamId } from '../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CreateGitHubAppSchema = z.object({
  name: z.string().min(1),
  github_app_id: z.number(),
  github_app_name: z.string().min(1),
  github_private_key: z.string().min(1),
  github_client_id: z.string().optional(),
  github_client_secret: z.string().optional(),
  github_webhook_secret: z.string().optional()
})

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    const parsedBody = await parseJson<z.infer<typeof CreateGitHubAppSchema>>(request)
    if (parsedBody.response) return parsedBody.response

    const parsed = CreateGitHubAppSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request', details: parsed.error.errors }, 400)
    }

    const {
      name,
      github_app_id,
      github_app_name,
      github_private_key,
      github_client_id,
      github_client_secret,
      github_webhook_secret
    } = parsed.data

    const provider = await createGitHubAppProvider(auth.user!.id, team.teamId!, name, {
      github_app_id,
      github_app_name,
      github_installation_id: '',
      github_private_key,
      github_client_id,
      github_client_secret,
      github_webhook_secret
    })

    const installUrl = `https://github.com/apps/${github_app_name}/installations/new?state=${provider.id}`

    return jsonResponse(
      {
        provider: { id: provider.id, name: provider.name, provider: provider.provider },
        install_url: installUrl,
        message: 'Please install the GitHub App to your account/organization'
      },
      201
    )
  } catch (error: unknown) {
    console.error('Error creating GitHub App provider:', error)
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
