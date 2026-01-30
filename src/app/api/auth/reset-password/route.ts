import { z } from 'zod'
import { supabaseAnon } from '../../../../lib/supabase'
import { jsonResponse, optionsResponse, parseJson } from '../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ResetPasswordSchema = z.object({
  password: z.string().min(6),
  refresh_token: z.string().optional()
})

export async function POST(request: Request) {
  try {
    const parsedBody = await parseJson<{ password: string; refresh_token?: string }>(request)
    if (parsedBody.response) return parsedBody.response

    const parsed = ResetPasswordSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return jsonResponse({ error: 'Password must be at least 6 characters' }, 400)
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing authorization token' }, 401)
    }
    const accessToken = authHeader.slice(7)

    const { password, refresh_token: refreshToken } = parsed.data

    const { error: sessionError } = await supabaseAnon.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || ''
    })

    if (sessionError) {
      console.error('Session error:', sessionError)
      return jsonResponse({ error: 'Invalid or expired token' }, 401)
    }

    const { error } = await supabaseAnon.auth.updateUser({ password })

    if (error) {
      return jsonResponse({ error: error.message }, 400)
    }

    return jsonResponse({ success: true, message: 'Password updated successfully' })
  } catch (error) {
    console.error('Reset password error:', error)
    return jsonResponse({ error: 'Failed to reset password' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
