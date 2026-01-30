-- Add redirect_uri column to git_providers
ALTER TABLE public.git_providers
ADD COLUMN IF NOT EXISTS redirect_uri TEXT;

COMMENT ON COLUMN public.git_providers.redirect_uri IS 'OAuth redirect URI (stored for consistency)';
