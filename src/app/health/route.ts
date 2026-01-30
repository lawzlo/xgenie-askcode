import { jsonResponse, optionsResponse } from '../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET() {
  return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() })
}

export function OPTIONS() {
  return optionsResponse()
}
