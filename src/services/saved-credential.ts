import { supabase } from '../lib/supabase'

export interface SavedCredential {
  id: string
  user_id: string
  team_id: string
  name: string
  platform: string
  credentials: { token: string }
  created_at: string
}

export async function getSavedCredentials(teamId: string): Promise<SavedCredential[]> {
  const { data, error } = await supabase
    .from('saved_credentials')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list saved credentials: ${error.message}`)
  return data || []
}

export async function getSavedCredential(id: string, teamId: string): Promise<SavedCredential | null> {
  const { data, error } = await supabase
    .from('saved_credentials')
    .select('*')
    .eq('id', id)
    .eq('team_id', teamId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Failed to get saved credential: ${error.message}`)
  }
  return data
}

export async function createSavedCredential(
  userId: string,
  teamId: string,
  name: string,
  platform: string,
  credentials: { token: string }
): Promise<SavedCredential> {
  const { data, error } = await supabase
    .from('saved_credentials')
    .insert({ user_id: userId, team_id: teamId, name, platform, credentials })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error(`A credential with name "${name}" already exists`)
    }
    throw new Error(`Failed to create saved credential: ${error.message}`)
  }
  return data
}

export async function deleteSavedCredential(id: string, teamId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_credentials')
    .delete()
    .eq('id', id)
    .eq('team_id', teamId)

  if (error) throw new Error(`Failed to delete saved credential: ${error.message}`)
}
