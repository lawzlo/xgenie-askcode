-- Teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Team members (not including owner, owner is in teams.owner_id)
CREATE TABLE public.team_members (
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

-- Team invites (by email)
CREATE TABLE public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, email)
);

-- Add team_id to projects
ALTER TABLE public.projects
ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- Add team_id to git_providers
ALTER TABLE public.git_providers
ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX idx_teams_owner_id ON public.teams(owner_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_team_invites_email ON public.team_invites(email);
CREATE INDEX idx_projects_team_id ON public.projects(team_id);
CREATE INDEX idx_git_providers_team_id ON public.git_providers(team_id);

-- RLS policies
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Teams: owner or member can view
CREATE POLICY "Users can view own teams" ON public.teams FOR SELECT USING (
  owner_id = auth.uid() OR
  id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);

-- Teams: only owner can update/delete
CREATE POLICY "Owner can manage team" ON public.teams FOR ALL USING (
  owner_id = auth.uid()
);

-- Team members: team owner or member can view
CREATE POLICY "Team members visible to team" ON public.team_members FOR SELECT USING (
  team_id IN (
    SELECT id FROM public.teams WHERE owner_id = auth.uid()
    UNION
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  )
);

-- Team members: only owner can manage
CREATE POLICY "Owner can manage members" ON public.team_members FOR ALL USING (
  team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
);

-- Team invites: owner can manage
CREATE POLICY "Owner can manage invites" ON public.team_invites FOR ALL USING (
  team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid())
);

-- Update projects RLS to use team
DROP POLICY IF EXISTS "Users can manage own projects" ON public.projects;
CREATE POLICY "Users can manage team projects" ON public.projects FOR ALL USING (
  team_id IN (
    SELECT id FROM public.teams WHERE owner_id = auth.uid()
    UNION
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  )
);

-- Update git_providers RLS to use team
DROP POLICY IF EXISTS "Users can manage own git_providers" ON public.git_providers;
CREATE POLICY "Users can manage team git_providers" ON public.git_providers FOR ALL USING (
  team_id IN (
    SELECT id FROM public.teams WHERE owner_id = auth.uid()
    UNION
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  )
);

-- Add user_id to conversations for per-user history
ALTER TABLE public.conversations
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Index for user conversations
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);

-- Update conversations RLS - users can only access their own conversations
DROP POLICY IF EXISTS "Users can manage conversations of own projects" ON public.conversations;
CREATE POLICY "Users can manage own conversations" ON public.conversations FOR ALL USING (
  user_id = auth.uid()
);

COMMENT ON TABLE public.teams IS 'Teams/workspaces for sharing resources';
COMMENT ON TABLE public.team_members IS 'Team membership (excluding owner)';
COMMENT ON TABLE public.team_invites IS 'Pending invitations by email';
