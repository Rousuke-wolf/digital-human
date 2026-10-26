export const ZOOM_MIN = 1
export const ZOOM_DEFAULT = 1.9
export const ZOOM_MAX = 2.6
export const ZOOM_STEP = 0.15

// zoom=1 完整显示人物；默认约显示上半身。使用同一个缩放值计算居中与顶部位置。
export function getModelLayout(bounds, width, height, zoom) {
  const padding = Math.min(16, height * 0.04)
  const fullScale = Math.min(
    Math.max(1, width - padding * 2) / bounds.width,
    Math.max(1, height - padding * 2) / bounds.height,
  )
  const scale = fullScale * zoom
  return {
    scale,
    x: width / 2 - (bounds.x + bounds.width / 2) * scale,
    y: padding - bounds.y * scale,
  }
}

// 原点在人物可见区域中心，不以页面中心为基准；距离越远逐渐趋向上限。
export function getPointerFocus(pointer, center, width, height) {
  if (!pointer) return { x: 0, y: 0 }
  return {
    x: Math.tanh((pointer.x - center.x) / Math.max(100, width * 0.65)),
    y: -Math.tanh((pointer.y - center.y) / Math.max(100, height * 0.65)),
  }
}
