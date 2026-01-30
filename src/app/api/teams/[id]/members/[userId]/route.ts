import type { NextRequest } from 'next/server'
import { isTeamOwner, removeMember, updateMemberAccessLevel } from '../../../../../../services/team'
import { jsonResponse, optionsResponse, requireAuth, parseJson } from '../../../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ id: string; userId: string }>
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id, userId } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const isOwner = await isTeamOwner(id, auth.user!.id)
    if (!isOwner) {
      return jsonResponse({ error: 'Only team owner can remove members' }, 403)
    }

    if (userId === auth.user!.id) {
      return jsonResponse({ error: 'Cannot remove yourself. Use leave endpoint instead.' }, 400)
    }

    await removeMember(id, userId)
    return jsonResponse({ success: true })
  } catch (error) {
    console.error('Error removing member:', error)
    return jsonResponse({ error: 'Failed to remove member' }, 500)
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id, userId } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const isOwner = await isTeamOwner(id, auth.user!.id)
    if (!isOwner) {
      return jsonResponse({ error: 'Only team owner can update member access level' }, 403)
    }

    const parsed = await parseJson<{ accessLevel: number }>(request)
    if (parsed.response) return parsed.response

    const { accessLevel } = parsed.data!
    if (![30, 60, 100].includes(accessLevel)) {
      return jsonResponse({ error: 'Invalid access level. Must be 30, 60, or 100.' }, 400)
    }

    await updateMemberAccessLevel(id, userId, accessLevel)
    return jsonResponse({ success: true })
  } catch (error) {
    console.error('Error updating member access level:', error)
    return jsonResponse({ error: 'Failed to update member access level' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
