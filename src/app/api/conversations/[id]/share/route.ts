import type { NextRequest } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { supabase } from '../../../../../lib/supabase'
import { getRequestOrigin, jsonResponse, optionsResponse, parseJson, requireAuth } from '../../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ id: string }>
}

const ShareSchema = z.object({
  expiresHours: z.number().min(1).max(168).default(24)
})

function generateShareToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: conversationId } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const parsedBody = await parseJson<z.infer<typeof ShareSchema>>(request)
    if (parsedBody.response) return parsedBody.response

    const parsed = ShareSchema.safeParse(parsedBody.data || {})
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request', details: parsed.error.errors }, 400)
    }

    const { expiresHours } = parsed.data

    // Verify conversation exists and belongs to user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      return jsonResponse({ error: 'Conversation not found' }, 404)
    }

    if (conversation.user_id !== auth.user!.id) {
      return jsonResponse({ error: 'Not authorized to share this conversation' }, 403)
    }

    // Generate share token and expiry
    const shareToken = generateShareToken()
    const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000)

    // Create share record
    const { error: insertError } = await supabase.from('shared_conversations').insert({
      conversation_id: conversationId,
      share_token: shareToken,
      expires_at: expiresAt.toISOString(),
      created_by: auth.user!.id
    })

    if (insertError) {
      console.error('Failed to create share:', insertError)
      return jsonResponse({ error: 'Failed to create share link' }, 500)
    }

    // Build share URL
    const shareUrl = `${getRequestOrigin(request)}/share/${shareToken}`

    return jsonResponse({
      shareUrl,
      shareToken,
      expiresAt: expiresAt.toISOString()
    })
  } catch (error) {
    console.error('Failed to create share link:', error)
    return jsonResponse(
      {
        error: 'Failed to create share link',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}

export function OPTIONS() {
  return optionsResponse()
}
