-- =====================================================
-- Migration: 022_saved_credentials
-- Description: Saved credentials for reusable access tokens
-- =====================================================

CREATE TABLE IF NOT EXISTS public.saved_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'other',
  credentials JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_credentials_team
  ON public.saved_credentials(team_id);

ALTER TABLE public.saved_credentials ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.saved_credentials TO service_role;
