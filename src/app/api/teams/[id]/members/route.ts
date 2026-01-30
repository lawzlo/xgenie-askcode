import type { NextRequest } from 'next/server'
import { getTeam, getTeamMembers } from '../../../../../services/team'
import { jsonResponse, optionsResponse, requireAuth } from '../../../../../server/api'

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

    const team = await getTeam(id, auth.user!.id)
    if (!team) {
      return jsonResponse({ error: 'Team not found' }, 404)
    }

    const members = await getTeamMembers(id)
    return jsonResponse(members)
  } catch (error) {
    console.error('Error getting team members:', error)
    return jsonResponse({ error: 'Failed to get team members' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
