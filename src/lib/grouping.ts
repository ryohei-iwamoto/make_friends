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
 * targetGroupSize: 目安の人数（グループ数・シールのタイミングを決定）
 * minGroupSize:    最低人数（これを下回るグループは前のグループに吸収）
 *
 * [クラスタリングOFF]
 *   部署の人数順ラウンドロビン + TG制約。グループ数は targetGroupSize で均等割り。
 *   最終的に minGroupSize 未満のグループは前のグループに吸収。
 *
 * [クラスタリングON（location/hobby いずれか or 両方）]
 *   Phase1: クラスタ優先の初期割り当て
 *     クラスタキー = (勤務地エリア × hobby_indoor_outdoor) のうち有効な軸のみ使用。
 *     両方ONのとき: クラスタが3人以下 → 勤務地のみにマージ → それも3人以下 → 'global'
 *     どちらか片方: クラスタが3人以下 → 'global' にマージ
 *     クラスタ境界で人数 ≥ targetGroupSize になったらグループ確定。
 *     最終的に minGroupSize 未満のグループは前のグループに吸収。
 *     TG制約（同研修グループは同グループ不可）はハード制約。
 *
 *   Phase2: 部署多様性スコアを最小化するスワップ最適化（10パス）
 *     TG制約を守りながらスコアが下がるスワップのみ採用。
 */
export function createGroups(
  users: UserForGrouping[],
  targetGroupSize = 6,
  minGroupSize = 4,
  options: GroupingOptions = {},
): GroupAssignment[] {
  if (users.length === 0) return []

  const { useLocationGrouping = false, useHobbyGrouping = false } = options

  if (!useLocationGrouping && !useHobbyGrouping) {
    return createGroupsByDept(users, targetGroupSize, minGroupSize)
  }

  return createGroupsByCluster(users, targetGroupSize, minGroupSize, useLocationGrouping, useHobbyGrouping)
}

// ── 非クラスタリングモード: 部署の人数順ラウンドロビン ──────────────

function createGroupsByDept(users: UserForGrouping[], targetGroupSize: number, minGroupSize: number): GroupAssignment[] {
  const totalUsers = users.length
  const groupCount = Math.max(1, Math.floor(totalUsers / targetGroupSize))
  const remainder = totalUsers % targetGroupSize

  const groupSizes: number[] = Array(groupCount).fill(targetGroupSize)
  for (let i = 0; i < remainder; i++) groupSizes[i % groupCount]++

  const groups: UserForGrouping[][] = Array.from({ length: groupCount }, () => [])
  const tgCountInGroup: Map<string, number>[] = Array.from({ length: groupCount }, () => new Map())
  const deferred: UserForGrouping[] = []

  const byDept = new Map<number, UserForGrouping[]>()
  for (const u of users) {
    if (!byDept.has(u.department_id)) byDept.set(u.department_id, [])
    byDept.get(u.department_id)!.push(u)
  }
  for (const [deptId, members] of byDept) {
    shuffleArray(members)
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

  // minGroupSize 未満のグループを前のグループに吸収
  mergeSmallGroups(groups, tgCountInGroup, minGroupSize)

  return applySwapOptimization(groups, tgCountInGroup)
}

// ── クラスタリングモード ──────────────────────────────────────────────

function createGroupsByCluster(
  users: UserForGrouping[],
  targetGroupSize: number,
  minGroupSize: number,
  useLocation: boolean,
  useHobby: boolean,
): GroupAssignment[] {
  // クラスタキーのカウント（フォールバック判定用）
  const primaryCount = new Map<string, number>()
  const locationCount = new Map<string, number>()

  for (const u of users) {
    const loc = useLocation ? getLocationRegion(u.work_location) : 'all'
    const field = useHobby ? (u.hobby_indoor_outdoor ?? 'unknown') : 'all'
    const pk = `${loc}|${field}`
    primaryCount.set(pk, (primaryCount.get(pk) ?? 0) + 1)
    if (useLocation) locationCount.set(loc, (locationCount.get(loc) ?? 0) + 1)
  }

  const getClusterKey = (u: UserForGrouping): string => {
    const loc = useLocation ? getLocationRegion(u.work_location) : 'all'
    const field = useHobby ? (u.hobby_indoor_outdoor ?? 'unknown') : 'all'
    const pk = `${loc}|${field}`

    if (useLocation && useHobby) {
      // 両方ON: primary → location-only → global
      if ((primaryCount.get(pk) ?? 0) > 3) return pk
      if ((locationCount.get(loc) ?? 0) > 3) return `${loc}|any`
      return 'global'
    }

    // 片方のみ: primary → global
    if ((primaryCount.get(pk) ?? 0) > 3) return pk
    return 'global'
  }

  // バケット作成
  const bucketMap = new Map<string, UserForGrouping[]>()
  for (const u of users) {
    const key = getClusterKey(u)
    if (!bucketMap.has(key)) bucketMap.set(key, [])
    bucketMap.get(key)!.push(u)
  }

  // バケット内でTGをインターリーブ
  for (const [bKey, members] of bucketMap) {
    shuffleArray(members)
    bucketMap.set(bKey, interleaveTG(members))
  }

  // 大きいバケットから処理
  const sortedBuckets = Array.from(bucketMap.values()).sort((a, b) => b.length - a.length)

  const groups: UserForGrouping[][] = [[]]
  const tgCountInGroup: Map<string, number>[] = [new Map()]
  const deferred: UserForGrouping[] = []

  for (const bucket of sortedBuckets) {
    const currentIdx = groups.length - 1

    for (const user of bucket) {
      const tgKey = user.training_group_id ?? '__none__'
      let placed = false

      if (!(tgCountInGroup[currentIdx].get(tgKey) ?? 0)) {
        groups[currentIdx].push(user)
        tgCountInGroup[currentIdx].set(tgKey, 1)
        placed = true
      }

      if (!placed) {
        for (let g = 0; g < currentIdx; g++) {
          if (!(tgCountInGroup[g].get(tgKey) ?? 0)) {
            groups[g].push(user)
            tgCountInGroup[g].set(tgKey, (tgCountInGroup[g].get(tgKey) ?? 0) + 1)
            placed = true
            break
          }
        }
      }

      if (!placed) deferred.push(user)
    }

    // バケット完了: targetGroupSize 以上ならシール
    if (groups[groups.length - 1].length >= targetGroupSize) {
      groups.push([])
      tgCountInGroup.push(new Map())
    }
  }

  // 後回しユーザー配置
  for (const user of deferred) {
    const tgKey = user.training_group_id ?? '__none__'
    let placed = false
    for (let g = 0; g < groups.length; g++) {
      if (!(tgCountInGroup[g].get(tgKey) ?? 0)) {
        groups[g].push(user)
        tgCountInGroup[g].set(tgKey, (tgCountInGroup[g].get(tgKey) ?? 0) + 1)
        placed = true
        break
      }
    }
    if (!placed) {
      const minIdx = groups.reduce((mi, g, i) => g.length < groups[mi].length ? i : mi, 0)
      groups[minIdx].push(user)
    }
  }

  // 末尾の空グループを削除
  if (groups[groups.length - 1].length === 0) {
    groups.pop()
    tgCountInGroup.pop()
  }

  // minGroupSize 未満のグループを前のグループに吸収
  mergeSmallGroups(groups, tgCountInGroup, minGroupSize)

  return applySwapOptimization(groups, tgCountInGroup)
}

// ── Phase 2: 部署多様性スコアを最小化するスワップ最適化 ──────────────

function applySwapOptimization(
  groups: UserForGrouping[][],
  tgCountInGroup: Map<string, number>[],
): GroupAssignment[] {
  const groupCount = groups.length

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

// ── ユーティリティ ─────────────────────────────────────────────────────

/** minGroupSize 未満のグループを末尾から順に前のグループに吸収する */
function mergeSmallGroups(
  groups: UserForGrouping[][],
  tgCountInGroup: Map<string, number>[],
  minGroupSize: number,
): void {
  let i = groups.length - 1
  while (i > 0 && groups[i].length < minGroupSize) {
    const small = groups.splice(i, 1)[0]
    const tgSmall = tgCountInGroup.splice(i, 1)[0]
    const targetIdx = i - 1
    for (const u of small) {
      groups[targetIdx].push(u)
      const tgKey = u.training_group_id ?? '__none__'
      tgCountInGroup[targetIdx].set(tgKey, (tgCountInGroup[targetIdx].get(tgKey) ?? 0) + 1)
    }
    void tgSmall
    i--
  }
}

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
