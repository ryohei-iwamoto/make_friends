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

// 勤務地分布（合計600）
// 東京都に偏らせ、リモート拠点は少数
const LOCATION_DISTRIBUTION = [
  { location: '東京都',   count: 290 },  // 本社メイン
  { location: '大阪府',   count:  75 },  // 西日本拠点
  { location: '愛知県',   count:  50 },  // 東海拠点
  { location: '神奈川県', count:  42 },  // 首都圏
  { location: '福岡県',   count:  35 },  // 九州拠点
  { location: '千葉県',   count:  28 },  // 首都圏
  { location: '埼玉県',   count:  22 },  // 首都圏
  { location: '宮城県',   count:  18 },  // 東北拠点
  { location: '広島県',   count:  15 },  // 中国拠点
  { location: '佐賀県',   count:  10 },  // BPO拠点
  { location: '北海道',   count:   8 },  // 北海道拠点
  { location: '静岡県',   count:   5 },  // 少数
  { location: 'その他',   count:   2 },  // 在宅等
]
// 合計: 600人

// 趣味傾向の重み（各地域で若干バイアスをつける）
// indoor/outdoor, solo/group それぞれの重み [indoor, outdoor], [solo, group]
const HOBBY_WEIGHTS_BY_LOCATION = {
  '東京都':   { inout: [55, 45], sologroup: [50, 50] },  // 都市型: インドアやや多め
  '大阪府':   { inout: [50, 50], sologroup: [45, 55] },  // 関西: 集まり系やや多め
  '愛知県':   { inout: [50, 50], sologroup: [50, 50] },
  '神奈川県': { inout: [50, 50], sologroup: [50, 50] },
  '福岡県':   { inout: [45, 55], sologroup: [45, 55] },  // 九州: アウトドア・集まり系
  '千葉県':   { inout: [50, 50], sologroup: [50, 50] },
  '埼玉県':   { inout: [50, 50], sologroup: [50, 50] },
  '宮城県':   { inout: [45, 55], sologroup: [55, 45] },  // 東北: アウトドア一人系
  '広島県':   { inout: [50, 50], sologroup: [50, 50] },
  '佐賀県':   { inout: [40, 60], sologroup: [55, 45] },  // 地方: アウトドア多め
  '北海道':   { inout: [35, 65], sologroup: [55, 45] },  // 北海道: アウトドア強め
  '静岡県':   { inout: [45, 55], sologroup: [50, 50] },
  'その他':   { inout: [50, 50], sologroup: [50, 50] },
}

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

// 部署ごとの人数配分（合計600）
// 偏りのある現実的な分布でグループ分けアルゴリズムをテスト
const DEPT_DISTRIBUTION = [
  { id: 1,  count: 85 },  // 中途採用事業本部（最大）
  { id: 2,  count: 72 },  // エージェント第一事業本部
  { id: 3,  count: 68 },  // エージェント第二事業本部
  { id: 4,  count: 55 },  // IT転職支援事業本部
  { id: 5,  count: 48 },  // レバウェルプロフェッショナルメディア事業本部
  { id: 10, count: 45 },  // レバウェル医療テック事業本部
  { id: 11, count: 40 },  // キャリアチケット事業本部
  { id: 6,  count: 30 },  // デジタルイノベーション事業本部
  { id: 19, count: 25 },  // システム本部
  { id: 18, count: 20 },  // マーケティング部
  { id: 7,  count: 18 },  // 採用本部
  { id: 8,  count: 15 },  // IT新卒紹介事業本部
  { id: 23, count: 15 },  // スタッフィング事業本部
  { id: 15, count: 12 },  // LTコーポレート本部
  { id: 12, count: 10 },  // LT経営推進本部
  { id: 20, count: 10 },  // 経営企画管理本部
  { id: 21, count:  8 },  // グローバル事業本部
  { id: 14, count:  6 },  // 海外事業本部
  { id: 9,  count:  5 },  // 海外紹介事業本部
  { id: 13, count:  4 },  // HRテック事業部
  { id: 16, count:  3 },  // M&Aアドバイザリー事業部
  { id: 17, count:  3 },  // LT管理本部
  { id: 22, count:  3 },  // LW管理本部
]
// 合計: 600人

// 研修グループ: 100グループ×6人 = 600人
// グループ番号1〜100、各グループに6人ずつ均等割り当て
function buildTrainingGroupIds() {
  const ids = []
  for (let g = 1; g <= 100; g++) {
    for (let i = 0; i < 6; i++) {
      ids.push(String(g))
    }
  }
  return ids  // 600件
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function weightedPick(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

function pickHobby(location) {
  const w = HOBBY_WEIGHTS_BY_LOCATION[location] ?? HOBBY_WEIGHTS_BY_LOCATION['その他']
  const inout = weightedPick(['indoor', 'outdoor'], w.inout)
  const sologroup = weightedPick(['solo', 'group'], w.sologroup)
  return { hobby_indoor_outdoor: inout, hobby_solo_group: sologroup }
}

function generateBio() {
  const hobby = randomItem(HOBBIES)
  const goal = randomItem(GOALS)
  return `趣味は${hobby}です！${goal}`
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

async function main() {
  const { data: departments } = await supabase.from('departments').select('id')
  if (!departments?.length) {
    console.error('部署データがありません。schema.sqlを先に実行してください。')
    process.exit(1)
  }

  const TOTAL = 600
  const BATCH_SIZE = 50

  // 部署IDリストを配分通りに展開してシャッフル
  const deptIds = []
  for (const { id, count } of DEPT_DISTRIBUTION) {
    for (let i = 0; i < count; i++) deptIds.push(id)
  }
  shuffle(deptIds)

  // 研修グループIDリスト（100グループ×6人）をシャッフル
  // → 部署と研修グループの相関をなくす
  const trainingGroupIds = buildTrainingGroupIds()
  shuffle(trainingGroupIds)

  // 勤務地リストを配分通りに展開してシャッフル
  const locationList = []
  for (const { location, count } of LOCATION_DISTRIBUTION) {
    for (let i = 0; i < count; i++) locationList.push(location)
  }
  shuffle(locationList)

  console.log('=== テストデータ構成 ===')
  console.log(`総人数: ${TOTAL}人`)
  console.log(`研修グループ: 100グループ × 6人`)
  console.log('部署分布（大→小）:')
  for (const { id, count } of DEPT_DISTRIBUTION) {
    const bar = '█'.repeat(Math.round(count / 5))
    console.log(`  dept${String(id).padStart(2)}: ${String(count).padStart(3)}人 ${bar}`)
  }
  console.log('勤務地分布（大→小）:')
  for (const { location, count } of LOCATION_DISTRIBUTION) {
    const bar = '█'.repeat(Math.round(count / 10))
    console.log(`  ${location.padEnd(5)}: ${String(count).padStart(3)}人 ${bar}`)
  }
  console.log('')

  const users = []
  const usedIds = new Set()

  for (let i = 0; i < TOTAL; i++) {
    let employeeId
    do {
      employeeId = String(10000 + Math.floor(Math.random() * 90000))
    } while (usedIds.has(employeeId))
    usedIds.add(employeeId)

    const location = locationList[i]
    const { hobby_indoor_outdoor, hobby_solo_group } = pickHobby(location)
    users.push({
      employee_id: employeeId,
      department_id: deptIds[i],
      name: `${randomItem(LAST_NAMES)} ${randomItem(FIRST_NAMES)}`,
      training_group_id: trainingGroupIds[i],
      bio: generateBio(),
      work_location: location,
      hobby_indoor_outdoor,
      hobby_solo_group,
    })
  }

  console.log(`${TOTAL}人のデータを挿入中...`)
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
  console.log('')
  console.log('=== グループ分けテストのチェックポイント ===')
  console.log('✓ 各グループに同じ研修グループIDが2人以上いないか')
  console.log('✓ 同じ部署が1グループに偏っていないか（dept1=85人、dept2=72人が要注意）')
  console.log('✓ 少数部署（3〜4人）が1グループに固まっていないか')
  console.log('✓ 勤務地×趣味クラスタリングON時: 同一地域×趣味傾向が同グループに集まるか')
  console.log('✓ 東京都(290人)が各グループに適切に分散されているか')
}

main().catch(console.error)
