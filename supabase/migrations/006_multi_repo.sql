-- Add git_urls column to support multiple repos per project
ALTER TABLE public.projects
ADD COLUMN git_urls JSONB DEFAULT '[]';

COMMENT ON COLUMN public.projects.git_urls IS 'Array of {url, branch, name} for multi-repo projects';
