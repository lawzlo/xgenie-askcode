import type { NextRequest } from 'next/server'
import { createDemoProject, hasDemoTemplate } from '../../../../services/project'
import { jsonResponse, optionsResponse, requireAuth, requireTeamId } from '../../../../server/api'
import { safeProject } from '../../../../server/projects'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET - Check if demo is available
export async function GET() {
  try {
    const available = await hasDemoTemplate()
    return jsonResponse({ available })
  } catch (error) {
    console.error('Failed to check demo availability:', error)
    return jsonResponse({ available: false })
  }
}

// POST - Create demo project
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    const project = await createDemoProject(auth.user!.id, team.teamId!)

    return jsonResponse(safeProject(project), 201)
  } catch (error) {
    console.error('Failed to create demo project:', error)

    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('already exists')) {
      return jsonResponse({ error: message }, 409)
    }
    if (message.includes('not available')) {
      return jsonResponse({ error: message }, 503)
    }

    return jsonResponse({ error: 'Failed to create demo project' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
