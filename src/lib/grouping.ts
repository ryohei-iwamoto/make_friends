import { GROUP_COLORS } from './colors'

interface UserForGrouping {
  id: string
  department_id: number
  training_group_id: string | null
}

interface GroupAssignment {
  groupNumber: number
  color: string
  userIds: string[]
}

/**
 * グループ分けアルゴリズム
 *
 * Phase1: 部署多様性を最大化した初期割り当て
 *   - 部署ごとにメンバーをシャッフル
 *   - 人数の多い部署から順にラウンドロビンで並べる
 *     例: [部署A1, 部署B1, 部署C1, 部署A2, 部署B2, ...]
 *   - この順でグループへ割り当て。研修グループ被りがある場合はスキップして後回し
 *
 * Phase2: 部署被りをswapで最小化（ソフト制約）
 *   - TG制約を守りながらペアスワップを繰り返す
 *   - deptScore(グループ内同一部署人数の二乗和) が下がるスワップのみ採用
 */
export function createGroups(users: UserForGrouping[], baseGroupSize = 6): GroupAssignment[] {
  const totalUsers = users.length
  const groupCount = Math.floor(totalUsers / baseGroupSize)
  const remainder = totalUsers % baseGroupSize

  const groupSizes: number[] = Array(groupCount).fill(baseGroupSize)
  for (let i = 0; i < remainder; i++) {
    groupSizes[i % groupCount]++
  }

  // ── Phase 1: 部署の人数順ラウンドロビン + 研修グループ制約チェック ──────────

  // 部署ごとにグループ化し、部署内でTGがバラけるよう並べる
  const byDept = new Map<number, UserForGrouping[]>()
  for (const u of users) {
    if (!byDept.has(u.department_id)) byDept.set(u.department_id, [])
    byDept.get(u.department_id)!.push(u)
  }
  for (const [deptId, members] of byDept) {
    shuffleArray(members)
    // 部署内でTGごとにグループ化してラウンドロビンで並べ直す
    // → 同じTGのメンバーが部署内リストで均等に散らばる
    const byTG = new Map<string, UserForGrouping[]>()
    for (const u of members) {
      const key = u.training_group_id ?? '__none__'
      if (!byTG.has(key)) byTG.set(key, [])
      byTG.get(key)!.push(u)
    }
    const tgGroups = Array.from(byTG.values())
    const reordered: UserForGrouping[] = []
    const maxTGLen = Math.max(...tgGroups.map(g => g.length))
    for (let i = 0; i < maxTGLen; i++) {
      for (const tgMembers of tgGroups) {
        if (i < tgMembers.length) reordered.push(tgMembers[i])
      }
    }
    byDept.set(deptId, reordered)
  }

  // 人数の多い部署順にソート
  const sortedDepts = Array.from(byDept.values()).sort((a, b) => b.length - a.length)

  const groups: UserForGrouping[][] = Array.from({ length: groupCount }, () => [])
  const tgCountInGroup: Map<string, number>[] = Array.from({ length: groupCount }, () => new Map())
  const deferred: UserForGrouping[] = []

  // 人数の多い部署から順に、各グループへ直接ラウンドロビンで分配
  // 部署内の順番はStep1でTGがバラけるよう並べ済み
  let cursor = 0
  for (const deptMembers of sortedDepts) {
    for (const user of deptMembers) {
      const tgKey = user.training_group_id ?? '__none__'
      let placed = false

      for (let d = 0; d < groupCount; d++) {
        const g = (cursor + d) % groupCount
        if (groups[g].length < groupSizes[g] && !(tgCountInGroup[g].get(tgKey) ?? 0)) {
          groups[g].push(user)
          tgCountInGroup[g].set(tgKey, (tgCountInGroup[g].get(tgKey) ?? 0) + 1)
          cursor = (g + 1) % groupCount
          placed = true
          break
        }
      }

      if (!placed) deferred.push(user)
    }
  }

  // 後回しユーザーをTG制約を守りながら残りスペースに配置
  // 数学的保証: 研修グループの最大人数 ≤ groupCount であれば必ず全員配置できる
  for (const user of deferred) {
    const tgKey = user.training_group_id ?? '__none__'
    for (let g = 0; g < groupCount; g++) {
      if (groups[g].length < groupSizes[g] && !(tgCountInGroup[g].get(tgKey) ?? 0)) {
        groups[g].push(user)
        tgCountInGroup[g].set(tgKey, (tgCountInGroup[g].get(tgKey) ?? 0) + 1)
        break
      }
    }
  }

  // ── Phase 2: 部署被りをswapで最小化 ─────────────────────────────────────
  //
  // 全ペア (g1, g2) に対してスワップを試みる。
  // TG制約を維持しつつ deptScore の合計が減るスワップのみ採用。

  for (let pass = 0; pass < 10; pass++) {
    const gOrder = Array.from({ length: groupCount }, (_, i) => i)
    shuffleArray(gOrder)

    for (const g1 of gOrder) {
      for (let i = 0; i < groups[g1].length; i++) {
        const u1 = groups[g1][i]
        const tg1 = u1.training_group_id ?? '__none__'

        let bestImprovement = 0
        let bestG2 = -1
        let bestJ = -1

        for (let g2 = 0; g2 < groupCount; g2++) {
          if (g2 === g1) continue
          for (let j = 0; j < groups[g2].length; j++) {
            const u2 = groups[g2][j]
            const tg2 = u2.training_group_id ?? '__none__'

            // TGが同一なら絶対スワップしない
            if (tg1 === tg2) continue
            // スワップ後にg1にtg2が重複しないか確認
            if ((tgCountInGroup[g1].get(tg2) ?? 0) > 0) continue
            // スワップ後にg2にtg1が重複しないか確認
            if ((tgCountInGroup[g2].get(tg1) ?? 0) > 0) continue

            // 部署スコアが改善するか確認
            const scoreBefore = deptScore(groups[g1]) + deptScore(groups[g2])
            groups[g1][i] = u2
            groups[g2][j] = u1
            const scoreAfter = deptScore(groups[g1]) + deptScore(groups[g2])
            groups[g1][i] = u1
            groups[g2][j] = u2

            const improvement = scoreBefore - scoreAfter
            if (improvement > bestImprovement) {
              bestImprovement = improvement
              bestG2 = g2
              bestJ = j
            }
          }
        }

        if (bestG2 >= 0) {
          const u2 = groups[bestG2][bestJ]
          const tg2 = u2.training_group_id ?? '__none__'
          // スワップ実行
          groups[g1][i] = u2
          groups[bestG2][bestJ] = u1
          // TGカウント更新
          tgCountInGroup[g1].set(tg1, tgCountInGroup[g1].get(tg1)! - 1)
          tgCountInGroup[g1].set(tg2, (tgCountInGroup[g1].get(tg2) ?? 0) + 1)
          tgCountInGroup[bestG2].set(tg2, tgCountInGroup[bestG2].get(tg2)! - 1)
          tgCountInGroup[bestG2].set(tg1, (tgCountInGroup[bestG2].get(tg1) ?? 0) + 1)
        }
      }
    }
  }

  return groups.map((members, g) => ({
    groupNumber: g + 1,
    color: GROUP_COLORS[g % GROUP_COLORS.length],
    userIds: members.map(u => u.id),
  }))
}

/** グループ内の部署多様性スコア（低いほど良い）= 同一部署人数の二乗和 */
function deptScore(members: UserForGrouping[]): number {
  const counts = new Map<number, number>()
  for (const m of members) counts.set(m.department_id, (counts.get(m.department_id) ?? 0) + 1)
  let score = 0
  for (const c of counts.values()) score += c * c
  return score
}

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
