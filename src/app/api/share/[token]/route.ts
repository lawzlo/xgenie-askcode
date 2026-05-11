import type { NextRequest } from 'next/server'
import { supabase, supabaseAnon } from '../../../../lib/supabase'
import { jsonResponse, optionsResponse } from '../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ token: string }>
}

// Check if request has valid auth token
async function getAuthUser(request: NextRequest): Promise<{ id: string } | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7)
  try {
    const { data, error } = await supabaseAnon.auth.getUser(token)
    if (error || !data.user) return null
    return { id: data.user.id }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { token } = await params

    // Check if user is logged in
    const user = await getAuthUser(request)

    // Look up share record
    const { data: share, error: shareError } = await supabase
      .from('shared_conversations')
      .select('conversation_id, expires_at')
      .eq('share_token', token)
      .single()

    if (shareError || !share) {
      return jsonResponse({ error: 'Share link not found' }, 404)
    }

    const isExpired = new Date(share.expires_at) < new Date()
    if (isExpired) {
      return jsonResponse({ error: 'Share link has expired' }, 410)
    }

    // Get conversation details
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('question, answer, created_at, project_id')
      .eq('id', share.conversation_id)
      .single()

    if (convError || !conversation) {
      return jsonResponse({ error: 'Conversation not found' }, 404)
    }

    // Get project name
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', conversation.project_id)
      .single()

    // Check if user has already saved this conversation
    let isSaved = false
    if (user) {
      const { data: savedCheck } = await supabase
        .from('saved_conversations')
        .select('id')
        .eq('user_id', user.id)
        .eq('conversation_id', share.conversation_id)
        .single()
      isSaved = !!savedCheck
    }

    return jsonResponse({
      question: conversation.question,
      answer: conversation.answer,
      projectName: project?.name || 'Unknown Project',
      createdAt: conversation.created_at,
      expiresAt: share.expires_at,
      isExpired,
      isLoggedIn: !!user,
      isSaved
    })
  } catch (error) {
    console.error('Failed to get shared conversation:', error)
    return jsonResponse(
      {
        error: 'Failed to get shared conversation',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      500
    )
  }
}

export function OPTIONS() {
  return optionsResponse()
}
