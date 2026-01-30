import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Service role client (bypasses RLS, for server-side operations)
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// Anon client (for auth operations)
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)
