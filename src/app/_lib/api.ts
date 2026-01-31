export type ApiError = {
  status: number
  message: string
  data?: unknown
}

type ApiRequestOptions = {
  method?: string
  headers?: HeadersInit
  body?: unknown
  signal?: AbortSignal
  onUnauthorized?: () => void
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const maybeError = (data as { error?: string; message?: string }).error
    const maybeMessage = (data as { error?: string; message?: string }).message
    return maybeError || maybeMessage || fallback
  }
  return fallback
}

export async function apiRequest<T>(url: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', headers, body, signal, onUnauthorized } = options
  const hasBody = body !== undefined

  const response = await fetch(url, {
    method,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {})
    },
    body: hasBody ? JSON.stringify(body) : undefined,
    signal
  })

  if (response.status === 401 && onUnauthorized) {
    onUnauthorized()
  }

  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const data = isJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    const message = getErrorMessage(data, response.statusText || 'Request failed')
    const error = new Error(message) as Error & ApiError
    error.status = response.status
    error.message = message
    error.data = data
    throw error
  }

  return data as T
}
