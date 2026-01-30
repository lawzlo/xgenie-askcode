import { DEFAULT_GITEA_URL, getGitProviderById, updateGitProviderTokens } from '../../../../../services/git-provider'
import { optionsResponse, withCors } from '../../../../../server/api'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (!code || !state) {
      return withCors(NextResponse.redirect(`${baseUrl}/?error=missing_code_or_state`))
    }

    const providerId = state
    const provider = await getGitProviderById(providerId)

    if (!provider || !provider.client_id || !provider.client_secret || !provider.redirect_uri) {
      console.error('Provider missing required fields:', {
        hasProvider: !!provider,
        hasClientId: !!provider?.client_id,
        hasClientSecret: !!provider?.client_secret,
        hasRedirectUri: !!provider?.redirect_uri
      })
      return withCors(NextResponse.redirect(`${baseUrl}/?error=provider_not_found`))
    }

    const giteaApiUrl = (provider.api_url || DEFAULT_GITEA_URL).replace(/\/+$/, '')
    const tokenUrl = `${giteaApiUrl}/login/oauth/access_token`

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: new URLSearchParams({
        client_id: provider.client_id,
        client_secret: provider.client_secret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: provider.redirect_uri
      })
    })

    const contentType = tokenResponse.headers.get('content-type') || ''
    const responseText = await tokenResponse.text()

    if (!tokenResponse.ok) {
      console.error('Token exchange failed - Status:', tokenResponse.status)
      console.error('Content-Type:', contentType)
      console.error('Response body:', responseText.substring(0, 500))
      return withCors(NextResponse.redirect(`${baseUrl}/?error=token_exchange_failed`))
    }

    let tokenData: { access_token?: string; refresh_token?: string; expires_in?: number }
    try {
      tokenData = JSON.parse(responseText)
    } catch {
      console.error('Failed to parse token response as JSON:', responseText.substring(0, 500))
      return withCors(NextResponse.redirect(`${baseUrl}/?error=token_exchange_failed`))
    }

    if (!tokenData.access_token) {
      console.error('Token exchange failed - no access_token:', tokenData)
      return withCors(NextResponse.redirect(`${baseUrl}/?error=token_exchange_failed`))
    }

    const userResponse = await fetch(`${giteaApiUrl}/api/v1/user`, {
      headers: {
        Authorization: `token ${tokenData.access_token}`,
        Accept: 'application/json'
      }
    })

    if (!userResponse.ok) {
      console.error('Failed to get user info - Status:', userResponse.status)
      console.error('This may be blocked by Cloudflare Access. Add /api/v1/* to bypass rules.')
      return withCors(NextResponse.redirect(`${baseUrl}/?error=user_info_failed`))
    }

    const userContentType = userResponse.headers.get('content-type') || ''
    if (!userContentType.includes('application/json')) {
      console.error('User info response is not JSON - likely blocked by Cloudflare Access')
      return withCors(NextResponse.redirect(`${baseUrl}/?error=user_info_failed`))
    }

    const userData = (await userResponse.json()) as { id?: number; login?: string; username?: string }

    await updateGitProviderTokens(providerId, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      account_id: userData.id?.toString(),
      account_name: userData.login || userData.username
    })

    return withCors(NextResponse.redirect(`${baseUrl}/?provider_connected=gitea`))
  } catch (error) {
    console.error('Gitea callback error:', error)
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`
    return withCors(NextResponse.redirect(`${baseUrl}/?error=callback_failed`))
  }
}

export function OPTIONS() {
  return optionsResponse()
}
