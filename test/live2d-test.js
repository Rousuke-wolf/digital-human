import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { getModelLayout, getPointerFocus, ZOOM_DEFAULT } from '../src/utils/live2dGeometry.js'

for (const id of ['res1', 'res2']) {
  test(`${id} 模型运行资源完整，声明了口型参数`, () => {
    const root = new URL(`../public/model/${id}/`, import.meta.url)
    const settings = JSON.parse(readFileSync(new URL('layout.model3.json', root)))
    const refs = settings.FileReferences
    const files = [refs.Moc, refs.Physics, refs.DisplayInfo, ...refs.Textures,
      ...refs.Expressions.map((e) => e.File), ...Object.values(refs.Motions).flat().map((m) => m.File)]
    for (const file of files) assert.ok(existsSync(new URL(file, root)), `${id}/${file}`)
    assert.ok(settings.Groups.find((g) => g.Name === 'LipSync').Ids.includes('ParamMouthOpenY'))
  })
}

test('最小缩放完整显示全身，放大仍以人物中心定位', () => {
  const b = { x: 100, y: 70, width: 800, height: 2000 }
  for (const [width, height] of [[600, 800], [116, 116], [320, 170]]) {
    const full = getModelLayout(b, width, height, 1)
    assert.ok(full.y + b.y * full.scale >= 0)
    assert.ok(full.y + (b.y + b.height) * full.scale <= height)
    assert.ok(full.x + b.x * full.scale >= 0)
    assert.ok(full.x + (b.x + b.width) * full.scale <= width)
    const upper = getModelLayout(b, width, height, ZOOM_DEFAULT)
    assert.equal(upper.x + (b.x + b.width / 2) * upper.scale, width / 2)
    assert.ok(Math.abs(upper.y + b.y * upper.scale - (full.y + b.y * full.scale)) < 1e-8)
  }
})

test('跟随坐标以人物中心为原点，远距离始终限幅，离开时归中', () => {
  const center = { x: 250, y: 370 }
  const neutral = getPointerFocus(center, center, 400, 700)
  assert.equal(neutral.x, 0)
  assert.ok(neutral.y === 0)
  const rightUp = getPointerFocus({ x: 100000, y: -100000 }, center, 400, 700)
  assert.ok(rightUp.x > 0 && rightUp.x <= 1)
  assert.ok(rightUp.y > 0 && rightUp.y <= 1)
  assert.deepEqual(getPointerFocus(null, center, 400, 700), { x: 0, y: 0 })
})
