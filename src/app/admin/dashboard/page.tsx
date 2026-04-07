'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getTextColor } from '@/lib/colors'

type Group = { id: number; group_number: number; color: string; created_at: string }
type Photo = { id: string; group_id: number; photo_url: string; taken_at: string }
type Department = { id: number; name: string }
type User = {
  id: string
  name: string
  employee_id: string
  department_id: number | null
  group_id: number | null
  training_group_id: string | null
  work_location: string | null
  hobby_indoor_outdoor: string | null
  hobby_solo_group: string | null
  departments: { id: number; name: string } | null
}
type Settings = {
  showWorkLocation: boolean
  showHobbyTendency: boolean
  useLocationGrouping: boolean
  useHobbyGrouping: boolean
}

type AdminData = {
  groups: Group[]
  photos: Photo[]
  users: User[]
  departments: Department[]
  groupsLocked: boolean
  settings: Settings
}

type EditForm = {
  name: string
  employee_id: string
  training_group_id: string
  department_id: string
  group_id: string
  work_location: string
  hobby_indoor_outdoor: string
  hobby_solo_group: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [data, setData] = useState<AdminData | null>(null)
  const [tab, setTab] = useState<'overview' | 'groups' | 'photos' | 'users' | 'export'>('overview')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [resetting, setResetting] = useState(false)
  const [targetGroupSize, setTargetGroupSize] = useState(6)
  const [minGroupSize, setMinGroupSize] = useState(4)
  const [savingSettings, setSavingSettings] = useState(false)

  // Users tab state
  const [userSearch, setUserSearch] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/data')
    if (res.status === 401) { router.replace('/admin'); return }
    const d = await res.json()
    setData(d)
  }, [router])

  useEffect(() => { load() }, [load])

  async function handleSettingToggle(key: keyof Settings) {
    if (!data) return
    setSavingSettings(true)
    const newValue = !data.settings[key]
    const newSettings = { ...data.settings, [key]: newValue }
    setData({ ...data, settings: newSettings })

    await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [settingKeyMap[key]]: newValue }),
    })
    setSavingSettings(false)
  }

  async function handleCreateGroups() {
    if (!confirm(`${data?.users.length ?? 0}人を目安${targetGroupSize}人・最低${minGroupSize}人で分けます。よろしいですか？`)) return
    setCreating(true)
    setCreateError('')
    const res = await fetch('/api/admin/create-groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetGroupSize,
        minGroupSize,
        useLocationGrouping: data?.settings.useLocationGrouping ?? false,
        useHobbyGrouping: data?.settings.useHobbyGrouping ?? false,
      }),
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

  function openEdit(user: User) {
    setEditingUser(user)
    setEditForm({
      name: user.name,
      employee_id: user.employee_id,
      training_group_id: user.training_group_id ?? '',
      department_id: String(user.department_id ?? ''),
      group_id: user.group_id !== null ? String(user.group_id) : '',
      work_location: user.work_location ?? '',
      hobby_indoor_outdoor: user.hobby_indoor_outdoor ?? '',
      hobby_solo_group: user.hobby_solo_group ?? '',
    })
    setEditError('')
  }

  async function handleEditSave() {
    if (!editingUser || !editForm) return
    setEditSaving(true)
    setEditError('')

    const body: Record<string, unknown> = {
      name: editForm.name.trim(),
      employee_id: editForm.employee_id.trim(),
      training_group_id: editForm.training_group_id.trim() || null,
      department_id: editForm.department_id ? Number(editForm.department_id) : null,
      group_id: editForm.group_id ? Number(editForm.group_id) : null,
      work_location: editForm.work_location.trim() || null,
      hobby_indoor_outdoor: editForm.hobby_indoor_outdoor || null,
      hobby_solo_group: editForm.hobby_solo_group || null,
    }

    const res = await fetch(`/api/admin/users/${editingUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await res.json()
    if (!res.ok) { setEditError(d.error); setEditSaving(false); return }

    await load()
    setEditingUser(null)
    setEditForm(null)
    setEditSaving(false)
  }

  async function handleDeleteUser(user: User) {
    if (!confirm(`「${user.name}」を削除しますか？この操作は取り消せません。`)) return
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    const d = await res.json()
    if (!res.ok) { alert(d.error); return }
    await load()
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">
        読み込み中...
      </div>
    )
  }

  const unassigned = data.users.filter(u => !u.group_id).length
  const groupMap = new Map(data.groups.map(g => [g.id, g.group_number]))

  const filteredUsers = data.users.filter(u => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return true
    return (
      u.name.toLowerCase().includes(q) ||
      u.employee_id.toLowerCase().includes(q) ||
      (u.departments?.name ?? '').toLowerCase().includes(q) ||
      (u.training_group_id ?? '').toLowerCase().includes(q)
    )
  })

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
      <div className="flex overflow-x-auto border-b border-gray-700">
        {(['overview', 'groups', 'photos', 'users', 'export'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-shrink-0 px-3 py-3 text-xs font-medium transition ${
              tab === t ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {{ overview: '概要', groups: 'グループ', photos: '写真', users: 'ユーザー', export: 'エクスポート' }[t]}
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

            {/* フォーム・グループ分け設定 */}
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold">フォーム・グループ分け設定</h2>
                {savingSettings && <span className="text-xs text-gray-500">保存中...</span>}
              </div>
              <p className="text-gray-400 text-xs mb-2">グループ作成前に設定してください</p>

              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">フォームに表示</p>
                <ToggleRow
                  label="勤務地フィールドを表示"
                  value={data.settings.showWorkLocation}
                  onToggle={() => handleSettingToggle('showWorkLocation')}
                />
                <ToggleRow
                  label="趣味傾向フィールドを表示"
                  value={data.settings.showHobbyTendency}
                  onToggle={() => handleSettingToggle('showHobbyTendency')}
                />
              </div>

              <div className="space-y-1 pt-2 border-t border-gray-700">
                <p className="text-xs text-gray-500 uppercase tracking-wide">グループ分けに使用</p>
                <ToggleRow
                  label="勤務地でグループ分け（同エリアをまとめる）"
                  value={data.settings.useLocationGrouping}
                  onToggle={() => handleSettingToggle('useLocationGrouping')}
                />
                <ToggleRow
                  label="趣味傾向でグループ分け（同フィールドをまとめる）"
                  value={data.settings.useHobbyGrouping}
                  onToggle={() => handleSettingToggle('useHobbyGrouping')}
                />
              </div>
            </div>

            {/* グループ作成 */}
            {!data.groupsLocked ? (
              <div className="bg-gray-800 rounded-xl p-4">
                <h2 className="font-bold mb-2">グループ作成</h2>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-3">
                    <label className="text-gray-400 text-sm w-32">目安の人数</label>
                    <input
                      type="number"
                      min={2}
                      max={50}
                      value={targetGroupSize}
                      onChange={e => {
                        const v = Math.max(2, Math.min(50, Number(e.target.value)))
                        setTargetGroupSize(v)
                        if (minGroupSize > v) setMinGroupSize(v)
                      }}
                      className="w-20 bg-gray-700 text-white text-center rounded-lg px-2 py-1 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
                    />
                    <span className="text-gray-400 text-sm">人</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-gray-400 text-sm w-32">最低人数</label>
                    <input
                      type="number"
                      min={2}
                      max={targetGroupSize}
                      value={minGroupSize}
                      onChange={e => setMinGroupSize(Math.max(2, Math.min(targetGroupSize, Number(e.target.value))))}
                      className="w-20 bg-gray-700 text-white text-center rounded-lg px-2 py-1 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
                    />
                    <span className="text-gray-400 text-sm">人以上</span>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-4">
                  {data.users.length}人を目安{targetGroupSize}人・最低{minGroupSize}人で分けます。
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
                      <span className="text-2xl font-black" style={{ color: textColor }}>
                        グループ {group.group_number}
                      </span>
                      <span className="text-sm opacity-70" style={{ color: textColor }}>
                        {members.length}人
                      </span>
                    </div>
                    <div className="space-y-2">
                      {members.map(m => (
                        <div key={m.id}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: textColor }}>
                              {m.name}
                            </span>
                            <span className="text-xs opacity-60" style={{ color: textColor }}>
                              {m.departments?.name}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 mt-0.5">
                            {m.training_group_id && (
                              <span className="text-xs opacity-50" style={{ color: textColor }}>
                                研修: {m.training_group_id}
                              </span>
                            )}
                            {m.work_location && (
                              <span className="text-xs opacity-50" style={{ color: textColor }}>
                                {m.work_location}
                              </span>
                            )}
                            {m.hobby_indoor_outdoor && (
                              <span className="text-xs opacity-50" style={{ color: textColor }}>
                                {m.hobby_indoor_outdoor === 'indoor' ? '屋内' : '屋外'}
                                {m.hobby_solo_group ? `・${m.hobby_solo_group === 'solo' ? 'ソロ' : 'グループ'}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ユーザー一覧タブ */}
        {tab === 'users' && (
          <div className="space-y-3">
            {/* 検索 */}
            <input
              type="text"
              placeholder="名前・社員ID・事業部・研修グループで検索"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm border border-gray-700 focus:outline-none focus:border-blue-400 placeholder-gray-500"
            />
            <p className="text-gray-500 text-xs">{filteredUsers.length} 件</p>

            {filteredUsers.length === 0 ? (
              <p className="text-gray-400 text-center py-8">該当するユーザーがいません</p>
            ) : (
              filteredUsers.map(user => (
                <div key={user.id} className="bg-gray-800 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{user.name}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{user.employee_id}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {user.departments?.name && (
                          <span className="text-xs text-gray-400">{user.departments.name}</span>
                        )}
                        {user.training_group_id && (
                          <span className="text-xs text-gray-500">研修: {user.training_group_id}</span>
                        )}
                        <span className={`text-xs ${user.group_id ? 'text-blue-400' : 'text-yellow-500'}`}>
                          {user.group_id ? `グループ ${groupMap.get(user.group_id) ?? user.group_id}` : '未割当'}
                        </span>
                      </div>
                      {(user.work_location || user.hobby_indoor_outdoor) && (
                        <div className="flex flex-wrap gap-x-3 mt-0.5">
                          {user.work_location && (
                            <span className="text-xs text-gray-500">{user.work_location}</span>
                          )}
                          {user.hobby_indoor_outdoor && (
                            <span className="text-xs text-gray-500">
                              {user.hobby_indoor_outdoor === 'indoor' ? '屋内' : '屋外'}
                              {user.hobby_solo_group ? `・${user.hobby_solo_group === 'solo' ? 'ソロ' : 'グループ'}` : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => openEdit(user)}
                        className="bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-gray-600 transition"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="bg-red-800 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-700 transition"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* エクスポートタブ */}
        {tab === 'export' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-xl p-4">
              <h2 className="font-bold mb-1">ユーザー一覧</h2>
              <p className="text-gray-400 text-sm mb-4">登録者全員の情報をCSVでダウンロード（{data.users.length}人）</p>
              <button
                onClick={() => {
                  const rows = [['名前', '社員ID', '事業部', '研修グループID', 'グループ番号', '勤務地', '趣味（屋内/屋外）', '趣味（ソロ/グループ）']]
                  const sorted = [...data.users].sort((a, b) => a.employee_id.localeCompare(b.employee_id))
                  for (const u of sorted) {
                    rows.push([
                      u.name,
                      u.employee_id,
                      u.departments?.name ?? '',
                      u.training_group_id ?? '',
                      u.group_id ? String(groupMap.get(u.group_id) ?? '') : '未割当',
                      u.work_location ?? '',
                      u.hobby_indoor_outdoor === 'indoor' ? '屋内' : u.hobby_indoor_outdoor === 'outdoor' ? '屋外' : '',
                      u.hobby_solo_group === 'solo' ? 'ソロ' : u.hobby_solo_group === 'group' ? 'グループ' : '',
                    ])
                  }
                  const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
                  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = 'users.csv'; a.click()
                  URL.revokeObjectURL(url)
                }}
                disabled={data.users.length === 0}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition text-sm"
              >
                ユーザー一覧をダウンロード
              </button>
            </div>

            <div className="bg-gray-800 rounded-xl p-4">
              <h2 className="font-bold mb-1">グループ分け一覧</h2>
              <p className="text-gray-400 text-sm mb-4">名前・社員ID・事業部・グループ番号をCSVでダウンロード</p>
              <button
                onClick={() => {
                  const rows = [['グループ番号', '名前', '社員ID', '事業部']]
                  const sorted = [...data.users].sort((a, b) => {
                    const ga = a.group_id ? (groupMap.get(a.group_id) ?? 0) : 0
                    const gb = b.group_id ? (groupMap.get(b.group_id) ?? 0) : 0
                    return ga - gb
                  })
                  for (const u of sorted) {
                    rows.push([
                      u.group_id ? String(groupMap.get(u.group_id) ?? '') : '未割当',
                      u.name,
                      u.employee_id,
                      u.departments?.name ?? '',
                    ])
                  }
                  const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
                  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = 'groups.csv'; a.click()
                  URL.revokeObjectURL(url)
                }}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition text-sm"
              >
                グループ一覧をダウンロード
              </button>
            </div>

            <div className="bg-gray-800 rounded-xl p-4">
              <h2 className="font-bold mb-1">集合写真一覧</h2>
              <p className="text-gray-400 text-sm mb-4">グループ番号・写真URLをCSVでダウンロード</p>
              <button
                onClick={() => {
                  const rows = [['グループ番号', '写真URL', '撮影日時']]
                  for (const p of data.photos) {
                    rows.push([
                      String(groupMap.get(p.group_id) ?? p.group_id),
                      p.photo_url,
                      p.taken_at,
                    ])
                  }
                  const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
                  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = 'photos.csv'; a.click()
                  URL.revokeObjectURL(url)
                }}
                disabled={data.photos.length === 0}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition text-sm"
              >
                写真一覧をダウンロード（{data.photos.length}枚）
              </button>
            </div>
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

      {/* 編集モーダル */}
      {editingUser && editForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-gray-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90dvh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 px-4 pt-4 pb-3 flex items-center justify-between border-b border-gray-700">
              <h2 className="font-bold text-base">ユーザー編集</h2>
              <button
                onClick={() => { setEditingUser(null); setEditForm(null) }}
                className="text-gray-400 hover:text-white text-sm"
              >
                閉じる
              </button>
            </div>

            <div className="p-4 space-y-4">
              <Field label="名前">
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-400"
                />
              </Field>

              <Field label="社員ID">
                <input
                  type="text"
                  value={editForm.employee_id}
                  onChange={e => setEditForm({ ...editForm, employee_id: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-400"
                />
              </Field>

              <Field label="研修グループID">
                <input
                  type="text"
                  value={editForm.training_group_id}
                  onChange={e => setEditForm({ ...editForm, training_group_id: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-400"
                />
              </Field>

              <Field label="事業部">
                <select
                  value={editForm.department_id}
                  onChange={e => setEditForm({ ...editForm, department_id: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-400"
                >
                  <option value="">未設定</option>
                  {data.departments.map(d => (
                    <option key={d.id} value={String(d.id)}>{d.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="グループ">
                <select
                  value={editForm.group_id}
                  onChange={e => setEditForm({ ...editForm, group_id: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-400"
                >
                  <option value="">未割当</option>
                  {data.groups.map(g => (
                    <option key={g.id} value={String(g.id)}>グループ {g.group_number}</option>
                  ))}
                </select>
              </Field>

              <Field label="勤務地">
                <input
                  type="text"
                  value={editForm.work_location}
                  onChange={e => setEditForm({ ...editForm, work_location: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-400"
                />
              </Field>

              <Field label="趣味傾向（屋内/屋外）">
                <select
                  value={editForm.hobby_indoor_outdoor}
                  onChange={e => setEditForm({ ...editForm, hobby_indoor_outdoor: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-400"
                >
                  <option value="">未設定</option>
                  <option value="indoor">屋内</option>
                  <option value="outdoor">屋外</option>
                </select>
              </Field>

              <Field label="趣味傾向（ソロ/グループ）">
                <select
                  value={editForm.hobby_solo_group}
                  onChange={e => setEditForm({ ...editForm, hobby_solo_group: e.target.value })}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-blue-400"
                >
                  <option value="">未設定</option>
                  <option value="solo">ソロ</option>
                  <option value="group">グループ</option>
                </select>
              </Field>

              {editError && <p className="text-red-400 text-sm">{editError}</p>}

              <button
                onClick={handleEditSave}
                disabled={editSaving || !editForm.name.trim()}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {editSaving ? '保存中...' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const settingKeyMap: Record<keyof Settings, string> = {
  showWorkLocation:    'show_work_location',
  showHobbyTendency:   'show_hobby_tendency',
  useLocationGrouping: 'use_location_grouping',
  useHobbyGrouping:    'use_hobby_grouping',
}

function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string
  value: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-2 px-1 hover:bg-gray-700/50 rounded-lg transition"
    >
      <span className="text-sm text-gray-300 text-left">{label}</span>
      <div className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${value ? 'bg-blue-500' : 'bg-gray-600'}`}>
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
      </div>
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-400">{label}</label>
      {children}
    </div>
  )
}
