-- Store the latest sync failure reason so the UI can show it
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS sync_error TEXT;

COMMENT ON COLUMN public.projects.sync_error IS 'Latest background sync failure reason for the project';
