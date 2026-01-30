import { supabase } from '../../../../lib/supabase'
import { jsonResponse, optionsResponse, requireAuth } from '../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const userId = auth.user!.id

    // Delete the auth user - CASCADE handles all related data
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Error deleting auth user:', deleteError)
      return jsonResponse({ error: 'Failed to delete account' }, 500)
    }

    return jsonResponse({ message: 'Account deleted' })
  } catch (error) {
    console.error('Delete account error:', error)
    return jsonResponse({ error: 'Failed to delete account' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
