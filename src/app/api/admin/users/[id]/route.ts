import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const adminAuth = req.cookies.get('admin_auth')?.value
  if (adminAuth !== 'true') {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 401 })
  }

  const { id } = await ctx.params
  const body = await req.json()

  const allowed = ['name', 'employee_id', 'training_group_id', 'work_location', 'hobby_indoor_outdoor', 'hobby_solo_group', 'group_id', 'department_id']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { error } = await supabase.from('users').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const adminAuth = req.cookies.get('admin_auth')?.value
  if (adminAuth !== 'true') {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 401 })
  }

  const { id } = await ctx.params
  const { error } = await supabase.from('users').delete().eq('id', id)
  if (error) return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
