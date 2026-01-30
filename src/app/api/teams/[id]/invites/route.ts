import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { getTeamInvites, inviteToTeam, isTeamOwner } from '../../../../../services/team'
import {
  getRequestOrigin,
  jsonResponse,
  optionsResponse,
  parseJson,
  requireAuth
} from '../../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ id: string }>
}

const InviteSchema = z.object({
  email: z.string().email()
})

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const isOwner = await isTeamOwner(id, auth.user!.id)
    if (!isOwner) {
      return jsonResponse({ error: 'Only team owner can view invites' }, 403)
    }

    const invites = await getTeamInvites(id)
    return jsonResponse(invites)
  } catch (error) {
    console.error('Error getting invites:', error)
    return jsonResponse({ error: 'Failed to get invites' }, 500)
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const isOwner = await isTeamOwner(id, auth.user!.id)
    if (!isOwner) {
      return jsonResponse({ error: 'Only team owner can invite members' }, 403)
    }

    const parsedBody = await parseJson<z.infer<typeof InviteSchema>>(request)
    if (parsedBody.response) return parsedBody.response

    const parsed = InviteSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request', details: parsed.error.errors }, 400)
    }

    const redirectTo = `${getRequestOrigin(request)}/`
    const invite = await inviteToTeam(id, parsed.data.email, auth.user!.id, redirectTo)
    return jsonResponse(invite, 201)
  } catch (error: unknown) {
    console.error('Error inviting user:', error)
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: string }).code
        : undefined
    if (code === '23505') {
      return jsonResponse({ error: 'User already invited' }, 409)
    }
    return jsonResponse({ error: 'Failed to invite user' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
