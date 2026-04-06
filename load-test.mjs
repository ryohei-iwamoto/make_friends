/**
 * 負荷テスト: 600同時接続を想定したシナリオ
 *
 * テスト対象:
 *   1. GET /api/group-lookup   (認証不要・キャッシュヘッダーあり) ← 全員が同時に叩く発表瞬間
 *   2. GET /api/settings       (認証不要・静的に近い)
 *   3. GET /api/team           (認証必要・DBを3クエリ) ← 無効cookieで401が返る速度を測定
 */

import autocannon from 'autocannon'

const BASE = 'http://localhost:3000'
const CONNECTIONS = 600  // 同時接続数
const DURATION = 15      // 秒

function run(opts) {
  return new Promise((resolve) => {
    const inst = autocannon({ ...opts, connections: CONNECTIONS, duration: DURATION })
    autocannon.track(inst)
    inst.on('done', resolve)
  })
}

console.log(`\n${'='.repeat(60)}`)
console.log(`負荷テスト開始: ${CONNECTIONS}同時接続 × ${DURATION}秒`)
console.log('='.repeat(60))

// ── 1. /api/group-lookup (認証不要) ──
console.log('\n[1/3] GET /api/group-lookup  (認証不要・グループ発表エンドポイント)')
await run({ url: `${BASE}/api/group-lookup`, title: '/api/group-lookup' })

// ── 2. /api/settings (認証不要) ──
console.log('\n[2/3] GET /api/settings  (認証不要・設定取得)')
await run({ url: `${BASE}/api/settings`, title: '/api/settings' })

// ── 3. /api/team (無効cookieで認証エラー時の速度) ──
console.log('\n[3/3] GET /api/team  (未ログイン → 401応答速度)')
await run({
  url: `${BASE}/api/team`,
  title: '/api/team (no auth)',
  headers: {},
})

console.log('\n' + '='.repeat(60))
console.log('完了')
