-- Add sync_status column to projects table
-- Values: 'pending', 'syncing', 'ready', 'error'
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'ready';

-- Existing projects are assumed to be ready (they were synced when created)
-- New projects will default to 'ready' since they sync immediately on creation
