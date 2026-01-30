import { supabaseAnon } from '../../../../lib/supabase'
import { jsonResponse, optionsResponse, requireAuth } from '../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireAuth(request)
  if (auth.response) return auth.response

  try {
    await supabaseAnon.auth.signOut()
    return jsonResponse({ success: true })
  } catch {
    return jsonResponse({ error: 'Failed to logout' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
