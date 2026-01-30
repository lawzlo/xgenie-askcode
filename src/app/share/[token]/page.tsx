import type { Metadata } from 'next'
import Link from 'next/link'
import { ShareContent } from './ShareContent'

type PageParams = {
  params: Promise<{ token: string }>
}

async function getShareData(token: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/share/${token}`, {
      cache: 'no-store'
    })

    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { token } = await params
  const data = await getShareData(token)

  if (!data) {
    return {
      title: 'Shared Q&A - AskCode',
      description: 'This share link may have expired or been removed.'
    }
  }

  const questionPreview = data.question.length > 100
    ? data.question.slice(0, 100) + '...'
    : data.question

  return {
    title: `${questionPreview} - AskCode`,
    description: `Q: ${data.question.slice(0, 150)}... - Shared from AskCode`,
    openGraph: {
      title: `Q: ${questionPreview}`,
      description: `AI-powered answer about ${data.projectName}. Shared from AskCode.`,
      type: 'article',
      siteName: 'AskCode'
    },
    twitter: {
      card: 'summary',
      title: `Q: ${questionPreview}`,
      description: `AI-powered answer about ${data.projectName}. Shared from AskCode.`
    }
  }
}

export default async function SharePage({ params }: PageParams) {
  const { token } = await params

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="logo">
            A
          </Link>
          <nav className="nav-links">
            <span>AskCode</span>
          </nav>
        </div>
      </header>

      <ShareContent token={token} />
    </>
  )
}
