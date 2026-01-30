import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabase } from '../../../lib/supabase'
import { jsonResponse, optionsResponse, parseJson, requireAuth } from '../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SaveSchema = z.object({
  shareToken: z.string().min(1)
})

// POST - Save a shared conversation
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const parsedBody = await parseJson<z.infer<typeof SaveSchema>>(request)
    if (parsedBody.response) return parsedBody.response

    const parsed = SaveSchema.safeParse(parsedBody.data)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request', details: parsed.error.errors }, 400)
    }

    const { shareToken } = parsed.data

    // Look up the share to get conversation_id
    const { data: share, error: shareError } = await supabase
      .from('shared_conversations')
      .select('conversation_id')
      .eq('share_token', shareToken)
      .single()

    if (shareError || !share) {
      return jsonResponse({ error: 'Share link not found' }, 404)
    }

    // Save the conversation
    const { data: saved, error: saveError } = await supabase
      .from('saved_conversations')
      .insert({
        user_id: auth.user!.id,
        conversation_id: share.conversation_id,
        source_share_token: shareToken
      })
      .select('id')
      .single()

    if (saveError) {
      if (saveError.code === '23505') {
        return jsonResponse({ error: 'Already saved' }, 409)
      }
      console.error('Failed to save conversation:', saveError)
      return jsonResponse({ error: 'Failed to save conversation' }, 500)
    }

    return jsonResponse({ id: saved.id, message: 'Saved' }, 201)
  } catch (error) {
    console.error('Failed to save conversation:', error)
    return jsonResponse({ error: 'Failed to save conversation' }, 500)
  }
}

// GET - List saved conversations
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const { data: saved, error } = await supabase
      .from('saved_conversations')
      .select(`
        id,
        saved_at,
        conversation_id,
        conversations (
          question,
          answer,
          created_at,
          project_id,
          projects (
            name
          )
        )
      `)
      .eq('user_id', auth.user!.id)
      .order('saved_at', { ascending: false })

    if (error) {
      console.error('Failed to list saved conversations:', error)
      return jsonResponse({ error: 'Failed to list saved conversations' }, 500)
    }

    type ConversationData = {
      question: string
      answer: string
      created_at: string
      project_id: string
      projects: { name: string } | { name: string }[] | null
    }

    const result = (saved || []).map((item) => {
      const conv = item.conversations as unknown as ConversationData | null

      // Handle projects being either object or array (Supabase join quirk)
      const projectName = conv?.projects
        ? Array.isArray(conv.projects)
          ? conv.projects[0]?.name
          : conv.projects.name
        : 'Unknown Project'

      return {
        id: item.id,
        savedAt: item.saved_at,
        conversationId: item.conversation_id,
        question: conv?.question || '',
        answer: conv?.answer || '',
        createdAt: conv?.created_at,
        projectName: projectName || 'Unknown Project'
      }
    })

    return jsonResponse(result)
  } catch (error) {
    console.error('Failed to list saved conversations:', error)
    return jsonResponse({ error: 'Failed to list saved conversations' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
