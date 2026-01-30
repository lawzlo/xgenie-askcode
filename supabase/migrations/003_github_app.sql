-- =====================================================
-- AskCode Database Schema
-- Migration: 003_github_app
-- Created: 2024-01-27
-- Description: Add GitHub App specific fields to git_providers
-- =====================================================

-- Add GitHub App specific columns
ALTER TABLE public.git_providers
ADD COLUMN IF NOT EXISTS github_app_id INTEGER,
ADD COLUMN IF NOT EXISTS github_app_name TEXT,
ADD COLUMN IF NOT EXISTS github_installation_id TEXT,
ADD COLUMN IF NOT EXISTS github_private_key TEXT,
ADD COLUMN IF NOT EXISTS github_webhook_secret TEXT;

COMMENT ON COLUMN public.git_providers.github_app_id IS 'GitHub App ID (for GitHub App auth)';
COMMENT ON COLUMN public.git_providers.github_app_name IS 'GitHub App name';
COMMENT ON COLUMN public.git_providers.github_installation_id IS 'GitHub App Installation ID';
COMMENT ON COLUMN public.git_providers.github_private_key IS 'GitHub App private key (PEM format)';
COMMENT ON COLUMN public.git_providers.github_webhook_secret IS 'GitHub webhook secret for verifying payloads';
