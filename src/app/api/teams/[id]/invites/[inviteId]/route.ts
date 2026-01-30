import type { NextRequest } from 'next/server'
import { cancelInvite, isTeamOwner } from '../../../../../../services/team'
import { jsonResponse, optionsResponse, requireAuth } from '../../../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ id: string; inviteId: string }>
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id, inviteId } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const isOwner = await isTeamOwner(id, auth.user!.id)
    if (!isOwner) {
      return jsonResponse({ error: 'Only team owner can cancel invites' }, 403)
    }

    await cancelInvite(inviteId, id)
    return jsonResponse({ success: true })
  } catch (error) {
    console.error('Error canceling invite:', error)
    return jsonResponse({ error: 'Failed to cancel invite' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
