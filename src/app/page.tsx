'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { WORK_LOCATIONS } from '@/lib/locations'

type Department = { id: number; name: string }

export default function HomePage() {
  const router = useRouter()
  const [mode, setMode] = useState<'select' | 'login' | 'register'>('select')
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showWorkLocation, setShowWorkLocation] = useState(false)
  const [showHobbyTendency, setShowHobbyTendency] = useState(false)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(({ user }) => {
      if (user) router.replace('/mypage')
    })
  }, [router])

  useEffect(() => {
    Promise.all([
      fetch('/api/departments').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([deptData, settingsData]) => {
      setDepartments(deptData.departments ?? [])
      setShowWorkLocation(settingsData.showWorkLocation ?? false)
      setShowHobbyTendency(settingsData.showHobbyTendency ?? false)
    })
  }, [])

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: fd.get('employee_id') }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    router.push('/mypage')
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/auth/register', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    router.push('/mypage')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">Make Connection</h1>
        <p className="text-center text-gray-500 mb-8">グループ交流イベント</p>

        {mode === 'select' && (
          <div className="bg-white rounded-2xl shadow-md p-8 space-y-4">
            <button
              onClick={() => setMode('register')}
              className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-semibold hover:bg-blue-700 transition"
            >
              はじめて参加する
            </button>
            <button
              onClick={() => setMode('login')}
              className="w-full bg-gray-100 text-gray-700 py-4 rounded-xl text-lg font-semibold hover:bg-gray-200 transition"
            >
              既に登録済み
            </button>
          </div>
        )}

        {mode === 'login' && (
          <div className="bg-white rounded-2xl shadow-md p-8">
            <button onClick={() => setMode('select')} className="text-gray-400 mb-4 text-sm hover:text-gray-600">
              ← 戻る
            </button>
            <h2 className="text-xl font-bold mb-6 text-gray-700">社員IDでログイン</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <input
                name="employee_id"
                placeholder="社員ID"
                required
                inputMode="numeric"
                pattern="[0-9]*"
                onInput={e => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '') }}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading ? 'ログイン中...' : 'ログイン'}
              </button>
            </form>
          </div>
        )}

        {mode === 'register' && (
          <div className="bg-white rounded-2xl shadow-md p-8">
            <button onClick={() => setMode('select')} className="text-gray-400 mb-4 text-sm hover:text-gray-600">
              ← 戻る
            </button>
            <h2 className="text-xl font-bold mb-6 text-gray-700">新規登録</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  社員ID <span className="text-red-500">*</span>
                </label>
                <input
                  name="employee_id"
                  placeholder="例：12345"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onInput={e => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '') }}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <p className="text-xs text-gray-400 mt-1">社員証に書かれている数字を入力してください</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  部署 <span className="text-red-500">*</span>
                </label>
                <select
                  name="department_id"
                  required
                  defaultValue=""
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
                >
                  <option value="" disabled>選択してください</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  氏名 <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  placeholder="例：山田 太郎"
                  required
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  研修中グループID <span className="text-red-500">*</span>
                </label>
                <input
                  name="training_group_id"
                  placeholder="例：92"
                  required
                  inputMode="numeric"
                  pattern="[0-9]*"
                  onInput={e => { e.currentTarget.value = e.currentTarget.value.replace(/[^0-9]/g, '') }}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <p className="text-xs text-gray-400 mt-1">「A」等のアルファベットは省き、後ろの数字のみ半角で入力してください（例：92）</p>
              </div>

              {/* 勤務地（管理者が表示ON時のみ） */}
              {showWorkLocation && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">勤務地</label>
                  <select
                    name="work_location"
                    defaultValue=""
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
                  >
                    <option value="">選択してください（任意）</option>
                    {WORK_LOCATIONS.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 趣味の傾向（管理者が表示ON時のみ） */}
              {showHobbyTendency && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-600">趣味の傾向（任意）</p>
                  <div>
                    <p className="text-xs text-gray-500 mb-2">どちらに近いですか？</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'indoor', label: '🏠 インドア派' },
                        { value: 'outdoor', label: '🌿 アウトドア派' },
                      ].map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
                          <input type="radio" name="hobby_indoor_outdoor" value={opt.value} className="accent-blue-500" />
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
                          <input type="radio" name="hobby_solo_group" value={opt.value} className="accent-blue-500" />
                          <span className="text-sm text-gray-700">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">自己紹介</label>
                <textarea
                  name="bio"
                  placeholder={"例）趣味はサウナ巡りです！新しく組むグループでは、自分から積極的にコミュニケーションを取り、全員が発言しやすい雰囲気作りを頑張ります。よろしくお願いします！"}
                  rows={5}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">【趣味】と【意気込み】を含めて200文字程度で書いてください</p>
              </div>

              <div>
                <label className="block text-sm text-gray-500 mb-1">プロフィール写真（任意）</label>
                <input
                  name="photo"
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading ? '登録中...' : '登録する'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
