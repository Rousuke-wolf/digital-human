// 从完整 PCM 构建口型曲线；所有缓动都在音频时间轴上完成，不累积 RAF 延迟。
const FRAME_SECONDS = 0.01
const MAX_MOUTH_OPEN = 0.68
const SHORT_GAP_SECONDS = 0.06 // 连读中的短暂低谷不反复闭嘴
const CLOSE_SECONDS = 0.09 // 真正停顿时，用 90ms 自然收口
const smoothstep = (value) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

export function createLipSyncEnvelope(buffer, { final = true } = {}) {
  const frameSize = Math.max(1, Math.round(buffer.sampleRate * FRAME_SECONDS))
  const levels = new Float32Array(Math.ceil(buffer.length / frameSize))
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel)
    for (let frame = 0; frame < levels.length; frame++) {
      const start = frame * frameSize
      const end = Math.min(samples.length, start + frameSize)
      let energy = 0
      for (let i = start; i < end; i++) energy += samples[i] * samples[i]
      // 分别计算声道能量，避免反相立体声相互抵消。
      levels[frame] = Math.max(levels[frame], Math.sqrt(energy / (end - start)))
    }
  }
  const frameSeconds = frameSize / buffer.sampleRate
  const voiced = Array.from(levels).filter((level) => level > 0.0001).sort((a, b) => a - b)
  const reference = voiced[Math.floor(voiced.length * 0.9)] || 1
  const openGate = Math.max(0.0001, reference * 0.06)
  const closeGate = Math.max(0.0001, reference * 0.03)
  let open = false
  const targets = levels.map((level) => {
    // 开、关使用不同阈值，避免声音在门限附近抖动时频繁切换嘴型。
    open = level > (open ? closeGate : openGate)
    return open ? Math.min(MAX_MOUTH_OPEN, Math.pow(level / reference, 0.6) * 0.58) : 0
  })

  // 抑制孤立的 <20ms 脉冲；不要让一个爆破音/噪点变成一次大幅张嘴。
  for (let i = 0; i < targets.length;) {
    if (!targets[i]) { i++; continue }
    const start = i
    while (i < targets.length && targets[i]) i++
    if ((i - start) * frameSeconds < 0.02) targets.fill(0, start, i)
  }
  // 仅填补两段语音之间的短空隙，首部静音和句间长停顿保持不动。
  for (let i = 0; i < targets.length;) {
    if (targets[i]) { i++; continue }
    const start = i
    while (i < targets.length && !targets[i]) i++
    if (start === 0 || i === targets.length || (i - start) * frameSeconds > SHORT_GAP_SECONDS) continue
    const left = targets[start - 1], right = targets[i]
    for (let j = start; j < i; j++) {
      targets[j] = left + (right - left) * (j - start + 1) / (i - start + 1)
    }
  }

  let smoothed = 0, silenceStart = -1, releaseFrom = 0, stableTarget = 0
  for (let i = 0; i < levels.length; i++) {
    if (targets[i]) {
      silenceStart = -1
      // 50ms 对称窗口抑制逐音频帧的尖峰；只在语音内应用，不提前张嘴。
      let total = 0, weights = 0
      for (let offset = -2; offset <= 2; offset++) {
        const index = i + offset
        if (index < 0 || index >= targets.length) continue
        const weight = 3 - Math.abs(offset)
        total += targets[index] * weight
        weights += weight
      }
      const target = total / weights
      // 吸收不足约 1% 开口幅度的来回反向，不把细小声波纹理变成下颌颤抖。
      const difference = target - stableTarget
      if (Math.abs(difference) > 0.012) stableTarget = target - Math.sign(difference) * 0.012
      const alpha = 1 - Math.exp(-frameSeconds / (stableTarget > smoothed ? 0.035 : 0.06))
      const change = (stableTarget - smoothed) * alpha
      // 限制张合速度；不会因为音频某一帧变响，就从闭嘴直接跳到最大。
      const maxChange = 6 * frameSeconds
      smoothed += Math.max(-maxChange, Math.min(maxChange, change))
    } else {
      stableTarget = 0
      if (silenceStart < 0) { silenceStart = i; releaseFrom = smoothed }
      smoothed = releaseFrom * (1 - smoothstep((i - silenceStart + 1) * frameSeconds / CLOSE_SECONDS))
    }
    // 流式中间块不能强制收口；只有整段的最后一块需要尾部缓动。
    const tail = final ? smoothstep((buffer.duration - (i + 1) * frameSeconds) / 0.06) : 1
    levels[i] = smoothed * tail
  }
  return { levels, frameSeconds, duration: buffer.duration }
}

export function sampleLipSyncEnvelope(envelope, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= envelope.duration) return 0
  // 单调三次插值：控制点处速度连续，消除线性插值每 10ms 换斜率的顿挫。
  // 相邻斜率反向时切线为 0，保证不过冲、不把静音插值成张嘴。
  const position = seconds / envelope.frameSeconds
  const index = Math.floor(position)
  const previous = envelope.levels[index - 2] || 0
  const from = envelope.levels[index - 1] || 0
  const to = envelope.levels[index] || 0
  const next = envelope.levels[index + 1] || 0
  const tangent = (a, b) => a * b > 0 ? 2 * a * b / (a + b) : 0
  const slopeFrom = tangent(from - previous, to - from)
  const slopeTo = tangent(to - from, next - to)
  const t = position - index, t2 = t * t, t3 = t2 * t
  return (2 * t3 - 3 * t2 + 1) * from + (t3 - 2 * t2 + t) * slopeFrom
    + (-2 * t3 + 3 * t2) * to + (t3 - t2) * slopeTo
}

// 每次播报独立的输出时钟：抑制时间戳小幅回跳，暂停/恢复或后台返回时重新对齐。
// 这里只修正时钟测量噪声，不再对渲染出的嘴型叠加延迟。
export function createAudibleClock(ctx) {
  let lastNow = null, lastTime = 0, lastState = ctx.state
  const read = (now = performance.now()) => {
    const raw = getAudibleContextTime(ctx, now)
    const dt = lastNow === null ? 0 : Math.max(0, (now - lastNow) / 1000)
    const predicted = lastTime + dt
    let time = raw
    if (lastNow !== null && ctx.state === 'running' && lastState === 'running') {
      if (dt < 0.25 && Math.abs(raw - predicted) < 0.08) {
        time = predicted + (raw - predicted) * (1 - Math.exp(-dt / 0.08))
      }
      time = Math.max(lastTime, Math.min(ctx.currentTime, time))
    }
    lastNow = now
    lastTime = time
    lastState = ctx.state
    return time
  }
  read.reset = () => { lastNow = null; lastState = ctx.state }
  return read
}

// currentTime 是渲染时钟，不是扬声器时钟。优先用浏览器提供的输出时间戳，
// 不支持时减去音频管线延迟；蓝牙/声卡的实际延迟以浏览器报告值为准。
export function getAudibleContextTime(ctx, now = performance.now()) {
  const stamp = ctx.getOutputTimestamp?.()
  if (stamp && stamp.contextTime > 0 && stamp.performanceTime > 0) {
    const elapsed = Math.max(0, (now - stamp.performanceTime) / 1000)
    return Math.min(ctx.currentTime, stamp.contextTime + elapsed)
  }
  return ctx.currentTime - (ctx.baseLatency || 0) - (ctx.outputLatency || 0)
}
