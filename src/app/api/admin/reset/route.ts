import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const adminAuth = req.cookies.get('admin_auth')?.value
  if (adminAuth !== 'true') {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 401 })
  }

  const { target } = await req.json() as { target: 'all' | 'groups' }

  if (target === 'groups') {
    // グループ・写真のみリセット（ユーザーは残す）
    await supabase.from('group_photos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('users').update({ group_id: null }).neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('groups').delete().neq('id', 0)
    await supabase.from('app_settings').delete().eq('key', 'groups_locked')
    return NextResponse.json({ ok: true, message: 'グループをリセットしました' })
  }

  if (target === 'all') {
    // 全データリセット
    await supabase.from('group_photos').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('groups').delete().neq('id', 0)
    await supabase.from('app_settings').delete().eq('key', 'groups_locked')
    return NextResponse.json({ ok: true, message: '全データをリセットしました' })
  }

  return NextResponse.json({ error: '不正なtarget' }, { status: 400 })
}
