import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createGroups } from '@/lib/grouping'

export async function POST(req: NextRequest) {
  const adminAuth = req.cookies.get('admin_auth')?.value
  if (adminAuth !== 'true') {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 401 })
  }

  // 既にグループ作成済みかチェック
  const { data: lockSetting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'groups_locked')
    .maybeSingle() as { data: { value: string } | null }

  if (lockSetting?.value === 'true') {
    return NextResponse.json({ error: '既にグループが作成されています' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({})) as {
    groupSize?: number
    useLocationGrouping?: boolean
    useHobbyGrouping?: boolean
  }
  const groupSize = Math.max(2, Math.min(20, Number(body.groupSize) || 6))
  const useLocationGrouping = body.useLocationGrouping ?? false
  const useHobbyGrouping = body.useHobbyGrouping ?? false

  // 全登録ユーザー取得（location/hobby フィールド含む）
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, department_id, training_group_id, work_location, hobby_indoor_outdoor, hobby_solo_group')

  if (usersError || !users || users.length === 0) {
    return NextResponse.json({ error: '登録ユーザーがいません' }, { status: 400 })
  }

  const assignments = createGroups(users, groupSize, { useLocationGrouping, useHobbyGrouping })

  const errors: string[] = []

  for (const assignment of assignments) {
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({ group_number: assignment.groupNumber, color: assignment.color })
      .select('id')
      .single()

    if (groupError || !group) {
      errors.push(`グループ${assignment.groupNumber}の作成失敗`)
      continue
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ group_id: group.id })
      .in('id', assignment.userIds)

    if (updateError) {
      errors.push(`グループ${assignment.groupNumber}のユーザー割り当て失敗`)
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(', ') }, { status: 500 })
  }

  await supabase
    .from('app_settings')
    .upsert({ key: 'groups_locked', value: 'true' })

  return NextResponse.json({ ok: true, groupCount: assignments.length })
}
