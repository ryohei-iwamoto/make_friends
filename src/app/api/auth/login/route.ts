import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { employee_id } = await req.json()

  if (!employee_id?.trim()) {
    return NextResponse.json({ error: '社員IDを入力してください' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, employee_id, name, group_id')
    .eq('employee_id', employee_id.trim())
    .single()

  if (error || !data) {
    return NextResponse.json({ error: '社員IDが見つかりません' }, { status: 404 })
  }

  const res = NextResponse.json({ user: data })
  res.cookies.set('user_id', data.id, { httpOnly: true, path: '/', maxAge: 60 * 60 * 12 })
  res.cookies.set('employee_id', data.employee_id, { path: '/', maxAge: 60 * 60 * 12 })
  return res
}
