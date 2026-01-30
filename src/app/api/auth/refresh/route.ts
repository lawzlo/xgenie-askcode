import { supabaseAnon } from '../../../../lib/supabase'
import { jsonResponse, optionsResponse, parseJson } from '../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const parsedBody = await parseJson<{ refresh_token: string }>(request)
    if (parsedBody.response) return parsedBody.response

    const { refresh_token } = parsedBody.data || {}
    if (!refresh_token) {
      return jsonResponse({ error: 'Missing refresh_token' }, 400)
    }

    const { data, error } = await supabaseAnon.auth.refreshSession({
      refresh_token
    })

    if (error || !data.session) {
      return jsonResponse({ error: error?.message || 'Failed to refresh session' }, 401)
    }

    return jsonResponse({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      },
      user: data.user
    })
  } catch (error) {
    console.error('Refresh error:', error)
    return jsonResponse({ error: 'Failed to refresh session' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
