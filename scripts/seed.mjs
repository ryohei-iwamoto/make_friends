import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cqciiezkahwdwgclpmxr.supabase.co'
const SUPABASE_KEY = 'sb_publishable_yDFJTbEMDbUflMGhCdfJOw_qptmIbOh'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const LAST_NAMES = ['田中', '鈴木', '佐藤', '山田', '中村', '小林', '加藤', '吉田', '渡辺', '山本',
  '伊藤', '松本', '井上', '木村', '林', '清水', '山崎', '池田', '橋本', '阿部',
  '石川', '山口', '前田', '後藤', '長谷川', '近藤', '高橋', '岡田', '村上', '藤井']

const FIRST_NAMES = ['太郎', '花子', '健', '美咲', '拓也', '由美', '翔', '愛', '大輔', '麻衣',
  '誠', '奈々', '浩二', '沙織', '康平', '優子', '雄太', '恵', '直樹', '千夏',
  '修', '瞳', '達也', '理恵', '慎一', '明美', '龍一', '智子', '悠', '彩']

const HOBBIES = ['サウナ', 'キャンプ', '登山', '読書', '料理', '旅行', 'ゲーム', '筋トレ', '映画鑑賞', 'カフェ巡り',
  'ランニング', 'サイクリング', '釣り', 'DIY', '写真', 'ヨガ', '音楽', 'テニス', 'スキー', 'ダイビング']

const GOALS = [
  '普段関わりのない部署の方とたくさん話したいです！',
  '新しい友達を作りたいと思っています。',
  '積極的にコミュニケーションを取りたいです！',
  '全員が発言しやすい雰囲気作りを頑張ります。',
  'いろんな部署の仕事について知りたいです。',
  'チームの雰囲気を盛り上げたいと思います！',
  '楽しい時間にしましょう！',
  '新しい発見があると嬉しいです。',
]

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateBio() {
  const hobby = randomItem(HOBBIES)
  const goal = randomItem(GOALS)
  return `趣味は${hobby}です！${goal}`
}

async function main() {
  // 部署一覧取得
  const { data: departments } = await supabase
    .from('departments')
    .select('id')
    .lte('id', 23) // 未定・その他は除く

  if (!departments?.length) {
    console.error('部署データがありません。schema.sqlを先に実行してください。')
    process.exit(1)
  }

  const deptIds = departments.map(d => d.id)
  const TOTAL = 600
  const BATCH_SIZE = 50

  console.log(`${TOTAL}人のテストデータを生成中...`)

  const users = []
  const usedIds = new Set()

  for (let i = 0; i < TOTAL; i++) {
    // 重複しない社員IDを生成
    let employeeId
    do {
      employeeId = String(10000 + Math.floor(Math.random() * 90000))
    } while (usedIds.has(employeeId))
    usedIds.add(employeeId)

    const lastName = randomItem(LAST_NAMES)
    const firstName = randomItem(FIRST_NAMES)
    const deptId = deptIds[i % deptIds.length] // 均等に分散

    // 研修グループID: 1〜100
    const trainingGroupId = String(1 + Math.floor(Math.random() * 100))

    users.push({
      employee_id: employeeId,
      department_id: deptId,
      name: `${lastName} ${firstName}`,
      training_group_id: trainingGroupId,
      bio: generateBio(),
    })
  }

  // バッチinsert
  let inserted = 0
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('users').insert(batch)
    if (error) {
      console.error(`バッチ${Math.floor(i / BATCH_SIZE) + 1} エラー:`, error.message)
    } else {
      inserted += batch.length
      process.stdout.write(`\r${inserted}/${TOTAL} 件挿入完了`)
    }
  }

  console.log('\n完了！')
}

main().catch(console.error)
