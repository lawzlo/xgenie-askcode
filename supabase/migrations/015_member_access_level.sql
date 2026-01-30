-- Add access_level column to team_members
-- 100 = Full (developers), 60 = Internal (product/ops), 30 = External (end users)
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS access_level INTEGER DEFAULT 60;

-- Update existing owners to have full access
UPDATE public.team_members tm
SET access_level = 100
FROM public.teams t
WHERE tm.team_id = t.id AND tm.user_id = t.owner_id;
