import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Make Friends',
  description: 'グループ交流イベント',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  )
}
