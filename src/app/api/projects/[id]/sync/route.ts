import type { NextRequest } from 'next/server'
import { syncProject } from '../../../../../services/project'
import { jsonResponse, optionsResponse, requireAuth, requireTeamId } from '../../../../../server/api'

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

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    const project = await syncProject(id, team.teamId!)
    return jsonResponse({
      ...project,
      credentials: project.credentials ? { hasToken: true } : undefined
    })
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
