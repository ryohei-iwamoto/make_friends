import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value
  if (!userId) return NextResponse.json({ error: '未ログイン' }, { status: 401 })

  // 自分のグループIDを取得
  const { data: me } = await supabase
    .from('users')
    .select('group_id')
    .eq('id', userId)
    .single()

  if (!me?.group_id) {
    return NextResponse.json({ members: [], photos: [] })
  }

  const [membersRes, photosRes] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, bio, photo_url, departments(name)')
      .eq('group_id', me.group_id),
    supabase
      .from('group_photos')
      .select('id, photo_url, taken_at')
      .eq('group_id', me.group_id)
      .order('taken_at', { ascending: false }),
  ])

  return NextResponse.json({
    members: membersRes.data ?? [],
    photos: photosRes.data ?? [],
    group_id: me.group_id,
  })
}
