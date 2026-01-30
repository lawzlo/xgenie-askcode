'use client'

type ConfirmDialogProps = {
  open: boolean
  message: string
  onCancel: () => void
  onOk: () => void
}

export function ConfirmDialog({ open, message, onCancel, onOk }: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="confirm-overlay">
      <div className="confirm-dialog">
        <div className="confirm-message">{message}</div>
        <div className="confirm-actions">
          <button className="confirm-btn" onClick={onCancel}>
            cancel
          </button>
          <button className="confirm-btn primary" onClick={onOk}>
            ok
          </button>
        </div>
      </div>
    </div>
  )
}
