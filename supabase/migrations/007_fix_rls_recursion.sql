-- Fix RLS infinite recursion between teams and team_members
-- Create SECURITY DEFINER function to check team membership without triggering RLS

-- Drop existing function first (handles parameter name changes)
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

-- Drop old policies that cause recursion (in case they still exist)
DROP POLICY IF EXISTS "Users can view own teams" ON public.teams;
DROP POLICY IF EXISTS "Team members visible to team" ON public.team_members;

-- Create new policy for teams - uses SECURITY DEFINER function
CREATE POLICY "Users can view own teams" ON public.teams
FOR SELECT USING (
  owner_id = auth.uid()
  OR public.is_team_member(id)
);

-- Create new policy for team_members - uses SECURITY DEFINER function
CREATE POLICY "Team members visible to team" ON public.team_members
FOR SELECT USING (
  user_id = auth.uid()
  OR public.is_team_member(team_id)
);
