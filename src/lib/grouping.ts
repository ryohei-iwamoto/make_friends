import { GROUP_COLORS } from './colors'
import { getLocationRegion } from './locations'

interface UserForGrouping {
  id: string
  department_id: number
  training_group_id: string | null
  work_location?: string | null
  hobby_indoor_outdoor?: string | null
  hobby_solo_group?: string | null
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
 * グループ分けアルゴリズム
 *
 * Step1: クラスタ確定
 *   [location OFF / hobby OFF]
 *     全員を1クラスタとして扱う（部署多様性のみで分割）
 *
 *   [location ON / hobby OFF]
 *     同じ勤務地エリアを1クラスタ。
 *     クラスタが minGroupSize 未満 → overflow（他の小クラスタと合流）
 *
 *   [location ON / hobby ON]
 *     同勤務地 × 同フィールド（indoor/outdoor）を1クラスタ。
 *     (loc × field) が minGroupSize 未満 → 同勤務地内の小クラスタ同士を合流。
 *     合流後もまだ minGroupSize 未満 → overflow。
 *
 * Step2: クラスタ内を分割
 *   groupCount = floor(clusterSize / targetGroupSize)（最低1）
 *   残りは先頭グループに +1 ずつ配る（例: 6,6,7,7）。
 *   部署ラウンドロビン + TG制約でユーザーを割り当て。
 *
 * Step3: クラスタ内でスワップ最適化（部署多様性スコア最小化）
 *   ※クラスタをまたいだスワップは行わない（勤務地グループを維持するため）
 */
export function createGroups(
  users: UserForGrouping[],
  targetGroupSize = 6,
  minGroupSize = 4,
  options: GroupingOptions = {},
): GroupAssignment[] {
  if (users.length === 0) return []

  const { useLocationGrouping = false, useHobbyGrouping = false } = options

  // Step1: クラスタ確定
  const clusters = buildClusters(users, useLocationGrouping, useHobbyGrouping, minGroupSize)

  // Step2+3: クラスタごとに分割 → スワップ最適化
  const allGroups: UserForGrouping[][] = []

  for (const cluster of clusters) {
    const { groups, tgCounts } = splitCluster(cluster, targetGroupSize)
    swapOptimize(groups, tgCounts)
    allGroups.push(...groups)
  }

  return allGroups.map((members, g) => ({
    groupNumber: g + 1,
    color: GROUP_COLORS[g % GROUP_COLORS.length],
    userIds: members.map(u => u.id),
  }))
}

// ── Step1: クラスタ確定 ───────────────────────────────────────────────

/**
 * 勤務地・趣味の設定に応じてユーザーをクラスタに分類する。
 *
 * hobby ON の場合、各勤務地内で4段階カスケード:
 *   L1: (indoor/outdoor × solo/group) の4象限
 *   L2: (indoor/outdoor) の2分割       ← L1が minGroupSize 未満
 *   L3: 趣味の垣根を外す（勤務地のみ）  ← L2が minGroupSize 未満
 *   overflow: 勤務地ごとまとめて小さい同士でくっつける ← L3も未満
 */
function buildClusters(
  users: UserForGrouping[],
  useLocation: boolean,
  useHobby: boolean,
  minGroupSize: number,
): UserForGrouping[][] {
  if (!useLocation && !useHobby) return [users]

  const byLoc = new Map<string, UserForGrouping[]>()
  for (const u of users) {
    const loc = useLocation ? getLocationRegion(u.work_location) : 'all'
    if (!byLoc.has(loc)) byLoc.set(loc, [])
    byLoc.get(loc)!.push(u)
  }

  const clusters: UserForGrouping[][] = []
  const overflowClusters: UserForGrouping[][] = []

  for (const [, locUsers] of byLoc) {
    if (!useHobby) {
      if (locUsers.length >= minGroupSize) {
        clusters.push(locUsers)
      } else {
        overflowClusters.push(locUsers)
      }
      continue
    }

    // L1: 4象限（indoor/outdoor × solo/group）でクラスタ化
    const byQuadrant = new Map<string, UserForGrouping[]>()
    for (const u of locUsers) {
      const io = u.hobby_indoor_outdoor ?? 'unknown'
      const sg = u.hobby_solo_group ?? 'unknown'
      const key = `${io}|${sg}`
      if (!byQuadrant.has(key)) byQuadrant.set(key, [])
      byQuadrant.get(key)!.push(u)
    }

    // L1が minGroupSize 未満 → L2（indoor/outdoor）へ集約
    const smallForL2 = new Map<string, UserForGrouping[]>()
    for (const [qKey, qUsers] of byQuadrant) {
      if (qUsers.length >= minGroupSize) {
        clusters.push(qUsers)
      } else {
        const io = qKey.split('|')[0]
        if (!smallForL2.has(io)) smallForL2.set(io, [])
        smallForL2.get(io)!.push(...qUsers)
      }
    }

    // L2が minGroupSize 未満 → L3（勤務地のみ）へ集約
    const smallForL3: UserForGrouping[] = []
    for (const [, ioUsers] of smallForL2) {
      if (ioUsers.length >= minGroupSize) {
        clusters.push(ioUsers)
      } else {
        smallForL3.push(...ioUsers)
      }
    }

    // L3が minGroupSize 未満 → overflow（小さい同士でくっつける）
    if (smallForL3.length >= minGroupSize) {
      clusters.push(smallForL3)
    } else if (smallForL3.length > 0) {
      overflowClusters.push(smallForL3)
    }
  }

  // overflow: 小さいクラスタ同士を順に合流（少ない同士でくっつける）
  clusters.push(...pairSmallClusters(overflowClusters, minGroupSize))

  return clusters
}

/**
 * 小さいクラスタ同士を小さい順に合流させ、minGroupSize 以上になったら確定。
 * 最後に残った端数は直前のクラスタに吸収。
 */
function pairSmallClusters(
  small: UserForGrouping[][],
  minGroupSize: number,
): UserForGrouping[][] {
  if (small.length === 0) return []

  const sorted = [...small].sort((a, b) => a.length - b.length)
  const result: UserForGrouping[][] = []
  let current: UserForGrouping[] = []

  for (const cluster of sorted) {
    current.push(...cluster)
    if (current.length >= minGroupSize) {
      result.push(current)
      current = []
    }
  }

  if (current.length > 0) {
    if (result.length > 0) {
      result[result.length - 1].push(...current)
    } else {
      result.push(current) // 全員合わせても minGroupSize 未満の場合
    }
  }

  return result
}

// ── Step2: クラスタ内を targetGroupSize で分割 ───────────────────────

function splitCluster(
  users: UserForGrouping[],
  targetGroupSize: number,
): { groups: UserForGrouping[][], tgCounts: Map<string, number>[] } {
  const n = users.length
  const groupCount = Math.max(1, Math.floor(n / targetGroupSize))

  // グループサイズを均等に配分（例: 13人を2分割 → [7, 6]）
  const base = Math.floor(n / groupCount)
  const extra = n - base * groupCount
  const groupSizes = Array.from({ length: groupCount }, (_, i) => base + (i < extra ? 1 : 0))

  const groups: UserForGrouping[][] = Array.from({ length: groupCount }, () => [])
  const tgCounts: Map<string, number>[] = Array.from({ length: groupCount }, () => new Map())
  const deferred: UserForGrouping[] = []

  // 部署ラウンドロビン + TG制約
  const shuffled = [...users]
  shuffleArray(shuffled)

  const byDept = new Map<number, UserForGrouping[]>()
  for (const u of shuffled) {
    if (!byDept.has(u.department_id)) byDept.set(u.department_id, [])
    byDept.get(u.department_id)!.push(u)
  }
  for (const [deptId, members] of byDept) {
    byDept.set(deptId, interleaveTG(members))
  }
  const sortedDepts = Array.from(byDept.values()).sort((a, b) => b.length - a.length)

  let cursor = 0
  for (const deptMembers of sortedDepts) {
    for (const user of deptMembers) {
      const tgKey = user.training_group_id ?? '__none__'
      let placed = false

      for (let d = 0; d < groupCount; d++) {
        const g = (cursor + d) % groupCount
        if (groups[g].length < groupSizes[g] && !(tgCounts[g].get(tgKey) ?? 0)) {
          groups[g].push(user)
          tgCounts[g].set(tgKey, 1)
          cursor = (g + 1) % groupCount
          placed = true
          break
        }
      }

      if (!placed) deferred.push(user)
    }
  }

  for (const user of deferred) {
    const tgKey = user.training_group_id ?? '__none__'
    let placed = false
    for (let g = 0; g < groupCount; g++) {
      if (!(tgCounts[g].get(tgKey) ?? 0)) {
        groups[g].push(user)
        tgCounts[g].set(tgKey, (tgCounts[g].get(tgKey) ?? 0) + 1)
        placed = true
        break
      }
    }
    if (!placed) {
      // TG制約を満たせない → 最小グループへ強制配置
      const minIdx = groups.reduce((mi, g, i) => g.length < groups[mi].length ? i : mi, 0)
      groups[minIdx].push(user)
    }
  }

  return { groups, tgCounts }
}

// ── Step3: 部署多様性スコアを最小化するスワップ最適化（クラスタ内） ──

function swapOptimize(
  groups: UserForGrouping[][],
  tgCounts: Map<string, number>[],
): void {
  const groupCount = groups.length
  if (groupCount < 2) return

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
            if ((tgCounts[g1].get(tg2) ?? 0) > 0) continue
            if ((tgCounts[g2].get(tg1) ?? 0) > 0) continue

            const before = deptScore(groups[g1]) + deptScore(groups[g2])
            groups[g1][i] = u2
            groups[g2][j] = u1
            const after = deptScore(groups[g1]) + deptScore(groups[g2])
            groups[g1][i] = u1
            groups[g2][j] = u2

            const improvement = before - after
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
          tgCounts[g1].set(tg1, tgCounts[g1].get(tg1)! - 1)
          tgCounts[g1].set(tg2, (tgCounts[g1].get(tg2) ?? 0) + 1)
          tgCounts[bestG2].set(tg2, tgCounts[bestG2].get(tg2)! - 1)
          tgCounts[bestG2].set(tg1, (tgCounts[bestG2].get(tg1) ?? 0) + 1)
        }
      }
    }
  }
}

// ── ユーティリティ ─────────────────────────────────────────────────────

/** TGをインターリーブして同TGが連続しないよう並べ直す */
function interleaveTG(members: UserForGrouping[]): UserForGrouping[] {
  const byTG = new Map<string, UserForGrouping[]>()
  for (const u of members) {
    const key = u.training_group_id ?? '__none__'
    if (!byTG.has(key)) byTG.set(key, [])
    byTG.get(key)!.push(u)
  }
  const tgGroups = Array.from(byTG.values())
  const result: UserForGrouping[] = []
  const maxLen = Math.max(...tgGroups.map(g => g.length))
  for (let i = 0; i < maxLen; i++) {
    for (const tgMembers of tgGroups) {
      if (i < tgMembers.length) result.push(tgMembers[i])
    }
  }
  return result
}

/** 部署多様性スコア（低いほど多様） = 同一部署人数の二乗和 */
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
