-- Audit logs table for tracking user actions
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for team-based queries (most common use case)
CREATE INDEX idx_audit_logs_team ON audit_logs(team_id, created_at DESC);

-- Index for user-based queries
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);

-- RLS policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Team owners can view audit logs for their team
CREATE POLICY "Team owners can view team audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id AND t.owner_id = auth.uid()
    )
  );

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid());
