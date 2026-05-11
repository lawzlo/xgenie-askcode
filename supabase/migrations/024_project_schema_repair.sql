-- =====================================================
-- Migration: 024_project_schema_repair
-- Description: Idempotent repair for schemas that predate the migration ledger.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  access_level INTEGER DEFAULT 60 CHECK (access_level IN (30, 60, 100)),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, email)
);

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS access_level INTEGER DEFAULT 60;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS git_urls JSONB,
  ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS credentials JSONB,
  ADD COLUMN IF NOT EXISTS sync_error TEXT;

ALTER TABLE public.git_providers
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS redirect_uri TEXT,
  ADD COLUMN IF NOT EXISTS github_app_id INTEGER,
  ADD COLUMN IF NOT EXISTS github_app_name TEXT,
  ADD COLUMN IF NOT EXISTS github_installation_id TEXT,
  ADD COLUMN IF NOT EXISTS github_private_key TEXT,
  ADD COLUMN IF NOT EXISTS github_webhook_secret TEXT;

CREATE TABLE IF NOT EXISTS public.project_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  payload JSONB,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_jobs
  ADD COLUMN IF NOT EXISTS error TEXT,
  ADD COLUMN IF NOT EXISTS run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

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

CREATE INDEX IF NOT EXISTS idx_projects_team_id ON public.projects(team_id);
CREATE INDEX IF NOT EXISTS idx_git_providers_team_id ON public.git_providers(team_id);
CREATE INDEX IF NOT EXISTS idx_project_jobs_status_run_after ON public.project_jobs(status, run_after, created_at);
CREATE INDEX IF NOT EXISTS idx_project_jobs_project_id ON public.project_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_saved_credentials_team ON public.saved_credentials(team_id);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_credentials ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.project_jobs TO service_role;
GRANT ALL ON public.saved_credentials TO service_role;

CREATE OR REPLACE FUNCTION public.set_project_jobs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_project_jobs_updated_at ON public.project_jobs;

CREATE TRIGGER set_project_jobs_updated_at
  BEFORE UPDATE ON public.project_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_jobs_updated_at();

CREATE OR REPLACE FUNCTION public.claim_project_job(worker_id TEXT)
RETURNS public.project_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_row public.project_jobs;
BEGIN
  WITH candidate AS (
    SELECT id
    FROM public.project_jobs
    WHERE status = 'queued'
      AND run_after <= now()
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.project_jobs
  SET status = 'running',
      locked_by = worker_id,
      started_at = now(),
      attempts = attempts + 1,
      updated_at = now()
  WHERE id IN (SELECT id FROM candidate)
  RETURNING * INTO job_row;

  RETURN job_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_project_job(TEXT) TO service_role;
