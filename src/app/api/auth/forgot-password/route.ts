import { z } from 'zod'
import { supabaseAnon } from '../../../../lib/supabase'
import { getRequestOrigin, jsonResponse, optionsResponse, parseJson } from '../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EmailSchema = z.object({
  email: z.string().email()
})

export async function POST(request: Request) {
  try {
    const parsedBody = await parseJson<{ email: string }>(request)
    if (parsedBody.response) return parsedBody.response

    const parsed = EmailSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid email' }, 400)
    }

    const { email } = parsed.data
    const redirectTo = `${getRequestOrigin(request)}/#reset-password`

    const { error } = await supabaseAnon.auth.resetPasswordForEmail(email, {
      redirectTo
    })

    if (error) {
      console.error('Reset password error:', error)
    }

    return jsonResponse({
      success: true,
      message: 'If an account exists, a reset email has been sent'
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return jsonResponse({ error: 'Failed to process request' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
