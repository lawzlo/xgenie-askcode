import type { NextRequest } from 'next/server'
import { supabase } from '../../../../../lib/supabase'
import { hasTeamAccess } from '../../../../../services/team'
import { jsonResponse, optionsResponse, requireAuth } from '../../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: teamId } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const hasAccess = await hasTeamAccess(teamId, auth.user!.id)
    if (!hasAccess) {
      return jsonResponse({ error: 'No access to this team' }, 403)
    }

    // Check if user is team owner
    const { data: team } = await supabase
      .from('teams')
      .select('owner_id')
      .eq('id', teamId)
      .single()

    if (!team || team.owner_id !== auth.user!.id) {
      return jsonResponse({ error: 'Only team owner can view audit logs' }, 403)
    }

    // Get pagination params
    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Fetch audit logs
    const { data: logs, error, count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Failed to fetch audit logs:', error)
      return jsonResponse({ error: 'Failed to fetch audit logs' }, 500)
    }

    return jsonResponse({
      logs: logs || [],
      total: count || 0,
      limit,
      offset
    })
  } catch (error) {
    console.error('Failed to fetch audit logs:', error)
    return jsonResponse({ error: 'Failed to fetch audit logs' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
