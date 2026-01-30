'use client'

import { useCallback, useRef, useState } from 'react'

export function useConfirm() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmMessage, setConfirmMessage] = useState('')
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null)

  const showConfirm = useCallback((message: string): Promise<boolean> => {
    setConfirmMessage(message)
    setConfirmOpen(true)
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve
    })
  }, [])

  const closeConfirm = useCallback((result: boolean) => {
    setConfirmOpen(false)
    const resolver = confirmResolverRef.current
    confirmResolverRef.current = null
    if (resolver) resolver(result)
  }, [])

  return { confirmOpen, confirmMessage, showConfirm, closeConfirm }
}
