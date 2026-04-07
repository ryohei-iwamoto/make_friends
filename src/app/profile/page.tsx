'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { WORK_LOCATIONS } from '@/lib/locations'

type Department = { id: number; name: string }

type User = {
  id: string
  name: string
  bio: string | null
  photo_url: string | null
  group_id: number | null
  departments: { id: number; name: string } | null
  department_id: number
  work_location: string | null
  hobby_indoor_outdoor: string | null
  hobby_solo_group: string | null
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    Promise.all([
      fetch('/api/me').then(r => r.json()),
      fetch('/api/departments').then(r => r.json()),
    ]).then(([meData, deptData]) => {
      if (!meData.user) { router.replace('/'); return }
      setUser(meData.user)
      setPreview(meData.user.photo_url)
      setDepartments(deptData.departments ?? [])
    })
  }, [router])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/profile', { method: 'PUT', body: fd })
    const data = await res.json()

    if (!res.ok) { setError(data.error); setSaving(false); return }
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">読み込み中...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 bg-white border-b px-4 py-4 flex items-center gap-3">
        <Link href="/mypage" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-lg font-bold text-gray-800">プロフィール編集</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-5 max-w-lg mx-auto">
        {/* 写真プレビュー */}
        <div className="flex flex-col items-center">
          {preview ? (
            <Image
              src={preview}
              alt="プロフィール写真"
              width={96}
              height={96}
              className="w-24 h-24 rounded-full object-cover mb-3"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-4xl text-gray-400 mb-3">
              {user.name.charAt(0)}
            </div>
          )}
          <label className="cursor-pointer text-blue-600 text-sm font-medium">
            写真を変更
            <input
              name="photo"
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) setPreview(URL.createObjectURL(file))
              }}
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">お名前</label>
          <input
            name="name"
            defaultValue={user.name}
            required
            className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            勤務地 <span className="text-red-500">*</span>
          </label>
          <select
            name="work_location"
            required
            defaultValue={user.work_location ?? ''}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
          >
            <option value="" disabled>選択してください</option>
            {WORK_LOCATIONS.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-600">
            趣味の傾向 <span className="text-red-500">*</span>
          </p>
          <div>
            <p className="text-xs text-gray-500 mb-2">どちらに近いですか？</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'indoor', label: '🏠 インドア派' },
                { value: 'outdoor', label: '🌿 アウトドア派' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="hobby_indoor_outdoor"
                    value={opt.value}
                    required
                    defaultChecked={user.hobby_indoor_outdoor === opt.value}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2">どちらの趣味が多いですか？</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'solo', label: '🙋 一人でできる' },
                { value: 'group', label: '👥 みんなでやる' },
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="hobby_solo_group"
                    value={opt.value}
                    required
                    defaultChecked={user.hobby_solo_group === opt.value}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">自己紹介</label>
          <textarea
            name="bio"
            defaultValue={user.bio ?? ''}
            rows={5}
            placeholder={"例）趣味はキャンプで、週末は山に行くことが多いです。今日は普段関わりのない部署の方とたくさん話したいです！"}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">趣味・仕事のこと・今日の意気込みなど自由に書いてください</p>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? '保存中...' : saved ? '保存しました ✓' : '保存する'}
        </button>

        <button
          type="button"
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            router.replace('/')
          }}
          className="w-full text-gray-400 text-sm py-2 hover:text-gray-600"
        >
          ログアウト
        </button>
      </form>
    </div>
  )
}
