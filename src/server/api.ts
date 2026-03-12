import { NextResponse } from 'next/server'
import { supabaseAnon } from '../lib/supabase'
import { hasTeamAccess } from '../services/team'

export type AuthUser = {
  id: string
  email: string
}

const baseCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Team-Id',
  'Cache-Control': 'no-store'
}

export function jsonResponse(data: unknown, status = 200, headers?: HeadersInit): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { ...baseCorsHeaders, ...(headers || {}) }
  })
}

export function optionsResponse(): NextResponse {
  return new NextResponse(null, { status: 204, headers: baseCorsHeaders })
}

export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204, headers: baseCorsHeaders })
}

export function withCors(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(baseCorsHeaders)) {
    response.headers.set(key, value)
  }
  return response
}

export async function parseJson<T>(
  request: Request
): Promise<{ data?: T; response?: NextResponse }> {
  try {
    const data = await request.json()
    return { data }
  } catch {
    return { response: jsonResponse({ error: 'Invalid JSON' }, 400) }
  }
}

export async function requireAuth(
  request: Request
): Promise<{ user?: AuthUser; response?: NextResponse }> {
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { response: jsonResponse({ error: 'Missing or invalid authorization header' }, 401) }
  }

  const token = authHeader.slice(7)

  try {
    const { data, error } = await supabaseAnon.auth.getUser(token)

    if (error || !data.user) {
      return { response: jsonResponse({ error: 'Invalid or expired token' }, 401) }
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email || ''
      }
    }
  } catch {
    return { response: jsonResponse({ error: 'Authentication failed' }, 401) }
  }
}

export async function requireTeamId(
  request: Request,
  userId: string
): Promise<{ teamId?: string; response?: NextResponse }> {
  const teamId = request.headers.get('x-team-id')
  if (!teamId) {
    return { response: jsonResponse({ error: 'Missing X-Team-Id header' }, 400) }
  }

  const hasAccess = await hasTeamAccess(teamId, userId)
  if (!hasAccess) {
    return { response: jsonResponse({ error: 'No access to this team' }, 403) }
  }

  return { teamId }
}

export function getRequestOrigin(request: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    'localhost'
  return `${proto}://${host}`
}
