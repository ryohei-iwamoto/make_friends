import { GROUP_COLORS } from './colors'
import { getLocationRegion } from './locations'

interface UserForGrouping {
  id: string
  department_id: number
  training_group_id: string | null
  work_location?: string | null
  hobby_indoor_outdoor?: string | null  // 'indoor' | 'outdoor'
  hobby_solo_group?: string | null      // 'solo' | 'group'
}

interface GroupAssignment {
  groupNumber: number
  color: string
  userIds: string[]
}

export interface GroupingOptions {
  useLocationGrouping?: boolean
  useHobbyGrouping?: boolean
}

/**
 * 2フェーズ グループ分けアルゴリズム
 *
 * Phase1: 初期割り当て
 *   通常モード: 部署の人数順ラウンドロビン + TG制約
 *   location/hobbyモード: (勤務地エリア × 趣味象限) でクラスタリング + TG制約
 *
 * Phase2: スコア最適化（swap）
 *   TG制約を守りながら combinedScore が下がるスワップのみ採用
 *   - 部署多様性スコア（低いほど良い）を最小化
 *   - location/hobby有効時はクラスタリングスコアも報酬として加算
 */
export function createGroups(
  users: UserForGrouping[],
  baseGroupSize = 6,
  options: GroupingOptions = {},
): GroupAssignment[] {
  const { useLocationGrouping = false, useHobbyGrouping = false } = options

  const totalUsers = users.length
  const groupCount = Math.floor(totalUsers / baseGroupSize)
  const remainder = totalUsers % baseGroupSize

  const groupSizes: number[] = Array(groupCount).fill(baseGroupSize)
  for (let i = 0; i < remainder; i++) {
    groupSizes[i % groupCount]++
  }

  const groups: UserForGrouping[][] = Array.from({ length: groupCount }, () => [])
  const tgCountInGroup: Map<string, number>[] = Array.from({ length: groupCount }, () => new Map())
  const deferred: UserForGrouping[] = []

  if (useLocationGrouping || useHobbyGrouping) {
    // ── Phase 1 (クラスタリングモード): location × hobby バケットごとに同じグループへ ──

    // バケット作成
    const bucketMap = new Map<string, UserForGrouping[]>()
    for (const u of users) {
      const locKey = useLocationGrouping ? getLocationRegion(u.work_location) : 'all'
      const hobbyKey = useHobbyGrouping ? getHobbyQuadrant(u) : 'all'
      const key = `${locKey}|${hobbyKey}`
      if (!bucketMap.has(key)) bucketMap.set(key, [])
      bucketMap.get(key)!.push(u)
    }

    // バケット内でTGがバラけるよう並べ直す
    for (const [key, members] of bucketMap) {
      shuffleArray(members)
      const byTG = new Map<string, UserForGrouping[]>()
      for (const u of members) {
        const tgKey = u.training_group_id ?? '__none__'
        if (!byTG.has(tgKey)) byTG.set(tgKey, [])
        byTG.get(tgKey)!.push(u)
      }
      const tgGroups = Array.from(byTG.values())
      const reordered: UserForGrouping[] = []
      const maxLen = Math.max(...tgGroups.map(g => g.length))
      for (let i = 0; i < maxLen; i++) {
        for (const tgMembers of tgGroups) {
          if (i < tgMembers.length) reordered.push(tgMembers[i])
        }
      }
      bucketMap.set(key, reordered)
    }

    // 大きいバケットから順に処理
    const sortedBuckets = Array.from(bucketMap.values()).sort((a, b) => b.length - a.length)

    // 各バケットを同じグループへ詰める。グループが満員になったら次へ
    let fillIdx = 0
    const advanceFill = () => {
      do { fillIdx = (fillIdx + 1) % groupCount }
      while (groups[fillIdx].length >= groupSizes[fillIdx])
    }

    for (const bucket of sortedBuckets) {
      for (const user of bucket) {
        const tgKey = user.training_group_id ?? '__none__'
        let placed = false

        // まず現在の fillIdx グループへ（クラスタリング優先）
        if (
          groups[fillIdx].length < groupSizes[fillIdx] &&
          !(tgCountInGroup[fillIdx].get(tgKey) ?? 0)
        ) {
          groups[fillIdx].push(user)
          tgCountInGroup[fillIdx].set(tgKey, 1)
          placed = true
        }

        if (!placed) {
          // TG制約で入れない → 他のグループを探す
          for (let d = 1; d < groupCount; d++) {
            const g = (fillIdx + d) % groupCount
            if (groups[g].length < groupSizes[g] && !(tgCountInGroup[g].get(tgKey) ?? 0)) {
              groups[g].push(user)
              tgCountInGroup[g].set(tgKey, (tgCountInGroup[g].get(tgKey) ?? 0) + 1)
              placed = true
              break
            }
          }
        }

        if (!placed) deferred.push(user)

        // fillIdx が満員になったら次へ
        if (groups[fillIdx].length >= groupSizes[fillIdx]) {
          advanceFill()
        }
      }

      // バケット処理完了 → 次のバケットは新しいグループから開始
      if (groups[fillIdx].length > 0) advanceFill()
    }
  } else {
    // ── Phase 1 (通常モード): 部署の人数順ラウンドロビン ──────────────────────

    const byDept = new Map<number, UserForGrouping[]>()
    for (const u of users) {
      if (!byDept.has(u.department_id)) byDept.set(u.department_id, [])
      byDept.get(u.department_id)!.push(u)
    }
    for (const [deptId, members] of byDept) {
      shuffleArray(members)
      // 部署内でTGがバラけるよう並べ直す
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

    const sortedDepts = Array.from(byDept.values()).sort((a, b) => b.length - a.length)

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
  }

  // 後回しユーザーをTG制約を守りながら残りスペースに配置
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

  // ── Phase 2: combinedScore を最小化するスワップ（10パス）─────────────────────

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

            if (tg1 === tg2) continue
            if ((tgCountInGroup[g1].get(tg2) ?? 0) > 0) continue
            if ((tgCountInGroup[g2].get(tg1) ?? 0) > 0) continue

            const scoreBefore =
              combinedScore(groups[g1], useLocationGrouping, useHobbyGrouping) +
              combinedScore(groups[g2], useLocationGrouping, useHobbyGrouping)
            groups[g1][i] = u2
            groups[g2][j] = u1
            const scoreAfter =
              combinedScore(groups[g1], useLocationGrouping, useHobbyGrouping) +
              combinedScore(groups[g2], useLocationGrouping, useHobbyGrouping)
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
          groups[g1][i] = u2
          groups[bestG2][bestJ] = u1
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

/** 趣味象限キー: 'indoor_solo' | 'indoor_group' | 'outdoor_solo' | 'outdoor_group' */
function getHobbyQuadrant(user: UserForGrouping): string {
  const io = user.hobby_indoor_outdoor ?? 'unknown'
  const sg = user.hobby_solo_group ?? 'unknown'
  return `${io}_${sg}`
}

/**
 * グループの総合スコア（低いほど良い）
 * - 部署多様性: deptScore（低 = 多様）
 * - location有効時: locationClusterScore を引く（高 = 同勤務地クラスタ = 良）
 * - hobby有効時: hobbyClusterScore を引く（高 = 同趣味象限クラスタ = 良）
 */
function combinedScore(
  members: UserForGrouping[],
  useLocation: boolean,
  useHobby: boolean,
): number {
  let score = deptScore(members)
  if (useLocation) score -= locationClusterScore(members)
  if (useHobby) score -= hobbyClusterScore(members)
  return score
}

/** 部署多様性スコア（低いほど多様） = 同一部署人数の二乗和 */
function deptScore(members: UserForGrouping[]): number {
  const counts = new Map<number, number>()
  for (const m of members) counts.set(m.department_id, (counts.get(m.department_id) ?? 0) + 1)
  let score = 0
  for (const c of counts.values()) score += c * c
  return score
}

/** 勤務地クラスタリングスコア（高いほど同勤務地が集まっている） = 同一エリア人数の二乗和 */
function locationClusterScore(members: UserForGrouping[]): number {
  const counts = new Map<string, number>()
  for (const m of members) {
    const region = getLocationRegion(m.work_location)
    counts.set(region, (counts.get(region) ?? 0) + 1)
  }
  let score = 0
  for (const c of counts.values()) score += c * c
  return score
}

/** 趣味象限クラスタリングスコア（高いほど同象限が集まっている） = 同一象限人数の二乗和 */
function hobbyClusterScore(members: UserForGrouping[]): number {
  const counts = new Map<string, number>()
  for (const m of members) {
    const q = getHobbyQuadrant(m)
    counts.set(q, (counts.get(q) ?? 0) + 1)
  }
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
