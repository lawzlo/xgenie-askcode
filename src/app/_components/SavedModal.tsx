'use client'

import { marked } from 'marked'

type SavedConversation = {
  id: string
  savedAt: string
  conversationId: string
  question: string
  answer: string
  createdAt: string
  projectName: string
}

type SavedModalProps = {
  open: boolean
  loading: boolean
  saved: SavedConversation[]
  viewingId: string | null
  onView: (id: string | null) => void
  onUnsave: (id: string) => void
  onClose: () => void
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString()
}

export function SavedModal({
  open,
  loading,
  saved,
  viewingId,
  onView,
  onUnsave,
  onClose
}: SavedModalProps) {
  if (!open) return null

  const viewing = viewingId ? saved.find((s) => s.id === viewingId) : null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: viewing ? 700 : 500 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-title">
          {viewing ? (
            <>
              <button type="button" className="link-button" onClick={() => onView(null)}>
                &larr; back
              </button>
              {' | '}
              {viewing.projectName}
            </>
          ) : (
            'Saved Q&A'
          )}
        </div>

        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : viewing ? (
          <div className="saved-detail">
            <div className="chat-message chat-question">
              <div className="chat-role">
                <strong>Question</strong>
                <span>{formatDate(viewing.createdAt)}</span>
              </div>
              <div className="chat-content">{viewing.question}</div>
            </div>

            <div className="chat-message">
              <div className="chat-role">
                <strong>AI</strong>
              </div>
              <div
                className="chat-content"
                dangerouslySetInnerHTML={{ __html: marked.parse(viewing.answer) }}
              />
            </div>

            <div className="saved-detail-footer">
              saved {formatDate(viewing.savedAt)}
              {' | '}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  onUnsave(viewing.id)
                  onView(null)
                }}
              >
                unsave
              </button>
            </div>
          </div>
        ) : saved.length === 0 ? (
          <div className="empty-state">No saved Q&A yet.</div>
        ) : (
          <div className="saved-list">
            {saved.map((item, index) => (
              <div key={item.id} className="saved-item">
                <div className="saved-item-main">
                  <span className="project-num">{index + 1}.</span>
                  <button type="button" className="link-button" onClick={() => onView(item.id)}>
                    <strong>{item.projectName}</strong>: {item.question.slice(0, 60)}
                    {item.question.length > 60 ? '...' : ''}
                  </button>
                </div>
                <div className="saved-item-meta">
                  saved {formatDate(item.savedAt)}
                  {' | '}
                  <button type="button" className="link-button" onClick={() => onView(item.id)}>
                    view
                  </button>
                  {' | '}
                  <button type="button" className="link-button" onClick={() => onUnsave(item.id)}>
                    unsave
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 15, textAlign: 'right' }}>
          <button type="button" className="link-button" onClick={onClose}>
            close
          </button>
        </div>
      </div>
    </div>
  )
}
