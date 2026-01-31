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

  const updateParam = useCallback(
    (key: string, value: string | null, mode: UpdateMode = 'replace') => {
      const current = searchParams.toString()
      const nextParams = new URLSearchParams(current)
      if (!value) {
        nextParams.delete(key)
      } else {
        nextParams.set(key, value)
      }
      const next = nextParams.toString()
      if (next === current) return
      const nextUrl = `${pathname}${next ? `?${next}` : ''}`
      if (mode === 'push') {
        router.push(nextUrl)
      } else {
        router.replace(nextUrl)
      }
    },
    [pathname, router, searchParams]
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
