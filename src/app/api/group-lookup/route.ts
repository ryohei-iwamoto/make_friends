import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// グループ確定後、全員分の employee_id → グループ情報 マッピングを返す
// Vercel Edge に最大1時間キャッシュされるため DB クエリは実質1回
export async function GET() {
  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'groups_locked')
    .maybeSingle()

  if (setting?.value !== 'true') {
    return NextResponse.json({ locked: false })
  }

  const { data: users } = await supabase
    .from('users')
    .select('employee_id, groups(group_number, color)')
    .not('group_id', 'is', null)

  const lookup: Record<string, { group_number: number; color: string }> = {}
  for (const u of users ?? []) {
    const g = u.groups
    if (g && !Array.isArray(g)) {
      lookup[u.employee_id] = { group_number: g.group_number, color: g.color }
    }
  }

  return NextResponse.json({ locked: true, lookup }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
