'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { renderMarkdown } from '../../_lib/markdown'

type SharedConversation = {
  question: string
  answer: string
  projectName: string
  createdAt: string
  expiresAt: string
  isExpired: boolean
  isLoggedIn: boolean
  isSaved: boolean
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

export function ShareContent({ token }: { token: string }) {
  const [data, setData] = useState<SharedConversation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)

  // Get auth token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('askcode_session')
    if (stored) {
      try {
        const session = JSON.parse(stored)
        setAuthToken(session.access_token || null)
      } catch {
        setAuthToken(null)
      }
    }
  }, [])

  useEffect(() => {
    async function fetchShare() {
      try {
        const headers: HeadersInit = {}
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`
        }

        const response = await fetch(`/api/share/${token}`, { headers })
        const result = await response.json()

        if (!response.ok) {
          setError(result.error || 'Failed to load shared content')
          return
        }

        setData(result)
      } catch {
        setError('Failed to load shared content')
      } finally {
        setLoading(false)
      }
    }

    fetchShare()
  }, [token, authToken])

  async function handleSave() {
    if (!authToken || !data) return

    setSaving(true)
    try {
      const response = await fetch('/api/saved-conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ shareToken: token })
      })

      if (response.ok) {
        setData({ ...data, isSaved: true })
      } else {
        const result = await response.json()
        if (result.error === 'Already saved') {
          setData({ ...data, isSaved: true })
        }
      }
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="main">
        <div className="share-container">
          <div className="empty-state">Loading...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="main">
        <div className="share-container">
          <div className="share-error">{error}</div>
          <p style={{ marginTop: 15, color: '#828282', fontSize: '9pt' }}>
            This share link may have expired or been removed.
          </p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="main">
      <div className="share-container">
        <div className="share-header">
          <span className="share-project">
            <strong>{data.projectName}</strong>
          </span>
          <span className="share-meta">Shared Q&amp;A</span>
        </div>

        <div className="chat-message chat-question">
          <div className="chat-role">
            <strong>Question</strong>
            <span>{formatDate(data.createdAt)}</span>
          </div>
          <div className="chat-content">{data.question}</div>
        </div>

        <div className="chat-message">
          <div className="chat-role">
            <strong>AI</strong>
          </div>
          <div
            className="chat-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(data.answer) }}
          />
        </div>

        <div className="share-footer">
          {data.isLoggedIn ? (
            <p>
              {data.isSaved ? (
                <span className="saved-status">saved</span>
              ) : (
                <button
                  className="link-button save-link"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'saving...' : 'save'}
                </button>
              )}
              {' | shared from '}
              <Link href="/" style={{ color: '#ff6600' }}>
                AskCode
              </Link>
            </p>
          ) : (
            <>
              <p className="share-expires">
                expires {formatDate(data.expiresAt)}
                {' | '}
                <Link href="/" style={{ color: '#ff6600' }}>
                  login
                </Link>
                {' to save permanently'}
              </p>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .share-container {
          max-width: 800px;
          margin: 0 auto;
        }
        .share-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid #ff6600;
        }
        .share-project strong {
          color: #ff6600;
        }
        .share-meta {
          font-size: 9pt;
          color: #828282;
        }
        .share-error {
          color: #c00;
          font-size: 12pt;
          padding: 20px 0;
        }
        .share-footer {
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid #e0e0d8;
          font-size: 9pt;
          color: #828282;
          text-align: center;
        }
        .share-expires {
          margin-top: 5px;
          font-size: 8pt;
        }
        .save-link {
          color: #ff6600;
          cursor: pointer;
        }
        .save-link:hover {
          text-decoration: underline;
        }
        .save-link:disabled {
          color: #828282;
          cursor: default;
        }
        .saved-status {
          color: #828282;
        }
      `}</style>
    </div>
  )
}
