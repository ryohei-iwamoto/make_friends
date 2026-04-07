import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['show_work_location', 'show_hobby_tendency'])

  const map: Record<string, string> = {}
  for (const row of data ?? []) map[row.key] = row.value

  return NextResponse.json({
    showWorkLocation: map['show_work_location'] === 'true',
    showHobbyTendency: map['show_hobby_tendency'] === 'true',
  })
}
