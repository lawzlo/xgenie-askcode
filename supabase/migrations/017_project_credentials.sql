-- Store credentials for manual-added private repos
-- This allows re-cloning after deployment
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS credentials JSONB;
