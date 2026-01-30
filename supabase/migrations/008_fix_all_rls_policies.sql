-- Fix all RLS policies to avoid infinite recursion
-- Use SECURITY DEFINER functions to check team membership/ownership

-- ============================================
-- Helper functions (SECURITY DEFINER)
-- ============================================

-- Check if user is team member (already exists from 007, but recreate for safety)
DROP FUNCTION IF EXISTS public.is_team_member(UUID) CASCADE;
CREATE FUNCTION public.is_team_member(check_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_members.team_id = check_team_id
    AND team_members.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is team owner
DROP FUNCTION IF EXISTS public.is_team_owner(UUID) CASCADE;
CREATE FUNCTION public.is_team_owner(check_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.teams
    WHERE teams.id = check_team_id
    AND teams.owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user has access to team (owner or member)
DROP FUNCTION IF EXISTS public.has_team_access(UUID) CASCADE;
CREATE FUNCTION public.has_team_access(check_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.is_team_owner(check_team_id) OR public.is_team_member(check_team_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- TEAMS table policies
-- ============================================
DROP POLICY IF EXISTS "Users can view own teams" ON public.teams;
DROP POLICY IF EXISTS "Owner can manage team" ON public.teams;

CREATE POLICY "Users can view own teams" ON public.teams
FOR SELECT USING (
  owner_id = auth.uid() OR public.is_team_member(id)
);

CREATE POLICY "Owner can manage team" ON public.teams
FOR ALL USING (owner_id = auth.uid());

-- ============================================
-- TEAM_MEMBERS table policies
-- ============================================
DROP POLICY IF EXISTS "Team members visible to team" ON public.team_members;
DROP POLICY IF EXISTS "Owner can manage members" ON public.team_members;

CREATE POLICY "Team members visible to team" ON public.team_members
FOR SELECT USING (
  user_id = auth.uid() OR public.has_team_access(team_id)
);

CREATE POLICY "Owner can manage members" ON public.team_members
FOR ALL USING (public.is_team_owner(team_id));

-- ============================================
-- TEAM_INVITES table policies
-- ============================================
DROP POLICY IF EXISTS "Owner can manage invites" ON public.team_invites;

CREATE POLICY "Owner can manage invites" ON public.team_invites
FOR ALL USING (public.is_team_owner(team_id));

-- ============================================
-- PROJECTS table policies
-- ============================================
DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can manage team projects" ON public.projects;

CREATE POLICY "Users can manage team projects" ON public.projects
FOR ALL USING (public.has_team_access(team_id));

-- ============================================
-- GIT_PROVIDERS table policies
-- ============================================
DROP POLICY IF EXISTS "Users can manage own git providers" ON public.git_providers;
DROP POLICY IF EXISTS "Users can manage team git_providers" ON public.git_providers;

CREATE POLICY "Users can manage team git_providers" ON public.git_providers
FOR ALL USING (public.has_team_access(team_id));

-- ============================================
-- CONVERSATIONS table policies
-- ============================================
DROP POLICY IF EXISTS "Users can manage conversations of own projects" ON public.conversations;
DROP POLICY IF EXISTS "Users can manage own conversations" ON public.conversations;

-- Conversations are tied to projects, which are tied to teams
CREATE POLICY "Users can manage conversations" ON public.conversations
FOR ALL USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = conversations.project_id
    AND public.has_team_access(projects.team_id)
  )
);
