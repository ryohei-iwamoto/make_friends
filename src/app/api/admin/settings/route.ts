import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const ALLOWED_KEYS = [
  'show_work_location',
  'show_hobby_tendency',
  'use_location_grouping',
  'use_hobby_grouping',
] as const

export async function PATCH(req: NextRequest) {
  const adminAuth = req.cookies.get('admin_auth')?.value
  if (adminAuth !== 'true') {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 401 })
  }

  const body = await req.json() as Record<string, unknown>

  for (const key of ALLOWED_KEYS) {
    if (key in body) {
      await supabase
        .from('app_settings')
        .upsert({ key, value: String(body[key]) })
    }
  }

  return NextResponse.json({ ok: true })
}
