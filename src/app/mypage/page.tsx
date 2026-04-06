'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getTextColor } from '@/lib/colors'

type User = {
  id: string
  name: string
  employee_id: string
  group_id: number | null
  departments: { name: string } | null
  groups: { id: number; group_number: number; color: string } | null
}

export default function MyPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(({ user }) => {
      if (!user) { router.replace('/'); return }
      setUser(user)
      setLoading(false)
    })
  }, [router])

  // グループ確定後はポーリングで更新
  useEffect(() => {
    if (!user || user.group_id) return
    const interval = setInterval(async () => {
      const { user: updated } = await fetch('/api/me').then(r => r.json())
      if (updated?.group_id) {
        setUser(updated)
        clearInterval(interval)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [user])

  async function handleCancel() {
    if (!confirm('登録をキャンセルしますか？')) return
    setCancelling(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  if (!user) return null

  // グループ確定後：全画面カラー表示
  if (user.groups) {
    const bg = user.groups.color
    const textColor = getTextColor(bg)
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{ backgroundColor: bg, color: textColor }}
      >
        {/* グループ番号メイン表示 */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <p className="text-xl font-medium opacity-80 mb-2">あなたのグループ</p>
          <div className="text-[8rem] font-black leading-none" style={{ color: textColor }}>
            {user.groups.group_number}
          </div>
          <p className="text-2xl font-semibold mt-4 opacity-90">{user.name}</p>
          <p className="text-base opacity-70 mt-1">{user.departments?.name}</p>
        </div>

        {/* 下部メニュー */}
        <nav
          className="grid grid-cols-3 border-t"
          style={{ borderColor: `${textColor}30`, backgroundColor: `${bg}cc` }}
        >
          <Link
            href="/team"
            className="flex flex-col items-center py-4 gap-1 text-sm font-medium opacity-80 hover:opacity-100 active:opacity-60"
            style={{ color: textColor }}
          >
            <span className="text-2xl">👥</span>
            <span>チーム</span>
          </Link>
          <Link
            href="/photo"
            className="flex flex-col items-center py-4 gap-1 text-sm font-medium opacity-80 hover:opacity-100 active:opacity-60"
            style={{ color: textColor }}
          >
            <span className="text-2xl">📷</span>
            <span>写真</span>
          </Link>
          <Link
            href="/profile"
            className="flex flex-col items-center py-4 gap-1 text-sm font-medium opacity-80 hover:opacity-100 active:opacity-60"
            style={{ color: textColor }}
          >
            <span className="text-2xl">✏️</span>
            <span>プロフィール</span>
          </Link>
        </nav>
      </div>
    )
  }

  // グループ未確定：待機画面
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">登録完了！</h2>
        <p className="text-gray-500 mb-2">
          <span className="font-semibold text-gray-700">{user.name}</span> さん
        </p>
        <p className="text-gray-500 text-sm mb-6">{user.departments?.name}</p>
        <div className="bg-blue-50 rounded-xl p-4 mb-6">
          <p className="text-blue-700 text-sm">グループ分け待ち中...</p>
          <p className="text-blue-500 text-xs mt-1">運営がグループを作成するまでお待ちください</p>
        </div>

        <Link
          href="/profile"
          className="block w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition mb-3"
        >
          プロフィール編集
        </Link>
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="w-full text-red-400 py-2 text-sm hover:text-red-600 disabled:opacity-50 transition"
        >
          登録キャンセル
        </button>
      </div>
    </div>
  )
}
