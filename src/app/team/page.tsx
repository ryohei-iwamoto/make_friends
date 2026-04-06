'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

type Member = {
  id: string
  name: string
  bio: string | null
  photo_url: string | null
  departments: { name: string } | null
}

export default function TeamPage() {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/team').then(r => {
      if (r.status === 401) { router.replace('/'); return r.json() }
      return r.json()
    }).then(data => {
      if (!data) return
      if (!data.members?.length) { router.replace('/mypage'); return }
      setMembers(data.members)
      setLoading(false)
    })
  }, [router])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">読み込み中...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="sticky top-0 bg-white border-b px-4 py-4 flex items-center gap-3">
        <Link href="/mypage" className="text-gray-400 hover:text-gray-600">←</Link>
        <h1 className="text-lg font-bold text-gray-800">チームメンバー</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {members.map(member => (
          <div key={member.id} className="bg-white rounded-xl shadow-sm p-4 flex gap-4">
            <div className="flex-shrink-0">
              {member.photo_url ? (
                <Image
                  src={member.photo_url}
                  alt={member.name}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl text-gray-400">
                  {member.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-800">{member.name}</p>
              <p className="text-xs text-gray-400 mb-2">{member.departments?.name}</p>
              {member.bio && (
                <p className="text-sm text-gray-600 leading-relaxed">{member.bio}</p>
              )}
              {!member.bio && (
                <p className="text-sm text-gray-300 italic">自己紹介なし</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
