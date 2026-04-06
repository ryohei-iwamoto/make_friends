import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value
  if (!userId) return NextResponse.json({ user: null })

  const { data } = await supabase
    .from('users')
    .select(`
      id, employee_id, name, bio, photo_url, group_id, created_at,
      work_location, hobby_indoor_outdoor, hobby_solo_group,
      departments(id, name),
      groups(id, group_number, color)
    `)
    .eq('id', userId)
    .single()

  return NextResponse.json({ user: data })
}
