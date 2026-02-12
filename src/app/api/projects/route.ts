import { z } from 'zod'
import { createProject, listProjects } from '../../../services/project'
import { requireAuth, requireTeamId, jsonResponse, optionsResponse, parseJson } from '../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  gitUrl: z.string().url(),
  branch: z.string().optional(),
  credentials: z
    .object({
      token: z.string()
    })
    .optional(),
  gitProviderId: z.string().uuid().optional()
})

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    const projects = await listProjects(team.teamId!)
    const safeProjects = projects.map(project => ({
      ...project,
      credentials: project.credentials ? { hasToken: true } : undefined
    }))

    return jsonResponse(safeProjects)
  } catch {
    return jsonResponse({ error: 'Failed to list projects' }, 500)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const team = await requireTeamId(request, auth.user!.id)
    if (team.response) return team.response

    const parsedBody = await parseJson<z.infer<typeof CreateProjectSchema>>(request)
    if (parsedBody.response) return parsedBody.response

    const parsed = CreateProjectSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request', details: parsed.error.errors }, 400)
    }

    const project = await createProject(auth.user!.id, team.teamId!, parsed.data)
    return jsonResponse(
      {
        ...project,
        credentials: project.credentials ? { hasToken: true } : undefined
      },
      201
    )
  } catch (error) {
    console.error('Failed to create project:', error)
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
