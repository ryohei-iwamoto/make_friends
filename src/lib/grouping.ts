import { GROUP_COLORS } from './colors'

interface UserForGrouping {
  id: string
  department_id: number
}

interface GroupAssignment {
  groupNumber: number
  color: string
  userIds: string[]
}

/**
 * グループ分けアルゴリズム
 * - 6人1組を基本とし、余りは近隣グループに分散
 * - 同じグループに同一事業部をなるべく入れない
 */
export function createGroups(users: UserForGrouping[], baseGroupSize = 6): GroupAssignment[] {
  const totalUsers = users.length
  const groupCount = Math.floor(totalUsers / baseGroupSize)
  const remainder = totalUsers % baseGroupSize

  // グループサイズ配列を計算（余りを均等分散）
  const groupSizes: number[] = Array(groupCount).fill(baseGroupSize)
  for (let i = 0; i < remainder; i++) {
    groupSizes[i % groupCount]++
  }

  // 事業部ごとにユーザーをシャッフル
  const shuffled = shuffleArray([...users])

  // 事業部でソート後に分散配置（同部署が固まらないように）
  const byDept = new Map<number, UserForGrouping[]>()
  for (const user of shuffled) {
    if (!byDept.has(user.department_id)) byDept.set(user.department_id, [])
    byDept.get(user.department_id)!.push(user)
  }

  // インターリーブ：各事業部から1人ずつ取り出して並べる
  const interleaved: UserForGrouping[] = []
  const deptQueues = Array.from(byDept.values()).sort((a, b) => b.length - a.length)
  let hasMore = true
  while (hasMore) {
    hasMore = false
    for (const queue of deptQueues) {
      if (queue.length > 0) {
        interleaved.push(queue.shift()!)
        hasMore = true
      }
    }
  }

  // グループに割り当て
  const assignments: GroupAssignment[] = []
  let userIndex = 0
  for (let g = 0; g < groupCount; g++) {
    const size = groupSizes[g]
    const userIds = interleaved.slice(userIndex, userIndex + size).map(u => u.id)
    assignments.push({
      groupNumber: g + 1,
      color: GROUP_COLORS[g % GROUP_COLORS.length],
      userIds,
    })
    userIndex += size
  }

  return assignments
}

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
