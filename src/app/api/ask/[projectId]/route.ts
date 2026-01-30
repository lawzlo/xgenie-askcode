import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getProject } from '../../../../services/project'
import { askQuestion } from '../../../../services/agent'
import { hasTeamAccess } from '../../../../services/team'
import { jsonResponse, optionsResponse, parseJson, requireAuth } from '../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ projectId: string }>
}

const AskSchema = z.object({
  question: z.string().min(1).max(2000)
})

export async function POST(request: NextRequest, { params }: Params) {
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

    const parsedBody = await parseJson<z.infer<typeof AskSchema>>(request)
    if (parsedBody.response) return parsedBody.response

    const parsed = AskSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request', details: parsed.error.errors }, 400)
    }

    const project = await getProject(projectId, teamId)
    if (!project) {
      return jsonResponse({ error: 'Project not found' }, 404)
    }

    console.log(
      `[Ask] User: ${auth.user!.email}, Project: ${project.name}, Question: ${parsed.data.question}`
    )

    const response = await askQuestion(project, parsed.data.question, {
      userId: auth.user!.id,
      userEmail: auth.user!.email,
      teamId
    })

    console.log(
      `[Ask] Files read: ${response.filesRead.join(', ')}, Conversation length: ${response.conversationLength}`
    )

    return jsonResponse(response)
  } catch (error) {
    console.error('Failed to process question:', error)
    return jsonResponse(
      {
        error: 'Failed to process question',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}

export function OPTIONS() {
  return optionsResponse()
}
