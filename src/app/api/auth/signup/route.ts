import { z } from 'zod'
import { supabaseAnon } from '../../../../lib/supabase'
import { createTeam } from '../../../../services/team'
import { jsonResponse, optionsResponse, parseJson } from '../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const AuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

export async function POST(request: Request) {
  try {
    const parsedBody = await parseJson<{ email: string; password: string }>(request)
    if (parsedBody.response) return parsedBody.response

    const parsed = AuthSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request', details: parsed.error.errors }, 400)
    }

    const { email, password } = parsed.data
    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password
    })

    if (error) {
      return jsonResponse({ error: error.message }, 400)
    }

    let team = null
    if (data.user) {
      try {
        const teamName = `${email.split('@')[0]}'s workspace`
        team = await createTeam(data.user.id, teamName)
      } catch (teamError) {
        console.error('Error creating team for new user:', teamError)
      }
    }

    return jsonResponse(
      {
        user: data.user ? { id: data.user.id, email: data.user.email } : null,
        session: data.session,
        team
      },
      201
    )
  } catch (error) {
    console.error('Signup error:', error)
    return jsonResponse({ error: 'Failed to sign up' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
