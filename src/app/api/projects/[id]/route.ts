import type { NextRequest } from 'next/server'
import { deleteProject, getProject } from '../../../../services/project'
import { jsonResponse, noContentResponse, optionsResponse, requireAuth, requireTeamId } from '../../../../server/api'
import { safeProject } from '../../../../server/projects'

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

    const project = await getProject(id, team.teamId!)
    if (!project) {
      return jsonResponse({ error: 'Project not found' }, 404)
    }

    return jsonResponse(safeProject(project))
  } catch {
    return jsonResponse({ error: 'Failed to get project' }, 500)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    await deleteProject(id, team.teamId!)
    return noContentResponse()
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return jsonResponse({ error: 'Project not found' }, 404)
    }
    return jsonResponse({ error: 'Failed to delete project' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
