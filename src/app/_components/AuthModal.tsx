'use client'

import type { FormEvent, RefObject } from 'react'
import type { AuthMode } from '../_types'

type AuthModalProps = {
  open: boolean
  mode: AuthMode
  email: string
  password: string
  error: string
  loading: boolean
  emailRef: RefObject<HTMLInputElement | null>
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
  onSwitchToLogin: () => void
  onSwitchToSignup: () => void
  onOpenForgot: () => void
}

export function AuthModal({
  open,
  mode,
  email,
  password,
  error,
  loading,
  emailRef,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onClose,
  onSwitchToLogin,
  onSwitchToSignup,
  onOpenForgot
}: AuthModalProps) {
  if (!open) return null
  const title = mode === 'login' ? 'Login' : 'Sign Up'
  const buttonLabel = mode === 'login' ? 'login' : 'sign up'

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
          <div className="form-row">
            <span className="form-label">password:</span>
            <input
              type="password"
              className="form-input"
              required
              minLength={6}
              placeholder="min 6 characters"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </div>
          {error ? <div className="auth-error">{error}</div> : null}
          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? (mode === 'login' ? 'logging in...' : 'signing up...') : buttonLabel}
            </button>
            <span className="cancel-link" onClick={onClose}>
              cancel
            </span>
          </div>
          <div className="auth-switch">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button type="button" className="link-button" onClick={onSwitchToSignup}>
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" className="link-button" onClick={onSwitchToLogin}>
                  Login
                </button>
              </>
            )}
          </div>
          <div className="auth-switch">
            <button type="button" className="link-button" onClick={onOpenForgot}>
              Forgot password?
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
