import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getTeam, isTeamOwner, updateTeam } from '../../../../services/team'
import { jsonResponse, optionsResponse, parseJson, requireAuth } from '../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ id: string }>
}

const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(100)
})

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await getTeam(id, auth.user!.id)
    if (!team) {
      return jsonResponse({ error: 'Team not found' }, 404)
    }

    const isOwner = await isTeamOwner(id, auth.user!.id)
    return jsonResponse({ ...team, is_owner: isOwner })
  } catch (error) {
    console.error('Error getting team:', error)
    return jsonResponse({ error: 'Failed to get team' }, 500)
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const isOwner = await isTeamOwner(id, auth.user!.id)
    if (!isOwner) {
      return jsonResponse({ error: 'Only team owner can update team' }, 403)
    }

    const parsedBody = await parseJson<z.infer<typeof UpdateTeamSchema>>(request)
    if (parsedBody.response) return parsedBody.response

    const parsed = UpdateTeamSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request', details: parsed.error.errors }, 400)
    }

    const team = await updateTeam(id, auth.user!.id, parsed.data.name)
    return jsonResponse(team)
  } catch (error) {
    console.error('Error updating team:', error)
    return jsonResponse({ error: 'Failed to update team' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
