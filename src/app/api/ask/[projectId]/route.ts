import * as fs from 'fs/promises'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getProject, syncProject } from '../../../../services/project'
import { askQuestionStream } from '../../../../services/agent'
import { hasTeamAccess } from '../../../../services/team'
import { jsonResponse, optionsResponse, parseJson, requireAuth } from '../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ projectId: string }>
}

const AskSchema = z.object({
  question: z.string().min(1).max(10000)
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
    if (project.syncStatus !== 'ready') {
      return jsonResponse({ error: 'Project is still syncing. Please try again shortly.' }, 409)
    }

    // Check if workspace actually exists (may be missing after volume reset/new deployment)
    try {
      await fs.access(project.workspacePath)
    } catch {
      // Workspace missing, trigger sync and return error
      await syncProject(project.id, teamId)
      return jsonResponse({ error: 'Project files not found. Syncing now, please try again shortly.' }, 409)
    }

    console.log(
      `[Ask] User: ${auth.user!.email}, Project: ${project.name}, Question: ${parsed.data.question}`
    )

    // Create SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = askQuestionStream(project, parsed.data.question, {
            userId: auth.user!.id,
            userEmail: auth.user!.email,
            teamId
          })

          for await (const event of generator) {
            const data = JSON.stringify(event)
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))

            if (event.type === 'complete') {
              console.log(
                `[Ask] Files read: ${event.data.filesRead.join(', ')}, Conversation length: ${event.data.conversationLength}`
              )
            }
          }

          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          const errorEvent = JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
          })
          controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Team-Id'
      }
    })
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
