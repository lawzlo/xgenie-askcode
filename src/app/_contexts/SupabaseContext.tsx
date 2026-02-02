'use client'

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../_lib/supabase'
import type { Session } from '../_types'

interface SupabaseContextValue {
  session: Session | null
  userId: string | null
  userEmail: string | null
  initialized: boolean
  setSession: (session: Session | null) => void
}

const SupabaseContext = createContext<SupabaseContextValue | undefined>(undefined)

interface SupabaseProviderProps {
  children: React.ReactNode
}

export function SupabaseProvider({ children }: SupabaseProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, supaSession) => {
      if (event === 'SIGNED_OUT' || !supaSession) {
        setSession(null)
        setInitialized(true)
        return
      }

      setSession({
        access_token: supaSession.access_token,
        refresh_token: supaSession.refresh_token,
        user: { id: supaSession.user.id, email: supaSession.user.email || '' }
      })
      setInitialized(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = useMemo(
    () => ({
      session,
      userId: session?.user?.id ?? null,
      userEmail: session?.user?.email ?? null,
      initialized,
      setSession
    }),
    [session, initialized]
  )

  return (
    <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>
  )
}

export function useSupabaseContext(): SupabaseContextValue {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabaseContext must be used within a SupabaseProvider')
  }
  return context
}

export function useSession(): Session | null {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSession must be used within a SupabaseProvider')
  }
  return context.session
}

export function useUserId(): string | null {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useUserId must be used within a SupabaseProvider')
  }
  return context.userId
}

export function useUserEmail(): string | null {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useUserEmail must be used within a SupabaseProvider')
  }
  return context.userEmail
}

export function useSupabaseInitialized(): boolean {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabaseInitialized must be used within a SupabaseProvider')
  }
  return context.initialized
}
