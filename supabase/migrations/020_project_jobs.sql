-- =====================================================
-- Migration: 020_project_jobs
-- Description: Project job queue for background sync/clone
-- =====================================================

CREATE TABLE IF NOT EXISTS public.project_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  payload JSONB,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_jobs_status_check CHECK (status IN ('queued', 'running', 'success', 'error')),
  CONSTRAINT project_jobs_type_check CHECK (type IN ('clone', 'sync', 'add_repos'))
);

CREATE INDEX IF NOT EXISTS idx_project_jobs_status_run_after
  ON public.project_jobs(status, run_after, created_at);

CREATE INDEX IF NOT EXISTS idx_project_jobs_project_id
  ON public.project_jobs(project_id);

ALTER TABLE public.project_jobs ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.project_jobs TO service_role;

-- Keep updated_at current on updates
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

-- Claim a single queued job atomically
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
