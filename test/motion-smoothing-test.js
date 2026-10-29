import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFocusMotion } from '../src/utils/motionSmoothing.js'

test('头部跟随在 30/60/120Hz 下具有一致的时序，不随帧率加速', () => {
  const results = [30, 60, 120].map((fps) => {
    const follow = createFocusMotion()
    follow({ x: 1, y: -0.6 }, 0)
    let value
    for (let i = 1; i <= fps / 5; i++) value = follow({ x: 1, y: -0.6 }, i * 1000 / fps)
    return value
  })
  for (const value of results) {
    assert.ok(Math.abs(value.x - results[0].x) < 1e-8)
    assert.ok(Math.abs(value.y - results[0].y) < 1e-8)
  }
})

test('跟随渐进启动，不越过目标；鼠标离开后平滑归中并稳定停止', () => {
  const follow = createFocusMotion()
  assert.deepEqual(follow({ x: 1, y: 0 }, 0), { x: 0, y: 0 })
  let previous = 0
  for (let i = 1; i <= 120; i++) {
    const value = follow({ x: 1, y: 0 }, i * 1000 / 120)
    assert.ok(value.x >= previous && value.x <= 1)
    if (i === 1) assert.ok(value.x < 0.02, '起步不能直接跳一大截')
    previous = value.x
  }
  for (let i = 121; i <= 360; i++) {
    const value = follow({ x: 0, y: 0 }, i * 1000 / 120)
    assert.ok(value.x <= previous && value.x >= 0)
    previous = value.x
  }
  assert.equal(previous, 0)
})

test('忽略亚像素鼠标抖动，缓慢的大范围移动仍能跟随', () => {
  const follow = createFocusMotion()
  let now = 0
  for (; now <= 2000; now += 10) follow({ x: 0.5, y: -0.3 }, now)
  for (let i = 0; i < 100; i++) {
    now += 10
    const value = follow({ x: 0.5 + (i % 2 ? -0.002 : 0.002), y: -0.3 }, now)
    assert.deepEqual(value, { x: 0.5, y: -0.3 })
  }
  let result
  for (let i = 0; i < 100; i++) {
    now += 10
    result = follow({ x: 0.5 + i * 0.003, y: -0.3 }, now)
  }
  assert.ok(result.x > 0.7)
})

test('后台恢复后不瞬移，正常不均匀帧间隔下仍保持时间一致', () => {
  const follow = createFocusMotion()
  follow({ x: 0, y: 0 }, 0)
  const resumed = follow({ x: 1, y: -1 }, 10000)
  assert.ok(resumed.x > 0 && resumed.x < 0.3)
  assert.ok(resumed.y < 0 && resumed.y > -0.3)

  const steady = createFocusMotion(), uneven = createFocusMotion()
  const target = { x: 1, y: 0.6 }
  steady(target, 0); uneven(target, 0)
  let a, b
  for (let time = 10; time <= 200; time += 10) a = steady(target, time)
  for (const time of [7, 37, 51, 91, 126, 160, 175, 200]) b = uneven(target, time)
  assert.ok(Math.abs(a.x - b.x) < 1e-8)
  assert.ok(Math.abs(a.y - b.y) < 1e-8)
})
