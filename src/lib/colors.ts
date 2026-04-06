// 116チーム分の視覚的に区別しやすいカラー（黄金角を使ったHSL生成）
// 文字が読みやすいよう、背景色は明るめ・テキストは暗色で対応

export function generateGroupColors(count: number): string[] {
  const colors: string[] = []
  const goldenAngle = 137.508

  for (let i = 0; i < count; i++) {
    const hue = (i * goldenAngle) % 360
    // 彩度65-85%、明度45-65%で視認性を確保
    const saturation = 65 + (i % 3) * 10  // 65, 75, 85
    const lightness = 45 + (i % 4) * 5    // 45, 50, 55, 60
    colors.push(`hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`)
  }

  return colors
}

export const GROUP_COLORS = generateGroupColors(120)

// 背景色に対して読みやすいテキストカラーを返す
export function getTextColor(hslColor: string): string {
  const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (!match) return '#000000'
  const lightness = parseInt(match[3])
  return lightness > 55 ? '#1a1a1a' : '#ffffff'
}
