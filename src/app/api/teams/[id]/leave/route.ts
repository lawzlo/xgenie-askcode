import type { NextRequest } from 'next/server'
import { leaveTeam } from '../../../../../services/team'
import { jsonResponse, optionsResponse, requireAuth } from '../../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    await leaveTeam(id, auth.user!.id)
    return jsonResponse({ success: true })
  } catch (error: unknown) {
    console.error('Error leaving team:', error)
    const message = error instanceof Error ? error.message : 'Failed to leave team'
    return jsonResponse({ error: message }, 400)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
