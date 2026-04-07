import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value
  if (!userId) return NextResponse.json({ error: '未ログイン' }, { status: 401 })

  // グループ確定済みのユーザーは削除不可
  const { data: user } = await supabase
    .from('users')
    .select('group_id')
    .eq('id', userId)
    .single()

  if (!user) return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
  if (user.group_id) return NextResponse.json({ error: 'グループ確定後は削除できません' }, { status: 403 })

  const { error } = await supabase.from('users').delete().eq('id', userId)
  if (error) return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })

  const res = NextResponse.json({ ok: true })
  res.cookies.delete('user_id')
  res.cookies.delete('employee_id')
  return res
}
