export function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function truncateUrl(url: string): string {
  return url.replace('https://', '').replace('http://', '').replace('.git', '')
}

export function extractRepoName(url: string): string {
  const cleaned = url.replace(/\.git$/, '')
  const parts = cleaned.split('/')
  return parts[parts.length - 1] || cleaned
}

export function normalizeGitUrl(url: string): string {
  const trimmed = url.trim()
  try {
    const parsed = new URL(trimmed)
    const normalizedPath = parsed.pathname
      .replace(/\/+$/, '')
      .replace(/\.git$/i, '')
      .toLowerCase()
    return `${parsed.hostname.toLowerCase()}${normalizedPath}`
  } catch {
    return trimmed
      .replace(/\/+$/, '')
      .replace(/\.git$/i, '')
      .toLowerCase()
  }
}

export function timeAgo(dateStr: string | undefined | null): string {
  if (!dateStr) return 'not synced'
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (Number.isNaN(seconds)) return 'not synced'
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
