'use client'

import type { FormEvent, RefObject } from 'react'

type ForgotModalProps = {
  open: boolean
  email: string
  error: string
  success: string
  loading: boolean
  emailRef: RefObject<HTMLInputElement | null>
  onEmailChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
  onBackToLogin: () => void
}

export function ForgotModal({
  open,
  email,
  error,
  success,
  loading,
  emailRef,
  onEmailChange,
  onSubmit,
  onClose,
  onBackToLogin
}: ForgotModalProps) {
  if (!open) return null
  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-content auth-modal">
        <div className="modal-title">Reset Password</div>
        <form onSubmit={onSubmit}>
          <div className="form-row">
            <span className="form-label">email:</span>
            <input
              ref={emailRef}
              type="email"
              className="form-input"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </div>
          {error ? <div className="auth-error">{error}</div> : null}
          {success ? <div className="auth-success">{success}</div> : null}
          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'sending...' : 'send reset link'}
            </button>
            <span className="cancel-link" onClick={onClose}>
              cancel
            </span>
          </div>
          <div className="auth-switch">
            <button type="button" className="link-button" onClick={onBackToLogin}>
              Back to login
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
