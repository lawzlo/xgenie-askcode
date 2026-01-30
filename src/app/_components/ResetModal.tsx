'use client'

import type { FormEvent, RefObject } from 'react'

type ResetModalProps = {
  open: boolean
  title: string
  password: string
  confirm: string
  error: string
  success: string
  loading: boolean
  passwordRef: RefObject<HTMLInputElement | null>
  onPasswordChange: (value: string) => void
  onConfirmChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
}

export function ResetModal({
  open,
  title,
  password,
  confirm,
  error,
  success,
  loading,
  passwordRef,
  onPasswordChange,
  onConfirmChange,
  onSubmit,
  onClose
}: ResetModalProps) {
  if (!open) return null
  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-content auth-modal">
        <div className="modal-title">{title}</div>
        <form onSubmit={onSubmit}>
          <div className="form-row">
            <span className="form-label">new password:</span>
            <input
              ref={passwordRef}
              type="password"
              className="form-input"
              required
              minLength={6}
              placeholder="min 6 characters"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </div>
          <div className="form-row">
            <span className="form-label">confirm:</span>
            <input
              type="password"
              className="form-input"
              required
              minLength={6}
              placeholder="confirm password"
              value={confirm}
              onChange={(event) => onConfirmChange(event.target.value)}
            />
          </div>
          {error ? <div className="auth-error">{error}</div> : null}
          {success ? <div className="auth-success">{success}</div> : null}
          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'updating...' : 'update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
