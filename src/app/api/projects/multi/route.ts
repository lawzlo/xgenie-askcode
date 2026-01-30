import { z } from 'zod'
import { createMultiRepoProject } from '../../../../services/project'
import { jsonResponse, optionsResponse, parseJson, requireAuth, requireTeamId } from '../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CreateMultiRepoProjectSchema = z.object({
  name: z.string().min(1).max(100),
  repos: z
    .array(
      z.object({
        gitUrl: z.string().url(),
        branch: z.string(),
        name: z.string().min(1)
      })
    )
    .min(1),
  gitProviderId: z.string().uuid().optional()
})

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    const parsedBody = await parseJson<z.infer<typeof CreateMultiRepoProjectSchema>>(request)
    if (parsedBody.response) return parsedBody.response

    const parsed = CreateMultiRepoProjectSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request', details: parsed.error.errors }, 400)
    }

    const gitUrls = parsed.data.repos.map(repo => repo.gitUrl)
    const uniqueUrls = new Set(gitUrls)
    if (uniqueUrls.size !== gitUrls.length) {
      return jsonResponse({ error: 'Duplicate repos not allowed in the same project' }, 400)
    }

    const project = await createMultiRepoProject(auth.user!.id, team.teamId!, parsed.data)
    return jsonResponse(project, 201)
  } catch (error) {
    console.error('Failed to create multi repo project:', error)
    return jsonResponse(
      {
        error: 'Failed to create project',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}

export function OPTIONS() {
  return optionsResponse()
}
