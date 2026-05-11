import type { NextRequest } from 'next/server'
import { getSavedCredential, deleteSavedCredential } from '../../../../services/saved-credential'
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

    const credential = await getSavedCredential(id, team.teamId!)
    if (!credential) {
      return jsonResponse({ error: 'Saved credential not found' }, 404)
    }

    return jsonResponse({
      id: credential.id,
      user_id: credential.user_id,
      team_id: credential.team_id,
      name: credential.name,
      platform: credential.platform,
      created_at: credential.created_at,
      has_token: Boolean(credential.credentials.token)
    })
  } catch {
    return jsonResponse({ error: 'Failed to get saved credential' }, 500)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    await deleteSavedCredential(id, team.teamId!)
    return jsonResponse({ success: true })
  } catch {
    return jsonResponse({ error: 'Failed to delete saved credential' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
