import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'groups_locked')
    .maybeSingle()

  const locked = data?.value === 'true'

  return NextResponse.json({ locked }, {
    headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10' },
  })
}
