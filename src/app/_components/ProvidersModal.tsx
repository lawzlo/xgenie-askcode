'use client'

import { useState } from 'react'
import type { GitProvider } from '../_types'

type ProvidersModalProps = {
  open: boolean
  providersLoading: boolean
  providers: GitProvider[]
  showGithubForm: boolean
  showGiteaForm: boolean
  githubName: string
  githubAppId: string
  githubAppName: string
  githubPrivateKey: string
  giteaName: string
  giteaUrl: string
  giteaClientId: string
  giteaClientSecret: string
  isProviderConnected: (provider: GitProvider) => boolean
  onShowGithubForm: () => void
  onShowGiteaForm: () => void
  onCancelGithubForm: () => void
  onCancelGiteaForm: () => void
  onGithubNameChange: (value: string) => void
  onGithubAppIdChange: (value: string) => void
  onGithubAppNameChange: (value: string) => void
  onGithubPrivateKeyChange: (value: string) => void
  onGiteaNameChange: (value: string) => void
  onGiteaUrlChange: (value: string) => void
  onGiteaClientIdChange: (value: string) => void
  onGiteaClientSecretChange: (value: string) => void
  onConnectGithub: () => void
  onConnectGitea: () => void
  onDeleteProvider: (providerId: string) => void
  onClose: () => void
}

export function ProvidersModal({
  open,
  providersLoading,
  providers,
  showGithubForm,
  showGiteaForm,
  githubName,
  githubAppId,
  githubAppName,
  githubPrivateKey,
  giteaName,
  giteaUrl,
  giteaClientId,
  giteaClientSecret,
  isProviderConnected,
  onShowGithubForm,
  onShowGiteaForm,
  onCancelGithubForm,
  onCancelGiteaForm,
  onGithubNameChange,
  onGithubAppIdChange,
  onGithubAppNameChange,
  onGithubPrivateKeyChange,
  onGiteaNameChange,
  onGiteaUrlChange,
  onGiteaClientIdChange,
  onGiteaClientSecretChange,
  onConnectGithub,
  onConnectGitea,
  onDeleteProvider,
  onClose
}: ProvidersModalProps) {
  const [showGiteaSecret, setShowGiteaSecret] = useState(false)
  if (!open) return null
  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-content" style={{ maxWidth: 550 }}>
        <div className="modal-title">Git Providers</div>
        <p style={{ color: '#828282', fontSize: '9pt', marginBottom: 15 }}>
          Connect your Git provider to import repositories.
        </p>

        <div className="provider-buttons">
          <button className="provider-btn github" onClick={onShowGithubForm}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            GitHub App
          </button>
          <button className="provider-btn gitea" onClick={onShowGiteaForm}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4.209 4.603c-.247 0-.525.02-.84.088-.333.07-1.28.283-2.054 1.027C-.403 7.25.035 9.685.089 10.052c.065.446.263 1.687 1.21 2.768 1.749 2.141 5.513 2.092 5.513 2.092s.462 1.103 1.168 2.119c.955 1.263 1.936 2.248 2.89 2.367 2.406 0 7.212-.004 7.212-.004s.458.004 1.08-.394c.535-.324 1.013-.893 1.013-.893s.492-.527 1.18-1.73c.21-.37.385-.729.538-1.068 0 0 2.107-4.471 2.107-8.823-.042-1.318-.367-1.55-.443-1.627-.156-.156-.366-.153-.366-.153s-4.475.252-6.792.306c-.508.011-1.012.023-1.512.027v4.474l-.634-.301c0-1.39-.004-4.17-.004-4.17-1.107.016-3.405-.084-3.405-.084s-5.399-.27-5.987-.324c-.187-.011-.401-.032-.648-.032zm.354 1.832h.111s.271 2.269.6 3.597C5.549 11.147 6.22 13 6.22 13s-.996-.119-1.641-.348c-.99-.324-1.409-.714-1.409-.714s-.73-.511-1.096-1.52C1.444 8.73 2.021 7.7 2.021 7.7s.32-.859 1.47-1.145c.395-.106.863-.12 1.072-.12zm8.33 2.554c.26.003.509.127.509.127l.868.422-.529 1.075a.686.686 0 0 0-.614.359.685.685 0 0 0 .072.756l-.939 1.924a.69.69 0 0 0-.66.527.687.687 0 0 0 .347.763.686.686 0 0 0 .867-.206.688.688 0 0 0-.069-.882l.916-1.874a.667.667 0 0 0 .237-.02.657.657 0 0 0 .271-.137 8.826 8.826 0 0 1 1.016.512.761.761 0 0 1 .286.282c.073.21-.073.569-.073.569-.087.29-.702 1.55-.702 1.55a.692.692 0 0 0-.676.477.681.681 0 1 0 1.157-.252c.073-.141.141-.282.214-.431.19-.397.515-1.16.515-1.16.035-.066.218-.394.103-.814-.095-.435-.48-.638-.48-.638-.467-.301-1.116-.58-1.116-.58s0-.156-.042-.27a.688.688 0 0 0-.148-.241l.516-1.062 2.89 1.401s.48.218.583.619c.073.282-.019.534-.069.657-.24.587-2.1 4.317-2.1 4.317s-.232.554-.748.588a1.065 1.065 0 0 1-.393-.045l-.202-.08-4.31-2.1s-.417-.218-.49-.596c-.083-.31.104-.691.104-.691l2.073-4.272s.183-.37.466-.497a.855.855 0 0 1 .35-.077z"/></svg>
            Gitea
          </button>
        </div>

        {showGithubForm ? (
          <div style={{ marginTop: 15, padding: 10, background: '#f0f0e8' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 10 }}>Add GitHub App</div>
            <div className="form-row">
              <span className="form-label">name:</span>
              <input
                type="text"
                className="form-input"
                placeholder="My GitHub"
                style={{ width: 300 }}
                value={githubName}
                onChange={(event) => onGithubNameChange(event.target.value)}
              />
            </div>
            <div className="form-row">
              <span className="form-label">App ID:</span>
              <input
                type="number"
                className="form-input"
                placeholder="12345"
                style={{ width: 300 }}
                value={githubAppId}
                onChange={(event) => onGithubAppIdChange(event.target.value)}
              />
            </div>
            <div className="form-row">
              <span className="form-label">App Name:</span>
              <input
                type="text"
                className="form-input"
                placeholder="my-app-name"
                style={{ width: 300 }}
                value={githubAppName}
                onChange={(event) => onGithubAppNameChange(event.target.value)}
              />
            </div>
            <div className="form-row">
              <span className="form-label">Private Key:</span>
              <textarea
                className="form-input"
                placeholder="-----BEGIN RSA PRIVATE KEY-----"
                style={{ width: 300, height: 80, fontFamily: 'monospace', fontSize: '8pt' }}
                value={githubPrivateKey}
                onChange={(event) => onGithubPrivateKeyChange(event.target.value)}
              />
            </div>
            <div style={{ fontSize: '8pt', color: '#828282', margin: '10px 0' }}>
              1. Create GitHub App at: github.com/settings/apps/new
              <br />
              2. Set callback URL to: {`{your-domain}/api/git-providers/github/callback`}
              <br />
              3. Generate and download private key, paste it above
            </div>
            <div className="form-actions" style={{ marginLeft: 0 }}>
              <button type="button" className="submit-btn" onClick={onConnectGithub}>
                connect
              </button>
              <span className="cancel-link" onClick={onCancelGithubForm}>
                cancel
              </span>
            </div>
          </div>
        ) : null}

        {showGiteaForm ? (
          <div style={{ marginTop: 15, padding: 10, background: '#f0f0e8' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 10 }}>Add Gitea Provider</div>
            <div className="form-row">
              <span className="form-label">name:</span>
              <input
                type="text"
                className="form-input"
                placeholder="My Gitea"
                style={{ width: 300 }}
                value={giteaName}
                onChange={(event) => onGiteaNameChange(event.target.value)}
              />
            </div>
            <div className="form-row">
              <span className="form-label">URL:</span>
              <input
                type="text"
                className="form-input"
                placeholder="https://gitea.example.com"
                style={{ width: 300 }}
                value={giteaUrl}
                onChange={(event) => onGiteaUrlChange(event.target.value)}
              />
            </div>
            <div className="form-row">
              <span className="form-label">Client ID:</span>
              <input
                type="text"
                className="form-input"
                placeholder="from OAuth App"
                style={{ width: 300 }}
                value={giteaClientId}
                onChange={(event) => onGiteaClientIdChange(event.target.value)}
              />
            </div>
            <div className="form-row">
              <span className="form-label">Client Secret:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type={showGiteaSecret ? 'text' : 'password'}
                  className="form-input"
                  placeholder="from OAuth App"
                  style={{ width: 270 }}
                  value={giteaClientSecret}
                  onChange={(event) => onGiteaClientSecretChange(event.target.value)}
                />
                <span
                  className="link-button"
                  style={{ fontSize: '8pt', whiteSpace: 'nowrap' }}
                  onClick={() => setShowGiteaSecret(!showGiteaSecret)}
                >
                  {showGiteaSecret ? 'hide' : 'show'}
                </span>
              </div>
            </div>
            <div style={{ fontSize: '8pt', color: '#828282', margin: '10px 0' }}>
              Create OAuth App at: {`{your-gitea}/user/settings/applications`}
            </div>
            <div className="form-actions" style={{ marginLeft: 0 }}>
              <button type="button" className="submit-btn" onClick={onConnectGitea}>
                connect
              </button>
              <span className="cancel-link" onClick={onCancelGiteaForm}>
                cancel
              </span>
            </div>
          </div>
        ) : null}

        <div className="provider-list" style={{ marginTop: 15 }}>
          {providersLoading ? (
            <div style={{ color: '#828282', padding: '10px 0' }}>Loading providers...</div>
          ) : null}
          {!providersLoading && providers.length === 0 ? (
            <div style={{ color: '#828282', padding: '10px 0' }}>No providers connected yet.</div>
          ) : null}
          {!providersLoading
            ? providers.map((provider) => (
                <div key={provider.id} className="provider-item">
                  <div className="provider-info">
                    <span className="provider-name">
                      {provider.provider}
                      {provider.provider === 'github' ? ' App' : ''}
                    </span>
                    <span className="provider-account">{provider.account_name || provider.name}</span>
                  </div>
                  <div className="provider-actions">
                    {isProviderConnected(provider) ? (
                      <span style={{ color: '#609926' }}>connected</span>
                    ) : (
                      <span style={{ color: '#c00' }}>not connected</span>
                    )}
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => onDeleteProvider(provider.id)}
                    >
                      remove
                    </button>
                  </div>
                </div>
              ))
            : null}
        </div>

        <div style={{ marginTop: 20, textAlign: 'left' }}>
          <button className="submit-btn" onClick={onClose}>
            close
          </button>
        </div>
      </div>
    </div>
  )
}
