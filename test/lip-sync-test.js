import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLipSyncEnvelope, sampleLipSyncEnvelope, getAudibleContextTime, createAudibleClock } from '../src/utils/lipSync.js'
import { makeAudioBuffer } from './helpers/audio.js'

test('首部静音不提前张嘴，起声渐开，真实停顿在 90ms 内收口', () => {
  const envelope = createLipSyncEnvelope(makeAudioBuffer())
  for (const time of [-1, 0, 0.08, 0.1, 0.6, 2.4, 10, NaN]) {
    assert.equal(sampleLipSyncEnvelope(envelope, time), 0, `time=${time}`)
  }
  for (const time of [0.2, 0.3, 0.49, 0.8, 2.3]) {
    assert.ok(sampleLipSyncEnvelope(envelope, time) > 0.4, `time=${time}`)
  }
  assert.ok(sampleLipSyncEnvelope(envelope, 0.12) < sampleLipSyncEnvelope(envelope, 0.16))
  assert.ok(sampleLipSyncEnvelope(envelope, 0.16) < sampleLipSyncEnvelope(envelope, 0.2))
  assert.ok(sampleLipSyncEnvelope(envelope, 0.5) > sampleLipSyncEnvelope(envelope, 0.54))
  assert.ok(sampleLipSyncEnvelope(envelope, 0.54) > sampleLipSyncEnvelope(envelope, 0.58))
})

test('口型按音量归一化，低音量仍能张嘴；全静音保持闭嘴', () => {
  const normal = createLipSyncEnvelope(makeAudioBuffer())
  const quiet = createLipSyncEnvelope(makeAudioBuffer(0.05))
  const silent = createLipSyncEnvelope(makeAudioBuffer(0))
  for (const time of [0.2, 0.4, 0.8, 1.5]) {
    assert.ok(Math.abs(sampleLipSyncEnvelope(normal, time) - sampleLipSyncEnvelope(quiet, time)) < 0.01)
    assert.equal(sampleLipSyncEnvelope(silent, time), 0)
  }
})

test('多声道分别计算能量，反相立体声不会被误判为静音', () => {
  const buffer = makeAudioBuffer()
  const left = buffer.getChannelData(0)
  const right = left.map((value) => -value)
  buffer.numberOfChannels = 2
  buffer.getChannelData = (channel) => channel === 0 ? left : right
  assert.ok(sampleLipSyncEnvelope(createLipSyncEnvelope(buffer), 0.2) > 0.4)
})

function bufferFromFrameLevels(levels) {
  const sampleRate = 8000, frameSize = 80
  const samples = Float32Array.from({ length: levels.length * frameSize }, (_, i) =>
    levels[Math.floor(i / frameSize)] * Math.sin(i * Math.PI / 4))
  return {
    sampleRate, length: samples.length, duration: samples.length / sampleRate,
    numberOfChannels: 1, getChannelData: () => samples,
  }
}

test('连读中反复出现的 10–60ms 低谷不再触发快速闭嘴，长停顿仍收口', () => {
  const raw = [...Array(10).fill(0), ...Array(30).fill(0.1)]
  for (const gap of [1, 2, 4, 6]) raw.push(...Array(gap).fill(0), ...Array(15).fill(0.1))
  const pauseAt = raw.length / 100
  raw.push(...Array(20).fill(0), ...Array(30).fill(0.1))
  const envelope = createLipSyncEnvelope(bufferFromFrameLevels(raw))
  for (let time = 0.25; time < pauseAt - 0.03; time += 1 / 120) {
    assert.ok(sampleLipSyncEnvelope(envelope, time) > 0.4, `time=${time}`)
  }
  assert.equal(sampleLipSyncEnvelope(envelope, pauseAt + 0.1), 0)
  assert.ok(sampleLipSyncEnvelope(envelope, pauseAt + 0.32) > 0.4)
})

test('孤立的 10ms 脉冲不引发嘴型闪烁', () => {
  const levels = [...Array(10).fill(0), 0.8, ...Array(20).fill(0)]
  const envelope = createLipSyncEnvelope(bufferFromFrameLevels(levels))
  assert.ok(envelope.levels.every((value) => value === 0))
})

test('门限附近抖动及音量尖峰不会让张口幅度逐帧大跳变', () => {
  const raw = [...Array(10).fill(0), ...Array(30).fill(0.1),
    ...Array.from({ length: 50 }, (_, i) => i % 2 ? 0.006 : 0.01),
    ...Array.from({ length: 50 }, (_, i) => i % 2 ? 0.02 : 0.15),
    ...Array(30).fill(0.1), ...Array(20).fill(0)]
  const envelope = createLipSyncEnvelope(bufferFromFrameLevels(raw))
  for (let time = 0.45; time < 0.85; time += 0.01) {
    assert.ok(sampleLipSyncEnvelope(envelope, time) > 0.05, `time=${time}`)
  }
  for (const fps of [30, 60, 120]) {
    let previous = 0
    for (let time = 0; time < envelope.duration; time += 1 / fps) {
      const value = sampleLipSyncEnvelope(envelope, time)
      assert.ok(value >= 0 && value <= 0.681, `幅度越界: ${value}`)
      assert.ok(Math.abs(value - previous) <= 11.5 / fps, `${fps}fps 突跳: ${previous} -> ${value}`)
      previous = value
    }
  }
})

test('单调三次插值无过冲、控制点速度连续，且采样不依赖前一帧进度', () => {
  const envelope = { levels: [0.2, 0.4, 0.1, 0], frameSeconds: 0.01, duration: 0.04 }
  assert.equal(sampleLipSyncEnvelope(envelope, 0), 0)
  assert.equal(sampleLipSyncEnvelope(envelope, 0.01), 0.2)
  assert.equal(sampleLipSyncEnvelope(envelope, 0.02), 0.4)
  for (let time = 0; time < 0.04; time += 0.0001) {
    const index = Math.floor(time / 0.01)
    const from = envelope.levels[index - 1] || 0, to = envelope.levels[index] || 0
    const value = sampleLipSyncEnvelope(envelope, time)
    assert.ok(value >= Math.min(from, to) - 1e-8 && value <= Math.max(from, to) + 1e-8)
  }
  for (const time of [0.01, 0.02, 0.03]) {
    const epsilon = 1e-7
    const center = sampleLipSyncEnvelope(envelope, time)
    const before = (center - sampleLipSyncEnvelope(envelope, time - epsilon)) / epsilon
    const after = (sampleLipSyncEnvelope(envelope, time + epsilon) - center) / epsilon
    assert.ok(Math.abs(before - after) < 0.01, `速度不连续: ${before} -> ${after}`)
  }
  const value = sampleLipSyncEnvelope(envelope, 0.015)
  sampleLipSyncEnvelope(envelope, 0.039)
  assert.equal(sampleLipSyncEnvelope(envelope, 0.015), value)
})

test('没有尾部静音时提前柔和收口，不在结束瞬间突然合嘴', () => {
  const envelope = createLipSyncEnvelope(makeAudioBuffer())
  let previous = sampleLipSyncEnvelope(envelope, 2.33)
  for (const time of [2.35, 2.37, 2.39, 2.4]) {
    const value = sampleLipSyncEnvelope(envelope, time)
    assert.ok(value < previous)
    previous = value
  }
  assert.ok(sampleLipSyncEnvelope(envelope, 2.39) < 0.05)
})

test('稳定元音的小幅能量波纹不再变成嘴部高频颤抖', () => {
  const raw = [...Array(40).fill(0.1),
    ...Array.from({ length: 100 }, (_, i) => 0.1 + Math.sin(i * Math.PI / 3) * 0.002),
    ...Array(20).fill(0)]
  const envelope = createLipSyncEnvelope(bufferFromFrameLevels(raw))
  const values = []
  for (let time = 0.8; time < 1.3; time += 1 / 120) values.push(sampleLipSyncEnvelope(envelope, time))
  assert.ok(Math.max(...values) - Math.min(...values) < 0.002)
})

test('输出时间戳小幅回跳不会导致播放时钟后退或猛跳', () => {
  let now = 1000, jitter = 0
  const ctx = {
    state: 'running', currentTime: 11,
    getOutputTimestamp: () => ({ contextTime: ctx.currentTime - 0.1 + jitter, performanceTime: now }),
  }
  const clock = createAudibleClock(ctx)
  let previous = clock(now)
  for (let i = 1; i <= 240; i++) {
    now = 1000 + i * 1000 / 120
    ctx.currentTime = 10 + now / 1000
    jitter = i % 2 ? -0.01 : 0.01
    const value = clock(now)
    assert.ok(value >= previous)
    assert.ok(value - previous < 0.012)
    assert.ok(Math.abs(value - (ctx.currentTime - 0.1)) < 0.012)
    previous = value
  }
})

test('时钟在暂停、恢复和后台返回时重新对齐，不累积暂停时长', () => {
  const ctx = { state: 'running', currentTime: 10, baseLatency: 0.1 }
  const clock = createAudibleClock(ctx)
  assert.equal(clock(1000), 9.9)
  ctx.state = 'suspended'
  assert.equal(clock(1100), 9.9)
  assert.equal(clock(5100), 9.9)
  ctx.state = 'running'
  ctx.currentTime = 10.01
  assert.equal(clock(5110), 9.91)
  // 暂停和恢复之间若没有绘制帧，也可显式复位时钟，避免将暂停时间算进播放。
  clock.reset()
  assert.equal(clock(5160), 9.91)
  ctx.currentTime = 15
  assert.equal(clock(10150), 14.9)
})

test('输出时间戳优先于渲染时间，并根据 performanceTime 外推', () => {
  const ctx = {
    currentTime: 10, baseLatency: 0.01, outputLatency: 0.03,
    getOutputTimestamp: () => ({ contextTime: 9.7, performanceTime: 1000 }),
  }
  assert.ok(Math.abs(getAudibleContextTime(ctx, 1050) - 9.75) < 1e-8)
  // 旧时间戳不能把口型推进到还未渲染的音频。
  assert.equal(getAudibleContextTime(ctx, 2000), 10)
})

test('没有有效输出时间戳时补偿 baseLatency/outputLatency', () => {
  const ctx = { currentTime: 10, baseLatency: 0.02, outputLatency: 0.08 }
  assert.equal(getAudibleContextTime(ctx, 0), 9.9)
  ctx.getOutputTimestamp = () => ({ contextTime: 0, performanceTime: 0 })
  assert.equal(getAudibleContextTime(ctx, 0), 9.9)
  assert.equal(getAudibleContextTime({ currentTime: 10 }, 0), 10)
})
