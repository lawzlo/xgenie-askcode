import { NextResponse } from 'next/server'
import { getGitProviderById, updateGitHubAppInstallation } from '../../../../../services/git-provider'
import { optionsResponse, withCors } from '../../../../../server/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const baseUrl = `${url.protocol}//${url.host}`

  try {
    const installationId = url.searchParams.get('installation_id')
    const state = url.searchParams.get('state')
    const setupAction = url.searchParams.get('setup_action')

    if (installationId && state) {
      const providerId = state
      const provider = await getGitProviderById(providerId)

      if (!provider) {
        return withCors(NextResponse.redirect(`${baseUrl}/?error=provider_not_found`))
      }

      let accountName: string | undefined
      try {
        const { Octokit } = await import('octokit')
        const { createAppAuth } = await import('@octokit/auth-app')

        if (provider.github_app_id && provider.github_private_key) {
          const octokit = new Octokit({
            authStrategy: createAppAuth,
            auth: {
              appId: provider.github_app_id,
              privateKey: provider.github_private_key,
              installationId
            }
          })

          const { data: installation } = await octokit.rest.apps.getInstallation({
            installation_id: parseInt(installationId, 10)
          })
          const account = installation.account as { login?: string; slug?: string; name?: string } | null
          accountName = account?.login || account?.slug || account?.name || undefined
        }
      } catch (err) {
        console.warn('Could not get installation account name:', err)
      }

      await updateGitHubAppInstallation(providerId, installationId, accountName)
      return withCors(NextResponse.redirect(`${baseUrl}/?provider_connected=github`))
    }

    if (setupAction === 'install') {
      return withCors(NextResponse.redirect(`${baseUrl}/?github_app_installed=true`))
    }

    return withCors(NextResponse.redirect(`${baseUrl}/?error=missing_installation_id`))
  } catch (error) {
    console.error('GitHub callback error:', error)
    return withCors(NextResponse.redirect(`${baseUrl}/?error=callback_failed`))
  }
}

export function OPTIONS() {
  return optionsResponse()
}
