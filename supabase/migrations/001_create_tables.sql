-- =====================================================
-- AskCode Database Schema
-- Migration: 001_create_tables
-- Created: 2024-01-27
-- Description: Initial schema for projects and conversations
-- =====================================================

-- =====================================================
-- Table: projects
-- Stores user's code projects (git repositories)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  git_url TEXT NOT NULL,
  branch TEXT DEFAULT 'main',
  workspace_path TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

COMMENT ON TABLE public.projects IS 'User code projects (git repositories)';
COMMENT ON COLUMN public.projects.user_id IS 'Owner of the project';
COMMENT ON COLUMN public.projects.workspace_path IS 'Local filesystem path where repo is cloned';

-- =====================================================
-- Table: conversations
-- Stores Q&A history for each project
-- =====================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  files_read TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.conversations IS 'Q&A conversation history per project';
COMMENT ON COLUMN public.conversations.files_read IS 'Array of file paths AI read to answer';

-- =====================================================
-- Indexes (for query performance)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON public.conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at ASC);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can manage conversations of own projects" ON public.conversations;

-- Projects: Users can only access their own projects
CREATE POLICY "Users can manage own projects"
  ON public.projects
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Conversations: Users can only access conversations of their projects
CREATE POLICY "Users can manage conversations of own projects"
  ON public.conversations
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- Permissions
-- =====================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;

-- Grant full access to service role (for backend operations)
GRANT ALL ON public.projects TO service_role;
GRANT ALL ON public.conversations TO service_role;

-- =====================================================
-- Default privileges for future objects
-- =====================================================

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON TABLES TO postgres, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL ON SEQUENCES TO postgres, authenticated, service_role;
