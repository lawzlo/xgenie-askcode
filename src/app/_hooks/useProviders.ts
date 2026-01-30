'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GitProvider, Session, ToastType } from '../_types'

type UseProvidersParams = {
  session: Session | null
  currentTeamId: string | null
  getAuthHeaders: () => Record<string, string>
  clearSession: () => void
  showToast: (message: string, type?: ToastType, duration?: number) => void
  showConfirm: (message: string) => Promise<boolean>
}

export function useProviders({
  session,
  currentTeamId,
  getAuthHeaders,
  clearSession,
  showToast,
  showConfirm
}: UseProvidersParams) {
  const [providersModalOpen, setProvidersModalOpen] = useState(false)
  const [providers, setProviders] = useState<GitProvider[]>([])
  const [providersLoading, setProvidersLoading] = useState(false)
  const [showGithubForm, setShowGithubForm] = useState(false)
  const [showGiteaForm, setShowGiteaForm] = useState(false)
  const [githubName, setGithubName] = useState('')
  const [githubAppId, setGithubAppId] = useState('')
  const [githubAppName, setGithubAppName] = useState('')
  const [githubPrivateKey, setGithubPrivateKey] = useState('')
  const [giteaName, setGiteaName] = useState('')
  const [giteaUrl, setGiteaUrl] = useState('')
  const [giteaClientId, setGiteaClientId] = useState('')
  const [giteaClientSecret, setGiteaClientSecret] = useState('')

  const isProviderConnected = useCallback((provider: GitProvider) => {
    switch (provider.provider) {
      case 'github':
        return !!provider.github_installation_id
      case 'gitea':
      case 'gitlab':
      case 'bitbucket':
        return !!provider.access_token
      default:
        return false
    }
  }, [])

  const connectedProviders = useMemo(
    () => providers.filter(isProviderConnected),
    [providers, isProviderConnected]
  )

  const loadProviders = useCallback(async () => {
    if (!session || !currentTeamId) {
      setProviders([])
      return
    }
    setProvidersLoading(true)
    try {
      const response = await fetch('/api/git-providers', { headers: getAuthHeaders() })
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok) {
        throw new Error('Failed to load providers')
      }
      const data = (await response.json()) as GitProvider[]
      setProviders(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load providers'
      showToast(message, 'error')
    } finally {
      setProvidersLoading(false)
    }
  }, [clearSession, currentTeamId, getAuthHeaders, session, showToast])

  async function openProvidersModal() {
    setProvidersModalOpen(true)
    setShowGithubForm(false)
    setShowGiteaForm(false)
    await loadProviders()
  }

  const closeProvidersModal = useCallback(() => {
    setProvidersModalOpen(false)
    setShowGithubForm(false)
    setShowGiteaForm(false)
  }, [])

  async function handleConnectGitea() {
    if (!giteaUrl || !giteaClientId || !giteaClientSecret) {
      showToast('Please fill in all fields', 'error')
      return
    }
    try {
      const response = await fetch('/api/git-providers/gitea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: giteaName || 'Gitea',
          api_url: giteaUrl,
          client_id: giteaClientId,
          client_secret: giteaClientSecret
        })
      })
      const data = (await response.json()) as { oauth_url?: string; error?: string }
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect Gitea')
      }

      if (data.oauth_url) {
        window.open(data.oauth_url, '_blank')
      }
      setShowGiteaForm(false)
      showToast('Please complete authorization in the new window, then refresh this page.', 'info', 0)
      await loadProviders()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect Gitea'
      showToast(message, 'error')
    }
  }

  async function handleConnectGithub() {
    if (!githubAppId || !githubAppName || !githubPrivateKey) {
      showToast('Please fill in App ID, App Name, and Private Key', 'error')
      return
    }
    try {
      const response = await fetch('/api/git-providers/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: githubName || 'GitHub',
          github_app_id: Number.parseInt(githubAppId, 10),
          github_app_name: githubAppName,
          github_private_key: githubPrivateKey
        })
      })
      const data = (await response.json()) as { install_url?: string; error?: string }
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect GitHub')
      }
      if (data.install_url) {
        window.open(data.install_url, '_blank')
      }
      setShowGithubForm(false)
      setGithubName('')
      setGithubAppId('')
      setGithubAppName('')
      setGithubPrivateKey('')
      showToast('Please install the GitHub App to your account, then refresh this page.', 'info', 0)
      await loadProviders()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect GitHub'
      showToast(message, 'error')
    }
  }

  async function handleDeleteProvider(providerId: string) {
    const confirmed = await showConfirm('Remove this provider?')
    if (!confirmed) return
    try {
      const response = await fetch(`/api/git-providers/${providerId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok) {
        throw new Error('Failed to delete provider')
      }
      await loadProviders()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete provider'
      showToast(message, 'error')
    }
  }

  useEffect(() => {
    setProviders([])
    setProvidersModalOpen(false)
    setShowGithubForm(false)
    setShowGiteaForm(false)
  }, [currentTeamId])

  return {
    providersModalOpen,
    providers,
    providersLoading,
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
    connectedProviders,
    loadProviders,
    openProvidersModal,
    closeProvidersModal,
    handleConnectGitea,
    handleConnectGithub,
    handleDeleteProvider,
    setShowGithubForm,
    setShowGiteaForm,
    setGithubName,
    setGithubAppId,
    setGithubAppName,
    setGithubPrivateKey,
    setGiteaName,
    setGiteaUrl,
    setGiteaClientId,
    setGiteaClientSecret
  }
}
