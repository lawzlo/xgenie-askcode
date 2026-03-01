import { z } from 'zod'
import { getSavedCredentials, createSavedCredential } from '../../../services/saved-credential'
import { requireAuth, requireTeamId, jsonResponse, optionsResponse, parseJson } from '../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  platform: z.string().min(1).max(50).default('other'),
  token: z.string().min(1)
})

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    const credentials = await getSavedCredentials(team.teamId!)
    const safe = credentials.map(({ credentials: _creds, ...rest }) => ({
      ...rest,
      has_token: true
    }))

    return jsonResponse(safe)
  } catch {
    return jsonResponse({ error: 'Failed to list saved credentials' }, 500)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    const parsedBody = await parseJson<z.infer<typeof CreateSchema>>(request)
    if (parsedBody.response) return parsedBody.response

    const parsed = CreateSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request', details: parsed.error.errors }, 400)
    }

    const { name, platform, token } = parsed.data
    const credential = await createSavedCredential(
      auth.user!.id,
      team.teamId!,
      name,
      platform,
      { token }
    )

    return jsonResponse(
      { id: credential.id, name: credential.name, platform: credential.platform, has_token: true, created_at: credential.created_at },
      201
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      return jsonResponse({ error: error.message }, 409)
    }
    return jsonResponse({ error: 'Failed to create saved credential' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
