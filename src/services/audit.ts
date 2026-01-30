import { supabase } from '../lib/supabase'

export type AuditAction = 'ask_question'
export type AuditResourceType = 'conversation'

export interface AuditLogParams {
  teamId: string
  userId: string
  userEmail: string
  action: AuditAction
  resourceType: AuditResourceType
  resourceId?: string
  metadata?: Record<string, unknown>
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  const { teamId, userId, userEmail, action, resourceType, resourceId, metadata } = params

  const { error } = await supabase.from('audit_logs').insert({
    team_id: teamId,
    user_id: userId,
    user_email: userEmail,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata
  })

  if (error) {
    console.error('Failed to write audit log:', error)
  }
}
