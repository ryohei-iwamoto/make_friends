'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getTextColor } from '@/lib/colors'

type Group = { id: number; group_number: number; color: string; created_at: string }
type Photo = { id: string; group_id: number; photo_url: string; taken_at: string }
type User = {
  id: string
  name: string
  employee_id: string
  group_id: number | null
  departments: { name: string } | null
}

type AdminData = {
  groups: Group[]
  photos: Photo[]
  users: User[]
  groupsLocked: boolean
}

export default function AdminDashboard() {
  const router = useRouter()
  const [data, setData] = useState<AdminData | null>(null)
  const [tab, setTab] = useState<'overview' | 'groups' | 'photos'>('overview')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [resetting, setResetting] = useState(false)
  const [groupSize, setGroupSize] = useState(6)

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/data')
    if (res.status === 401) { router.replace('/admin'); return }
    const d = await res.json()
    setData(d)
  }, [router])

  useEffect(() => { load() }, [load])

  async function handleCreateGroups() {
    if (!confirm(`${data?.users.length ?? 0}人を${groupSize}人組に分けます。よろしいですか？`)) return
    setCreating(true)
    setCreateError('')
    const res = await fetch('/api/admin/create-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupSize }),
    })
    const d = await res.json()
    if (!res.ok) { setCreateError(d.error); setCreating(false); return }
    await load()
    setCreating(false)
  }

  async function handleReset(target: 'groups' | 'all') {
    const msg = target === 'all'
      ? '⚠️ 全ユーザー・グループ・写真を削除します。本当によろしいですか？'
      : 'グループと写真をリセットします（ユーザーは残ります）。よろしいですか？'
    if (!confirm(msg)) return
    if (target === 'all' && !confirm('本当に全データを削除しますか？この操作は取り消せません。')) return
    setResetting(true)
    const res = await fetch('/api/admin/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
    })
    const d = await res.json()
    alert(d.message ?? d.error)
    await load()
    setResetting(false)
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">
        読み込み中...
      </div>
    )
  }

  const unassigned = data.users.filter(u => !u.group_id).length

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* ヘッダー */}
      <div className="bg-gray-800 px-4 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">管理画面</h1>
        <button
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            router.replace('/admin')
          }}
          className="text-gray-400 text-sm hover:text-white"
        >
          ログアウト
        </button>
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-700">
        {(['overview', 'groups', 'photos'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition ${
              tab === t ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {{ overview: '概要', groups: 'グループ', photos: '写真' }[t]}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* 概要タブ */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {/* 統計カード */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">登録者数</p>
                <p className="text-3xl font-bold">{data.users.length}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">グループ数</p>
                <p className="text-3xl font-bold">{data.groups.length}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">未割当</p>
                <p className={`text-3xl font-bold ${unassigned > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {unassigned}
                </p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">集合写真</p>
                <p className="text-3xl font-bold">{data.photos.length}</p>
              </div>
            </div>

            {/* グループ作成 */}
            {!data.groupsLocked ? (
              <div className="bg-gray-800 rounded-xl p-4">
                <h2 className="font-bold mb-2">グループ作成</h2>
                <div className="flex items-center gap-3 mb-4">
                  <label className="text-gray-400 text-sm whitespace-nowrap">1グループの人数</label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={groupSize}
                    onChange={e => setGroupSize(Math.max(2, Math.min(20, Number(e.target.value))))}
                    className="w-20 bg-gray-700 text-white text-center rounded-lg px-2 py-1 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
                  />
                  <span className="text-gray-400 text-sm">人</span>
                </div>
                <p className="text-gray-400 text-sm mb-4">
                  {data.users.length}人を約{groupSize}人組に分けます。
                  実行後は取り消せません。
                </p>
                {createError && <p className="text-red-400 text-sm mb-3">{createError}</p>}
                <button
                  onClick={handleCreateGroups}
                  disabled={creating || data.users.length < 2}
                  className="w-full bg-green-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {creating ? 'グループ作成中...' : 'グループを作成する'}
                </button>
              </div>
            ) : (
              <div className="bg-green-900/30 border border-green-700 rounded-xl p-4 text-center">
                <p className="text-green-400 font-bold">✓ グループ作成済み</p>
                <p className="text-green-600 text-sm mt-1">{data.groups.length}グループが作成されています</p>
              </div>
            )}

            {/* リセット */}
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <h2 className="font-bold text-red-400">データリセット</h2>
              <button
                onClick={() => handleReset('groups')}
                disabled={resetting}
                className="w-full bg-yellow-700 text-white py-3 rounded-xl font-semibold hover:bg-yellow-600 disabled:opacity-50 transition text-sm"
              >
                グループ・写真のみリセット（ユーザーは残す）
              </button>
              <button
                onClick={() => handleReset('all')}
                disabled={resetting}
                className="w-full bg-red-700 text-white py-3 rounded-xl font-semibold hover:bg-red-600 disabled:opacity-50 transition text-sm"
              >
                全データ削除（ユーザー含む）
              </button>
            </div>
          </div>
        )}

        {/* グループ一覧タブ */}
        {tab === 'groups' && (
          <div className="space-y-3">
            {data.groups.length === 0 ? (
              <p className="text-gray-400 text-center py-8">グループはまだ作成されていません</p>
            ) : (
              data.groups.map(group => {
                const members = data.users.filter(u => u.group_id === group.id)
                const textColor = getTextColor(group.color)
                return (
                  <div
                    key={group.id}
                    className="rounded-xl p-4"
                    style={{ backgroundColor: group.color }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-2xl font-black"
                        style={{ color: textColor }}
                      >
                        グループ {group.group_number}
                      </span>
                      <span
                        className="text-sm opacity-70"
                        style={{ color: textColor }}
                      >
                        {members.length}人
                      </span>
                    </div>
                    <div className="space-y-1">
                      {members.map(m => (
                        <div key={m.id} className="flex items-center gap-2">
                          <span
                            className="text-sm font-medium"
                            style={{ color: textColor }}
                          >
                            {m.name}
                          </span>
                          <span
                            className="text-xs opacity-60"
                            style={{ color: textColor }}
                          >
                            {m.departments?.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* 写真一覧タブ */}
        {tab === 'photos' && (
          <div>
            {data.photos.length === 0 ? (
              <p className="text-gray-400 text-center py-8">まだ写真がありません</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {data.photos.map(photo => (
                  <div key={photo.id} className="relative aspect-video rounded-xl overflow-hidden bg-gray-800">
                    <Image
                      src={photo.photo_url}
                      alt={`グループ${photo.group_id}`}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                      <p className="text-white text-xs">グループ {photo.group_id}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
