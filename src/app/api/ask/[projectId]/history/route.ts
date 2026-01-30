import type { NextRequest } from 'next/server'
import { clearConversation, getConversationHistory } from '../../../../../services/agent'
import { getProject } from '../../../../../services/project'
import { hasTeamAccess } from '../../../../../services/team'
import { jsonResponse, optionsResponse, requireAuth } from '../../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ projectId: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const teamId = request.headers.get('x-team-id')
    if (!teamId) {
      return jsonResponse({ error: 'Missing X-Team-Id header' }, 400)
    }

    const hasAccess = await hasTeamAccess(teamId, auth.user!.id)
    if (!hasAccess) {
      return jsonResponse({ error: 'No access to this team' }, 403)
    }

    const project = await getProject(projectId, teamId)
    if (!project) {
      return jsonResponse({ error: 'Project not found' }, 404)
    }

    const messages = await getConversationHistory(projectId, auth.user!.id)
    return jsonResponse({
      messages,
      length: messages.length
    })
  } catch {
    return jsonResponse({ error: 'Failed to get conversation history' }, 500)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { projectId } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const teamId = request.headers.get('x-team-id')
    if (!teamId) {
      return jsonResponse({ error: 'Missing X-Team-Id header' }, 400)
    }

    const hasAccess = await hasTeamAccess(teamId, auth.user!.id)
    if (!hasAccess) {
      return jsonResponse({ error: 'No access to this team' }, 403)
    }

    const project = await getProject(projectId, teamId)
    if (!project) {
      return jsonResponse({ error: 'Project not found' }, 404)
    }

    await clearConversation(projectId, auth.user!.id)
    return jsonResponse({ success: true })
  } catch {
    return jsonResponse({ error: 'Failed to clear conversation' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
