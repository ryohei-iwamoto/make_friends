import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const userId = req.cookies.get('user_id')?.value
  if (!userId) return NextResponse.json({ error: '未ログイン' }, { status: 401 })

  const { data: me } = await supabase
    .from('users')
    .select('group_id')
    .eq('id', userId)
    .single()

  if (!me?.group_id) {
    return NextResponse.json({ error: 'グループ未割り当て' }, { status: 400 })
  }

  const formData = await req.formData()
  const photo = formData.get('photo') as File

  if (!photo || photo.size === 0) {
    return NextResponse.json({ error: '写真を選択してください' }, { status: 400 })
  }

  const ext = photo.name.split('.').pop()
  const fileName = `group_${me.group_id}_${Date.now()}.${ext}`
  const buffer = Buffer.from(await photo.arrayBuffer())

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('group-photos')
    .upload(fileName, buffer, { contentType: photo.type })

  if (uploadError || !uploadData) {
    return NextResponse.json({ error: 'アップロード失敗' }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from('group-photos').getPublicUrl(uploadData.path)

  const { error } = await supabase
    .from('group_photos')
    .insert({ group_id: me.group_id, photo_url: urlData.publicUrl })

  if (error) return NextResponse.json({ error: '保存に失敗しました' }, { status: 500 })

  return NextResponse.json({ photo_url: urlData.publicUrl })
}
