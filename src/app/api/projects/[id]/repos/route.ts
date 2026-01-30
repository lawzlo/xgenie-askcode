import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { addReposToProject, removeRepoFromProject } from '../../../../../services/project'
import {
  jsonResponse,
  optionsResponse,
  parseJson,
  requireAuth,
  requireTeamId
} from '../../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ id: string }>
}

const AddReposSchema = z.object({
  repos: z
    .array(
      z.object({
        gitUrl: z.string().url(),
        branch: z.string().optional(), // Auto-detect if not provided
        name: z.string().min(1)
      })
    )
    .min(1),
  gitProviderId: z.string().uuid().optional(),
  credentials: z.object({
    token: z.string()
  }).optional()
})

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    const parsedBody = await parseJson<z.infer<typeof AddReposSchema>>(request)
    if (parsedBody.response) return parsedBody.response

    console.log('Add repos request body:', JSON.stringify(parsedBody.data, null, 2))

    const parsed = AddReposSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request', details: parsed.error.errors }, 400)
    }

    const gitUrls = parsed.data.repos.map(repo => repo.gitUrl)
    const uniqueUrls = new Set(gitUrls)
    if (uniqueUrls.size !== gitUrls.length) {
      return jsonResponse({ error: 'Duplicate repos in request' }, 400)
    }

    const project = await addReposToProject(
      id,
      team.teamId!,
      parsed.data.repos,
      parsed.data.gitProviderId,
      parsed.data.credentials
    )
    return jsonResponse(project)
  } catch (error) {
    console.error('Failed to add repos to project:', error)
    if (error instanceof Error && error.message.includes('not found')) {
      return jsonResponse({ error: error.message }, 404)
    }
    if (error instanceof Error && error.message.includes('already exists')) {
      return jsonResponse({ error: error.message }, 400)
    }
    return jsonResponse(
      {
        error: 'Failed to add repos',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    const parsedBody = await parseJson<{ repoUrl?: string }>(request)
    if (parsedBody.response) return parsedBody.response

    const repoUrl = parsedBody.data?.repoUrl
    if (!repoUrl) {
      return jsonResponse({ error: 'Missing repoUrl in request body' }, 400)
    }

    const project = await removeRepoFromProject(id, team.teamId!, repoUrl)
    return jsonResponse(project)
  } catch (error) {
    console.error('Failed to remove repo from project:', error)
    if (error instanceof Error && error.message.includes('not found')) {
      return jsonResponse({ error: error.message }, 404)
    }
    return jsonResponse(
      {
        error: 'Failed to remove repo',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}

export function OPTIONS() {
  return optionsResponse()
}
