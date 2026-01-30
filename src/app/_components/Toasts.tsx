'use client'

import type { Toast } from '../_types'

type ToastsProps = {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

export function Toasts({ toasts, onDismiss }: ToastsProps) {
  return (
    <>
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <span className="toast-close" onClick={() => onDismiss(toast.id)}>
            ×
          </span>
          {toast.message}
        </div>
      ))}
    </>
  )
}
