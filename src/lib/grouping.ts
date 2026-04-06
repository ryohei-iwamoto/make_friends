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
 * - N人1組を基本とし、余りは先頭グループから +1 人ずつ分散
 * - 研修グループIDが同じ人は同じグループにならないよう優先（インターリーブ）
 * - 同一事業部もなるべく分散（研修グループ内でさらに事業部でインターリーブ）
 * - 実行のたびにランダムが変わる（各バケット内でシャッフル）
 */
export function createGroups(users: UserForGrouping[], baseGroupSize = 6): GroupAssignment[] {
  const totalUsers = users.length
  const groupCount = Math.floor(totalUsers / baseGroupSize)
  const remainder = totalUsers % baseGroupSize

  // グループサイズ配列（余りを均等分散）
  const groupSizes: number[] = Array(groupCount).fill(baseGroupSize)
  for (let i = 0; i < remainder; i++) {
    groupSizes[i % groupCount]++
  }

  // 研修グループIDでバケットに分ける
  const byTrainingGroup = new Map<string, UserForGrouping[]>()
  for (const user of users) {
    const key = user.training_group_id ?? '__none__'
    if (!byTrainingGroup.has(key)) byTrainingGroup.set(key, [])
    byTrainingGroup.get(key)!.push(user)
  }

  // 各バケット内で事業部インターリーブ（同一事業部が固まらないように）
  // かつバケット内はシャッフルして毎回ランダムに
  const trainingQueues: UserForGrouping[][] = []
  for (const members of byTrainingGroup.values()) {
    trainingQueues.push(interdepartmentInterleave(shuffleArray([...members])))
  }

  // バケット自体もシャッフル（ランダム性を確保）
  shuffleArray(trainingQueues)

  // 研修グループIDをまたいでインターリーブ（同じ研修グループが1グループに入らないように）
  const interleaved: UserForGrouping[] = []
  // 人数が多い順に並べてから交互取り出し（偏りを減らす）
  trainingQueues.sort((a, b) => b.length - a.length)
  let hasMore = true
  while (hasMore) {
    hasMore = false
    for (const queue of trainingQueues) {
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

/** 事業部ごとにインターリーブして同一事業部が固まらないように並べる */
function interdepartmentInterleave(users: UserForGrouping[]): UserForGrouping[] {
  const byDept = new Map<number, UserForGrouping[]>()
  for (const user of users) {
    if (!byDept.has(user.department_id)) byDept.set(user.department_id, [])
    byDept.get(user.department_id)!.push(user)
  }
  const queues = Array.from(byDept.values()).sort((a, b) => b.length - a.length)
  const result: UserForGrouping[] = []
  let hasMore = true
  while (hasMore) {
    hasMore = false
    for (const queue of queues) {
      if (queue.length > 0) {
        result.push(queue.shift()!)
        hasMore = true
      }
    }
  }
  return result
}

function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
