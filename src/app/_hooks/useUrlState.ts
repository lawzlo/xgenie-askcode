'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type UpdateMode = 'replace' | 'push'

export type ModalState =
  | 'auth:login'
  | 'auth:signup'
  | 'forgot'
  | 'reset'
  | 'team'
  | 'providers'
  | 'add-project'
  | 'edit-project'
  | 'saved'

export function useUrlState() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Use window.location.search inside callback to avoid infinite loop
  // (searchParams changes reference on every navigation)
  const updateParam = useCallback(
    (key: string, value: string | null, mode: UpdateMode = 'replace') => {
      const current = new URLSearchParams(window.location.search)
      const currentStr = current.toString()
      if (!value) {
        current.delete(key)
      } else {
        current.set(key, value)
      }
      const next = current.toString()
      if (next === currentStr) return
      const nextUrl = `${pathname}${next ? `?${next}` : ''}`
      if (mode === 'push') {
        router.push(nextUrl)
      } else {
        router.replace(nextUrl)
      }
    },
    [pathname, router]
  )

  return {
    projectId: searchParams.get('project'),
    teamId: searchParams.get('team'),
    modal: searchParams.get('modal') as ModalState | null,
    editProjectId: searchParams.get('edit'),
    setProjectId: (value: string | null, mode?: UpdateMode) => updateParam('project', value, mode),
    setTeamId: (value: string | null, mode?: UpdateMode) => updateParam('team', value, mode),
    setModal: (value: ModalState | null, mode?: UpdateMode) => updateParam('modal', value, mode),
    setEditProjectId: (value: string | null, mode?: UpdateMode) => updateParam('edit', value, mode)
  }
}
