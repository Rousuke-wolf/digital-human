import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createStreamingLipSync } from '../src/utils/streamingLipSync.js'

function tone(duration, level = 0.1, sampleRate = 8000) {
  const samples = Float32Array.from({ length: Math.round(sampleRate * duration) }, (_, i) =>
    level * Math.sin(i * Math.PI / 4))
  return {
    sampleRate, length: samples.length, duration: samples.length / sampleRate,
    numberOfChannels: 1, getChannelData: () => samples,
  }
}

test('流式连读跨块保持张口，不在每个 MP3 块结束时强制收口再张开', () => {
  const lips = createStreamingLipSync()
  lips.append(tone(0.3), 10)
  assert.equal(lips.sample(9.99), 0)
  assert.ok(lips.sample(10.2) > 0.4)
  const before = lips.sample(10.299)
  lips.append(tone(0.4), 10.3)
  const after = lips.sample(10.301)
  assert.ok(before > 0.4 && after > 0.4)
  assert.ok(Math.abs(before - after) < 0.02)
  lips.end()
  assert.ok(lips.sample(10.65) > lips.sample(10.69))
  assert.equal(lips.sample(10.71), 0)
})

test('相邻块音量差异大时仍从已播出的尾值连续过渡，22.05kHz 非整帧边界也不跳变', () => {
  for (const [left, right] of [[0.1, 0.5], [0.5, 0.1], [0.01, 0.8]]) {
    const lips = createStreamingLipSync()
    const first = tone(0.31, left, 22050)
    const edge = 10 + first.duration
    lips.append(first, 10)
    const before = lips.sample(edge - 1e-6)
    lips.append(tone(0.4, right, 22050), edge)
    assert.ok(Math.abs(lips.sample(edge) - before) < 0.001, `${left} → ${right}`)
    let previous = before
    for (let time = edge; time < edge + 0.2; time += 1 / 60) {
      const amplitude = lips.sample(time)
      assert.ok(amplitude >= 0 && amplitude <= 0.68)
      assert.ok(Math.abs(amplitude - previous) < 0.12, `${left} → ${right}, time=${time}`)
      previous = amplitude
    }
  }
})

test('短块连续过渡不依赖渲染次数，最后不足 90ms 的块也能柔和收口', () => {
  const create = () => {
    const lips = createStreamingLipSync()
    lips.append(tone(0.3), 0)
    lips.append(tone(0.04, 0.5), 0.3)
    lips.append(tone(0.04, 0.1), 0.34)
    lips.end()
    return lips
  }
  const sparse = create(), dense = create()
  assert.equal(sparse.sample(NaN), 0)
  assert.equal(sparse.sample(Infinity), 0, '无效时钟不能丢弃排队口型')
  for (let time = 0; time < 0.35; time += 1 / 120) dense.sample(time)
  const before = sparse.sample(0.339999)
  assert.ok(Math.abs(sparse.sample(0.34) - before) < 0.001, 'EOF 淡出应跨越最后一个短块的边界')
  assert.equal(sparse.sample(0.35), dense.sample(0.35))
  assert.ok(sparse.sample(0.35) > 0)
  assert.ok(sparse.sample(0.379) < 0.002)
  assert.equal(sparse.sample(0.381), 0)
})

test('流式欠载期间闭嘴，新块不沿用空档前的开口状态', () => {
  const lips = createStreamingLipSync()
  lips.append(tone(0.3), 0)
  assert.ok(lips.sample(0.2) > 0.4)
  assert.equal(lips.sample(0.4), 0)
  lips.append(tone(0.3), 0.6)
  assert.equal(lips.sample(0.59), 0)
  assert.equal(lips.sample(0.6), 0)
  assert.ok(lips.sample(0.75) > 0.4)
})

test('连续的真实静音块保持闭嘴，不因连接上下文而提前张嘴', () => {
  const lips = createStreamingLipSync()
  lips.append(tone(0.3), 0)
  lips.append(tone(0.3, 0), 0.3)
  lips.append(tone(0.3), 0.6)
  assert.equal(lips.sample(0.45), 0)
  assert.equal(lips.sample(0.59), 0)
  assert.ok(lips.sample(0.75) > 0.4)
})
