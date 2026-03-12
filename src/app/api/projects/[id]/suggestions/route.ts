import type { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getProject } from '../../../../../services/project'
import { hasTeamAccess } from '../../../../../services/team'
import { listDirectory } from '../../../../../tools'
import { jsonResponse, optionsResponse, requireAuth } from '../../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ id: string }>
}

const client = new Anthropic()

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: projectId } = await params
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

    // Get project file structure (top level only for speed)
    let fileStructure: string[] = []
    try {
      fileStructure = await listDirectory(project.workspacePath, '.')
    } catch {
      // Workspace might not exist yet
    }

    // Generate suggestions using AI
    const suggestions = await generateSuggestions(project.name, fileStructure)

    return jsonResponse({ suggestions })
  } catch (error) {
    console.error('Failed to generate suggestions:', error)
    return jsonResponse({ error: 'Failed to generate suggestions' }, 500)
  }
}

async function generateSuggestions(projectName: string, files: string[]): Promise<string[]> {
  const fileList = files.slice(0, 30).join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Based on this project, suggest 4 short questions (under 40 characters each) that a non-technical person might ask to understand what this software does.

Project name: ${projectName}

Top-level files/folders:
${fileList || '(no files visible)'}

Return ONLY a JSON array of 4 question strings, nothing else. Example:
["What does this app do?", "How do users sign up?", "What data is stored?", "How are payments handled?"]`
      }
    ]
  })

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(text.trim())
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 4)
    }
  } catch {
    // Fallback to default suggestions
  }

  return [
    'What does this project do?',
    'What are the main features?',
    'How do users interact with it?',
    'What data does it manage?'
  ]
}

export function OPTIONS() {
  return optionsResponse()
}
