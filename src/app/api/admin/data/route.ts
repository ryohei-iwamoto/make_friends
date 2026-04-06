import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const adminAuth = req.cookies.get('admin_auth')?.value
  if (adminAuth !== 'true') {
    return NextResponse.json({ error: '管理者権限が必要です' }, { status: 401 })
  }

  const [groupsRes, photosRes, usersRes, settingsRes, departmentsRes] = await Promise.all([
    supabase
      .from('groups')
      .select('id, group_number, color, created_at')
      .order('group_number'),
    supabase
      .from('group_photos')
      .select('id, group_id, photo_url, taken_at')
      .order('taken_at', { ascending: false }),
    supabase
      .from('users')
      .select('id, name, employee_id, department_id, group_id, training_group_id, work_location, hobby_indoor_outdoor, hobby_solo_group, departments(id, name)')
      .order('group_id'),
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['groups_locked', 'show_work_location', 'show_hobby_tendency', 'use_location_grouping', 'use_hobby_grouping']),
    supabase
      .from('departments')
      .select('id, name')
      .order('id'),
  ])

  const settingsMap: Record<string, string> = {}
  for (const row of settingsRes.data ?? []) settingsMap[row.key] = row.value

  return NextResponse.json({
    groups: groupsRes.data ?? [],
    photos: photosRes.data ?? [],
    users: usersRes.data ?? [],
    departments: departmentsRes.data ?? [],
    groupsLocked: settingsMap['groups_locked'] === 'true',
    settings: {
      showWorkLocation:    settingsMap['show_work_location']    === 'true',
      showHobbyTendency:  settingsMap['show_hobby_tendency']   === 'true',
      useLocationGrouping: settingsMap['use_location_grouping'] === 'true',
      useHobbyGrouping:   settingsMap['use_hobby_grouping']    === 'true',
    },
  })
}
