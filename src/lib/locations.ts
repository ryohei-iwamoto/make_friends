export const WORK_LOCATIONS = [
  '東京都',
  '神奈川県',
  '千葉県',
  '埼玉県',
  '北海道',
  '宮城県',
  '静岡県',
  '愛知県',
  '大阪府',
  '広島県',
  '福岡県',
  '佐賀県',
  'その他',
] as const

export type WorkLocation = typeof WORK_LOCATIONS[number]

export const LOCATION_REGIONS: Record<string, string> = {
  '東京都': '東京',
  '神奈川県': '関東',
  '千葉県': '関東',
  '埼玉県': '関東',
  '北海道': '北海道・東北',
  '宮城県': '北海道・東北',
  '静岡県': '東海・北陸',
  '愛知県': '東海・北陸',
  '大阪府': '関西・中国・九州',
  '広島県': '関西・中国・九州',
  '福岡県': '関西・中国・九州',
  '佐賀県': '関西・中国・九州',
  'その他': 'その他',
}

export function getLocationRegion(location: string | null | undefined): string {
  if (!location) return 'その他'
  return LOCATION_REGIONS[location] ?? 'その他'
}
