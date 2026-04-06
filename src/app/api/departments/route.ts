import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data } = await supabase.from('departments').select('id, name').order('id')
  return NextResponse.json({ departments: data ?? [] })
}
