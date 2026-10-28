// 临界阻尼跟随：保持速度连续，按真实时间推进；不随屏幕刷新率改变动作快慢。
export function createFocusMotion() {
  const axes = {
    x: { value: 0, velocity: 0, target: 0 },
    y: { value: 0, velocity: 0, target: 0 },
  }
  let lastNow = null
  return (target, now = performance.now()) => {
    const elapsed = lastNow === null ? 0 : Math.max(0, (now - lastNow) / 1000)
    lastNow = now
    const dt = Math.min(0.05, elapsed)
    const omega = 20
    const decay = Math.exp(-omega * dt)
    for (const key of ['x', 'y']) {
      const axis = axes[key]
      const next = Math.max(-1, Math.min(1, target[key]))
      // 忽略亚像素鼠标噪声；离开人物时仍能完整归中。
      if (next === 0 || Math.abs(next - axis.target) > 0.006) axis.target = next
      if (elapsed > 0.25) axis.velocity = 0 // 后台返回不追赶积攒的惯性
      const offset = axis.value - axis.target
      const impulse = axis.velocity + omega * offset
      axis.value = axis.target + (offset + impulse * dt) * decay
      axis.velocity = (axis.velocity - omega * impulse * dt) * decay
      if (Math.abs(axis.value - axis.target) < 0.0001 && Math.abs(axis.velocity) < 0.001) {
        axis.value = axis.target
        axis.velocity = 0
      }
    }
    return { x: axes.x.value, y: axes.y.value }
  }
}
