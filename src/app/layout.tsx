import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'AskCode',
  description: 'Ask your code. Get real answers. AskCode lets anyone get accurate answers from source code, no technical skills required.',
  icons: {
    icon: '/favicon.svg'
  },
  openGraph: {
    title: 'AskCode',
    description: 'Ask your code. Get real answers. Get accurate answers from source code, no technical skills required.',
    url: 'https://askcode.xgenie.co',
    siteName: 'AskCode',
    type: 'website'
  },
  twitter: {
    card: 'summary',
    title: 'AskCode',
    description: 'Ask your code. Get real answers. Get accurate answers from source code, no technical skills required.'
  }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
