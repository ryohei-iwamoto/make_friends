import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PUT(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value
  if (!userId) return NextResponse.json({ error: '未ログイン' }, { status: 401 })

  const formData = await req.formData()
  const name = (formData.get('name') as string)?.trim()
  const bio = (formData.get('bio') as string)?.trim() || null
  const photo = formData.get('photo') as File | null

  if (!name) return NextResponse.json({ error: '名前は必須です' }, { status: 400 })

  const updates: Record<string, unknown> = { name, bio }

  if (photo && photo.size > 0) {
    const { data: userData } = await supabase
      .from('users')
      .select('employee_id')
      .eq('id', userId)
      .single()

    const ext = photo.name.split('.').pop()
    const fileName = `${userData?.employee_id}_${Date.now()}.${ext}`
    const buffer = Buffer.from(await photo.arrayBuffer())

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(fileName, buffer, { contentType: photo.type, upsert: true })

    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(uploadData.path)
      updates.photo_url = urlData.publicUrl
    }
  }

  const { error } = await supabase.from('users').update(updates).eq('id', userId)
  if (error) return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
