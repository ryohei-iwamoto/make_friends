import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const employee_id = (formData.get('employee_id') as string)?.trim()
  const department_id = parseInt(formData.get('department_id') as string)
  const name = (formData.get('name') as string)?.trim()
  const training_group_id = (formData.get('training_group_id') as string)?.trim() || null
  const bio = (formData.get('bio') as string)?.trim() || null
  const photo = formData.get('photo') as File | null
  const work_location = (formData.get('work_location') as string)?.trim() || null
  const hobby_indoor_outdoor = (formData.get('hobby_indoor_outdoor') as string) || null
  const hobby_solo_group = (formData.get('hobby_solo_group') as string) || null

  if (!employee_id || !department_id || !name || !training_group_id) {
    return NextResponse.json({ error: '必須項目を入力してください' }, { status: 400 })
  }

  // 既存チェック
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('employee_id', employee_id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'この社員IDは既に登録されています' }, { status: 409 })
  }

  // グループ確定済みか確認
  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'groups_locked')
    .single()

  if (setting?.value === 'true') {
    return NextResponse.json({ error: 'グループ確定後は新規登録できません' }, { status: 403 })
  }

  let photo_url: string | null = null

  // 写真アップロード
  if (photo && photo.size > 0) {
    const ext = photo.name.split('.').pop()
    const fileName = `${employee_id}_${Date.now()}.${ext}`
    const buffer = Buffer.from(await photo.arrayBuffer())

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(fileName, buffer, { contentType: photo.type, upsert: true })

    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(uploadData.path)
      photo_url = urlData.publicUrl
    }
  }

  const { data, error } = await supabase
    .from('users')
    .insert({ employee_id, department_id, name, training_group_id, bio, photo_url, work_location, hobby_indoor_outdoor, hobby_solo_group })
    .select('id, employee_id, name, group_id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: '登録に失敗しました' }, { status: 500 })
  }

  const res = NextResponse.json({ user: data })
  res.cookies.set('user_id', data.id, { httpOnly: true, path: '/', maxAge: 60 * 60 * 12 })
  res.cookies.set('employee_id', data.employee_id, { path: '/', maxAge: 60 * 60 * 12 })
  return res
}
