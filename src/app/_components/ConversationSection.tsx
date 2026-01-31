'use client'

import type { RefObject } from 'react'
import { useState } from 'react'
import { marked } from 'marked'
import type { Message } from '../_types'
import { timeAgo } from '../_lib/utils'

type ConversationSectionProps = {
  selectedProjectId: string | null
  selectedProjectName: string
  chatContainerRef: RefObject<HTMLDivElement | null>
  historyLoading: boolean
  chatMessages: Message[]
  chatLoading: boolean
  chatStatusText: string
  questionInput: string
  onQuestionInputChange: (value: string) => void
  questionInputRef: RefObject<HTMLTextAreaElement | null>
  onAskQuestion: () => void
  onCancelAsk: () => void
  onClearHistory: () => void
  getAuthHeaders: () => Record<string, string>
  questionSuggestions: string[]
  suggestionsLoading: boolean
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void
}

export function ConversationSection({
  selectedProjectId,
  selectedProjectName,
  chatContainerRef,
  historyLoading,
  chatMessages,
  chatLoading,
  chatStatusText,
  questionInput,
  onQuestionInputChange,
  questionInputRef,
  onAskQuestion,
  onCancelAsk,
  onClearHistory,
  getAuthHeaders,
  questionSuggestions,
  suggestionsLoading,
  showToast
}: ConversationSectionProps) {
  const [sharingId, setSharingId] = useState<string | null>(null)

  async function handleShare(conversationId: string) {
    setSharingId(conversationId)

    try {
      const response = await fetch(`/api/conversations/${conversationId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ expiresHours: 24 })
      })

      if (!response.ok) {
        const data = await response.json()
        showToast(data.error || 'Failed to create share link', 'error')
        return
      }

      const data = await response.json()
      await navigator.clipboard.writeText(data.shareUrl)
      showToast('Link copied to clipboard!', 'success')
    } catch {
      showToast('Failed to create share link', 'error')
    } finally {
      setSharingId(null)
    }
  }

  if (!selectedProjectId) return null

  return (
    <div className="conversation-section">
      <div className="conversation-header">
        <span className="conversation-title">
          <strong>{selectedProjectName}</strong>
        </span>
        <span className="conversation-actions">
          <button type="button" className="link-button" onClick={onClearHistory}>
            clear history
          </button>
        </span>
      </div>

      <div ref={chatContainerRef} className="chat-container">
        {historyLoading ? (
          <div className="empty-state">Loading conversation...</div>
        ) : chatMessages.length === 0 ? (
          <div className="empty-state">No conversation yet. Ask your first question below.</div>
        ) : (
          chatMessages.map((message, index) => (
            <div key={message.id || `${message.timestamp}-${index}`}>
              <div className="chat-message chat-question">
                <div className="chat-role">
                  <strong>You</strong> <span>{timeAgo(message.timestamp)}</span>
                </div>
                <div className="chat-content">{message.question}</div>
              </div>
              {message.answer ? (
                <div className="chat-message">
                  <div className="chat-role">
                    <strong>AI</strong>
                    <span>{message.filesRead.length} files read</span>
                  </div>
                  <div
                    className="chat-content"
                    dangerouslySetInnerHTML={{ __html: marked.parse(message.answer) }}
                  />
                  {message.id && (
                    <div className="chat-actions">
                      <button
                        type="button"
                        className="share-btn"
                        onClick={() => handleShare(message.id!)}
                        disabled={sharingId === message.id}
                      >
                        {sharingId === message.id ? 'copying...' : 'share'}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      {chatLoading ? (
        <div className="loading">
          <span className="loading-spinner">?</span> {chatStatusText || 'AI is exploring the codebase...'}
          <button
            type="button"
            className="link-button"
            style={{ marginLeft: 10 }}
            onClick={onCancelAsk}
          >
            cancel
          </button>
        </div>
      ) : null}

      {questionSuggestions.length > 0 && (
        <div className="question-templates">
          {questionSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="template-btn"
              onClick={() => onQuestionInputChange(suggestion)}
              disabled={chatLoading}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      {suggestionsLoading && (
        <div className="question-templates">
          <span className="suggestions-loading">Loading suggestions...</span>
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          onAskQuestion()
        }}
        className="question-form"
      >
        <textarea
          ref={questionInputRef}
          className="question-input"
          required
          placeholder="Ask a question... (Shift+Enter to submit)"
          value={questionInput}
          onChange={(event) => onQuestionInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && event.shiftKey) {
              event.preventDefault()
              onAskQuestion()
            }
          }}
        />
        <div className="question-hint">
          <button type="submit" className="submit-btn" disabled={chatLoading || !questionInput.trim()}>
            {chatLoading ? 'asking...' : 'ask'}
          </button>
        </div>
      </form>
    </div>
  )
}
