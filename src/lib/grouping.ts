import { GROUP_COLORS } from './colors'

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
  useLocationDiversify?: boolean
}

/**
 * グループ分けアルゴリズム
 *
 * [location OFF / hobby OFF]
 *   - 同じ研修グループは絶対被らせない（strictTG）
 *   - なるべく違う事業部
 *
 * [location ON / hobby OFF]
 *   - 絶対同じ勤務地でまとめる
 *   - なるべく違う事業部
 *   - 同じ研修グループは極力被らせない
 *
 * [location ON / hobby ON]
 *   - 絶対同じ勤務地でまとめる
 *   - 趣味4分割→2分割→なしの順でカスケード
 *   - なるべく違う事業部
 *   - 同じ研修グループは極力被らせない
 *
 * グループ数は ceil(n/target) ベースで、最低人数を保証できるまで削減。
 * 最低人数を下回るクラスタは他の小クラスタと合流させる。
 */
export function createGroups(
  users: UserForGrouping[],
  targetGroupSize = 6,
  minGroupSize = 4,
  options: GroupingOptions = {},
): GroupAssignment[] {
  if (users.length === 0) return []

  const { useLocationGrouping = false, useHobbyGrouping = false, useLocationDiversify = false } = options
  // diversify が ON のときは location クラスタリングをしない
  const effectiveLocationGrouping = useLocationGrouping && !useLocationDiversify
  // location OFF → TGは絶対被らせない / location ON → 極力被らせない
  const strictTG = !effectiveLocationGrouping

  const clusters = buildClusters(users, effectiveLocationGrouping, useHobbyGrouping, minGroupSize)

  const allGroups: UserForGrouping[][] = []
  for (const cluster of clusters) {
    const { groups, tgCounts } = splitCluster(cluster, targetGroupSize, minGroupSize, strictTG, useLocationDiversify)
    swapOptimize(groups, tgCounts, useLocationDiversify)
    allGroups.push(...groups)
  }

  // 後処理: min未満グループ同士をくっつける（小さい同士を優先的にマージ）
  const finalGroups = mergeSmallGroups(allGroups, minGroupSize)

  return finalGroups.map((members, g) => ({
    groupNumber: g + 1,
    color: GROUP_COLORS[g % GROUP_COLORS.length],
    userIds: members.map(u => u.id),
  }))
}

// ── Step1: クラスタ確定 ───────────────────────────────────────────────

function buildClusters(
  users: UserForGrouping[],
  useLocation: boolean,
  useHobby: boolean,
  minGroupSize: number,
): UserForGrouping[][] {
  if (!useLocation && !useHobby) return [users]

  const byLoc = new Map<string, UserForGrouping[]>()
  for (const u of users) {
    // 都道府県単位でクラスタ化（リージョンにまとめない）
    const loc = useLocation ? (u.work_location ?? 'その他') : 'all'
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

    // L1が minGroupSize 未満 → L2（indoor/outdoor のみ）へ集約
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

    // L3が minGroupSize 未満 → overflow
    if (smallForL3.length >= minGroupSize) {
      clusters.push(smallForL3)
    } else if (smallForL3.length > 0) {
      overflowClusters.push(smallForL3)
    }
  }

  // overflow: 同じく小さい同士でまとめる（勤務地クラスタには吸収させない）
  clusters.push(...pairSmallClusters(overflowClusters, minGroupSize))

  return clusters
}

/**
 * 小さいクラスタ同士を小さい順に合流させ、minGroupSize 以上になったら確定。
 * 最後の端数は直前クラスタに吸収（全員合わせてもmin未満なら1グループ）。
 */
/**
 * 後処理: min未満のグループ同士を小さい順にくっつける。
 * 小さい同士を優先してマージし、それでも残ったものは最小の有効グループに吸収する。
 */
function mergeSmallGroups(
  allGroups: UserForGrouping[][],
  minGroupSize: number,
): UserForGrouping[][] {
  const valid: UserForGrouping[][] = []
  const small: UserForGrouping[][] = []

  for (const g of allGroups) {
    if (g.length >= minGroupSize) valid.push(g)
    else small.push(g)
  }

  if (small.length === 0) return allGroups

  // 小さい順に並べて順番にくっつけていく
  small.sort((a, b) => a.length - b.length)
  const merged: UserForGrouping[][] = []
  let current: UserForGrouping[] = []

  for (const g of small) {
    current.push(...g)
    if (current.length >= minGroupSize) {
      merged.push(current)
      current = []
    }
  }

  if (current.length > 0) {
    if (merged.length > 0) {
      // 最も小さいマージ済みグループに吸収
      merged.sort((a, b) => a.length - b.length)
      merged[0].push(...current)
    } else if (valid.length > 0) {
      // マージ相手がいない → 最も小さい有効グループに吸収
      valid.sort((a, b) => a.length - b.length)
      valid[0].push(...current)
    } else {
      merged.push(current)
    }
  }

  return [...valid, ...merged]
}

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
      result.push(current) // 全員合わせてもminGroupSize未満の場合
    }
  }

  return result
}

// ── Step2: クラスタ内を targetGroupSize で分割 ───────────────────────

/**
 * クラスタをグループに分割する。
 *
 * groupCount = ceil(n / targetGroupSize) をベースに、
 * floor(n / groupCount) >= minGroupSize になるまで減らす。
 * これにより全グループが最低人数を確保しつつ、target人数に近いグループを作る。
 *
 * strictTG=true（location OFF）: 同一TGは絶対同グループに入れない。
 *   不可能な場合はTG重複が最小になるグループへ強制配置。
 * strictTG=false（location ON）: 極力同一TGを避けるが、サイズ優先で妥協。
 */
function splitCluster(
  users: UserForGrouping[],
  targetGroupSize: number,
  minGroupSize: number,
  strictTG: boolean,
  useLocationDiversify = false,
): { groups: UserForGrouping[][], tgCounts: Map<string, number>[] } {
  const n = users.length

  // round ベースでグループ数決定（target人数に最も近くなるように）
  // n=7, target=6 → round(1.17)=1 → 7人1グループ（3/4に割らない）
  // n=10, target=6 → round(1.67)=2 → [5,5]
  // その後、最低人数を確保できないなら1つ減らしていく
  let groupCount = Math.max(1, Math.round(n / targetGroupSize))
  while (groupCount > 1 && Math.floor(n / groupCount) < minGroupSize) {
    groupCount--
  }

  // グループサイズを均等配分（extra個は base+1、残りはbase）
  const base = Math.floor(n / groupCount)
  const extra = n - base * groupCount
  const groupSizes = Array.from({ length: groupCount }, (_, i) => base + (i < extra ? 1 : 0))

  const groups: UserForGrouping[][] = Array.from({ length: groupCount }, () => [])
  const tgCounts: Map<string, number>[] = Array.from({ length: groupCount }, () => new Map())

  // 部署ラウンドロビン順に並べる（大きい部署から、同部署内はTGをインターリーブ）
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

  // ラウンドロビンで全ユーザーを並べる
  const ordered: UserForGrouping[] = []
  const maxLen = Math.max(...sortedDepts.map(d => d.length), 0)
  for (let i = 0; i < maxLen; i++) {
    for (const deptMembers of sortedDepts) {
      if (i < deptMembers.length) ordered.push(deptMembers[i])
    }
  }

  // Pass 1: サイズ制約 + TG制約を両方満たすグループへ配置
  const deferred: UserForGrouping[] = []
  let cursor = 0
  for (const user of ordered) {
    const tgKey = user.training_group_id ?? '__none__'
    let placed = false

    for (let d = 0; d < groupCount; d++) {
      const g = (cursor + d) % groupCount
      if (groups[g].length < groupSizes[g] && (tgCounts[g].get(tgKey) ?? 0) === 0) {
        groups[g].push(user)
        tgCounts[g].set(tgKey, 1)
        cursor = (g + 1) % groupCount
        placed = true
        break
      }
    }

    if (!placed) deferred.push(user)
  }

  // Pass 2: サイズ制約なし、TG制約あり（部署多様性が最良のグループへ）
  const stillDeferred: UserForGrouping[] = []
  for (const user of deferred) {
    const tgKey = user.training_group_id ?? '__none__'
    let bestG = -1
    let bestScore = Infinity

    for (let g = 0; g < groupCount; g++) {
      if ((tgCounts[g].get(tgKey) ?? 0) === 0) {
        const score = combinedScore([...groups[g], user], useLocationDiversify)
        if (score < bestScore) {
          bestScore = score
          bestG = g
        }
      }
    }

    if (bestG >= 0) {
      groups[bestG].push(user)
      tgCounts[bestG].set(tgKey, (tgCounts[bestG].get(tgKey) ?? 0) + 1)
    } else {
      stillDeferred.push(user)
    }
  }

  // Pass 3: TG制約を満たせない場合の強制配置
  // strictTG: TG重複が最少のグループへ（次点で部署多様性）
  // softTG:   最小サイズのグループへ（次点でTG重複が少ない方）
  for (const user of stillDeferred) {
    const tgKey = user.training_group_id ?? '__none__'
    let bestG = 0

    if (strictTG) {
      let bestTGCount = Infinity
      let bestDeptScore = Infinity
      for (let g = 0; g < groupCount; g++) {
        const tgCount = tgCounts[g].get(tgKey) ?? 0
        const score = deptScore([...groups[g], user])
        if (tgCount < bestTGCount || (tgCount === bestTGCount && score < bestDeptScore)) {
          bestTGCount = tgCount
          bestDeptScore = score
          bestG = g
        }
      }
    } else {
      let bestSize = Infinity
      let bestTGCount = Infinity
      for (let g = 0; g < groupCount; g++) {
        const size = groups[g].length
        const tgCount = tgCounts[g].get(tgKey) ?? 0
        if (size < bestSize || (size === bestSize && tgCount < bestTGCount)) {
          bestSize = size
          bestTGCount = tgCount
          bestG = g
        }
      }
    }

    groups[bestG].push(user)
    tgCounts[bestG].set(tgKey, (tgCounts[bestG].get(tgKey) ?? 0) + 1)
  }

  return { groups, tgCounts }
}

// ── Step3: 部署多様性スコアを最小化するスワップ最適化（クラスタ内） ──

function swapOptimize(
  groups: UserForGrouping[][],
  tgCounts: Map<string, number>[],
  useLocationDiversify = false,
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

            // 同一TGスワップはno-op
            if (tg1 === tg2) continue
            // スワップ後にTG重複が生じないかチェック
            // g1: tg1を出してtg2を入れる → g1にtg2が既にいたらNG
            if ((tgCounts[g1].get(tg2) ?? 0) > 0) continue
            // g2: tg2を出してtg1を入れる → g2にtg1が既にいたらNG
            if ((tgCounts[g2].get(tg1) ?? 0) > 0) continue

            const before = combinedScore(groups[g1], useLocationDiversify) + combinedScore(groups[g2], useLocationDiversify)
            groups[g1][i] = u2
            groups[g2][j] = u1
            const after = combinedScore(groups[g1], useLocationDiversify) + combinedScore(groups[g2], useLocationDiversify)
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
          tgCounts[g1].set(tg1, Math.max(0, (tgCounts[g1].get(tg1) ?? 0) - 1))
          tgCounts[g1].set(tg2, (tgCounts[g1].get(tg2) ?? 0) + 1)
          tgCounts[bestG2].set(tg2, Math.max(0, (tgCounts[bestG2].get(tg2) ?? 0) - 1))
          tgCounts[bestG2].set(tg1, (tgCounts[bestG2].get(tg1) ?? 0) + 1)
        }
      }
    }
  }
}

// ── ユーティリティ ─────────────────────────────────────────────────────

/** 同一TGが連続しないようインターリーブ */
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

/** 勤務地多様性スコア（低いほど多様） = 同一勤務地人数の二乗和 */
function locationScore(members: UserForGrouping[]): number {
  const counts = new Map<string, number>()
  for (const m of members) {
    const loc = m.work_location ?? 'その他'
    counts.set(loc, (counts.get(loc) ?? 0) + 1)
  }
  let score = 0
  for (const c of counts.values()) score += c * c
  return score
}

/** 部署 + 勤務地の複合スコア */
function combinedScore(members: UserForGrouping[], useLocationDiversify: boolean): number {
  return deptScore(members) + (useLocationDiversify ? locationScore(members) : 0)
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
