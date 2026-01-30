-- =====================================================
-- AskCode Database Schema
-- Migration: 002_git_providers
-- Created: 2024-01-27
-- Description: Add git_providers table for OAuth connections
-- =====================================================

-- =====================================================
-- Table: git_providers
-- Stores OAuth connections to Git providers (GitHub, Gitea, etc.)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.git_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'gitea', 'gitlab', 'bitbucket')),
  name TEXT NOT NULL,                    -- Display name (e.g., "My GitHub", "Work Gitea")
  api_url TEXT,                          -- For self-hosted (Gitea, GitLab)
  client_id TEXT,
  client_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  account_id TEXT,                       -- Provider's user ID
  account_name TEXT,                     -- Provider's username
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider, account_id)
);

COMMENT ON TABLE public.git_providers IS 'OAuth connections to Git providers';
COMMENT ON COLUMN public.git_providers.provider IS 'Provider type: github, gitea, gitlab, bitbucket';
COMMENT ON COLUMN public.git_providers.api_url IS 'API URL for self-hosted instances';
COMMENT ON COLUMN public.git_providers.access_token IS 'OAuth access token (encrypted in production)';

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_git_providers_user_id ON public.git_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_git_providers_provider ON public.git_providers(provider);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE public.git_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own git providers" ON public.git_providers;

CREATE POLICY "Users can manage own git providers"
  ON public.git_providers
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- Permissions
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.git_providers TO authenticated;
GRANT ALL ON public.git_providers TO service_role;

-- =====================================================
-- Update projects table to link with git_provider
-- =====================================================

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS git_provider_id UUID REFERENCES public.git_providers(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.projects.git_provider_id IS 'Optional link to git provider for authenticated access';
