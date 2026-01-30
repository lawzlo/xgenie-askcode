-- Remove unnecessary user delete trigger (was added in 009 but not needed)
-- User deletion from Supabase Dashboard was fixed by correcting SUPABASE_PUBLIC_URL config

DROP TRIGGER IF EXISTS on_auth_user_delete ON auth.users;
DROP FUNCTION IF EXISTS public.handle_user_delete();
