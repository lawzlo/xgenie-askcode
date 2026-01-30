import type { NextRequest } from 'next/server'
import { supabase } from '../../../../lib/supabase'
import { jsonResponse, noContentResponse, optionsResponse, requireAuth } from '../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ id: string }>
}

// DELETE - Unsave a conversation
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const auth = await requireAuth(request)
    if (auth.response) return auth.response

    const { error } = await supabase
      .from('saved_conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user!.id)

    if (error) {
      console.error('Failed to unsave conversation:', error)
      return jsonResponse({ error: 'Failed to unsave conversation' }, 500)
    }

    return noContentResponse()
  } catch (error) {
    console.error('Failed to unsave conversation:', error)
    return jsonResponse({ error: 'Failed to unsave conversation' }, 500)
  }
}

// GET - Get a single saved conversation
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
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
      .eq('id', id)
      .eq('user_id', auth.user!.id)
      .single()

    if (error || !saved) {
      return jsonResponse({ error: 'Saved conversation not found' }, 404)
    }

    type ConversationData = {
      question: string
      answer: string
      created_at: string
      project_id: string
      projects: { name: string } | { name: string }[] | null
    }

    const conv = saved.conversations as unknown as ConversationData | null

    // Handle projects being either object or array (Supabase join quirk)
    const projectName = conv?.projects
      ? Array.isArray(conv.projects)
        ? conv.projects[0]?.name
        : conv.projects.name
      : 'Unknown Project'

    return jsonResponse({
      id: saved.id,
      savedAt: saved.saved_at,
      conversationId: saved.conversation_id,
      question: conv?.question || '',
      answer: conv?.answer || '',
      createdAt: conv?.created_at,
      projectName: projectName || 'Unknown Project'
    })
  } catch (error) {
    console.error('Failed to get saved conversation:', error)
    return jsonResponse({ error: 'Failed to get saved conversation' }, 500)
  }
}

export function OPTIONS() {
  return optionsResponse()
}
