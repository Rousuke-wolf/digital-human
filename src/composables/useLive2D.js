// 各页面共用的 Live2D 单例；模型资源从 public/model 提供。
import { reactive } from 'vue'
import { speechState, readSpeechAmplitude } from '../utils/speechState.js'
import { createFocusMotion } from '../utils/motionSmoothing.js'
import {
  getModelLayout, getPointerFocus, ZOOM_MIN, ZOOM_DEFAULT, ZOOM_MAX, ZOOM_STEP, MOBILE_ZOOM_DEFAULT,
} from '../utils/live2dGeometry.js'

export const LIVE2D_MODELS = [
  { id: 'res1', label: '绫韵 · 绣娘', avatar: `${import.meta.env.BASE_URL}avatar_1.png`, url: `${import.meta.env.BASE_URL}model/res1/layout.model3.json` },
  { id: 'res2', label: '绫韵 · 正装', avatar: `${import.meta.env.BASE_URL}avatar_2.png`, url: `${import.meta.env.BASE_URL}model/res2/layout.model3.json` },
]
export const live2dState = reactive({
  modelId: 'res1', loading: false, ready: false, error: '',
  zoom: ZOOM_DEFAULT, canZoomIn: true, canZoomOut: true, expressionSupported: false,
})

let app = null
let model = null
let container = null
let bounds = null
let resizeObserver = null
let cleanup = []
let generation = 0
let pointer = null
let currentEmotion = 'happy'
let loggedParams = false

// ── 动作播放：点击数字人随机动作、播报结束点头 ──
// 动作会驱动头部角度参数，与焦点跟随冲突：动作期间暂停焦点写入，结束后恢复
const TAP_MOTIONS = ['Nod', 'Shake', 'GentleBow']
let motionOwner = null

function playMotionSafely(instance, group) {
  if (motionOwner || !instance || instance !== model) return
  const manager = instance.internalModel.motionManager
  motionOwner = instance
  const clear = () => {
    if (motionOwner === instance) motionOwner = null
    manager.off('motionFinish', clear)
    manager.off('destroy', clear)
  }
  // motion() 的 Promise 在“开始播放”时完成，不代表动作播完。
  manager.once('motionFinish', clear)
  manager.once('destroy', clear)
  Promise.resolve().then(() => instance.motion(group))
    .then((started) => { if (!started) clear() })
    .catch(clear)
}

function showModelError(message) {
  live2dState.error = message
  container?.querySelector('.live2d-error-message')?.remove()
  if (!message || !container) return
  const el = document.createElement('div')
  el.className = 'live2d-error-message'
  el.style.cssText = 'position:absolute;inset:35% 10% auto;padding:16px;border-radius:12px;background:#fff8ed;color:#a93226;text-align:center;z-index:5'
  el.textContent = message
  container.appendChild(el)
}

// PIXI getLocalBounds 返回整张画布（含透明留白）；使用真实绘制网格计算人物区域。
function getDrawableBounds(instance) {
  const internal = instance.internalModel
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const id of internal.getDrawableIDs()) {
    const index = internal.getDrawableIndex(id)
    if (internal.coreModel.getDrawableOpacity(index) <= 0) continue
    const vertices = internal.getDrawableVertices(index)
    for (let i = 0; i < vertices.length; i += 2) {
      const p = internal.localTransform.apply({ x: vertices[i], y: vertices[i + 1] })
      left = Math.min(left, p.x)
      right = Math.max(right, p.x)
      top = Math.min(top, p.y)
      bottom = Math.max(bottom, p.y)
    }
  }
  if (right > left && bottom > top) return { x: left, y: top, width: right - left, height: bottom - top }
  return instance.getLocalBounds()
}

function fitModel() {
  if (!app || !model || !container || !bounds) return
  const w = Math.max(1, container.clientWidth)
  const h = Math.max(1, container.clientHeight)
  app.renderer.resize(w, h)
  const layout = getModelLayout(bounds, w, h, live2dState.zoom)
  model.anchor.set(0, 0)
  model.scale.set(layout.scale)
  model.position.set(layout.x, layout.y)
}

export function zoomLive2D(direction) {
  live2dState.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, live2dState.zoom + direction * ZOOM_STEP))
  live2dState.canZoomOut = live2dState.zoom > ZOOM_MIN + 0.001
  live2dState.canZoomIn = live2dState.zoom < ZOOM_MAX - 0.001
  fitModel()
}

function setupParameters(instance) {
  const internal = instance.internalModel
  const core = internal.coreModel
  const follow = createFocusMotion()
  // 不能用 setParameterValueById 是否抛异常来探测：Cubism 会为不存在的 ID 创建虚拟参数。
  const ids = new Set(core.getModel().parameters.ids)
  const lipIds = internal.settings.getLipSyncParameters?.() || []
  const mouthIds = [...new Set([...lipIds, 'ParamMouthOpenY', 'PARAM_MOUTH_OPEN_Y', 'ParamMouthOpen'])]
    .filter((id) => ids.has(id))
  // 禁用插件自动鼠标交互，呼吸仅保留小幅摆动（自带默认转头幅度过大）。
  for (const param of internal.breath?.getParameters() || []) {
    if (param.parameterId !== 'ParamBreath') param.peak *= 0.12
  }
  const set = (id, value) => { if (ids.has(id)) core.setParameterValueById(id, value) }
  // 一次性打印模型完整参数表（含取值范围），用于诊断头部跟踪/表情映射
  if (!loggedParams) {
    loggedParams = true
    try {
      const p = core.getModel().parameters
      const list = p.ids.map((id, i) => `${id}[${p.minimumValues[i]},${p.maximumValues[i]}]`)
      console.log(`[Live2D] 模型参数表（${list.length} 个）:`, list.join(' '))
    } catch { /* 忽略 */ }
  }
  // 关键：在动作、表情、物理之后、coreModel.update() 之前写口型，避免被动画覆盖。
  let prevSpeaking = false, followWeight = 1, lastFrame = null
  internal.on('beforeModelUpdate', () => {
    if (model !== instance || !container) return
    const rect = container.getBoundingClientRect()
    const s = instance.scale.x
    const visibleTop = Math.max(0, instance.y + bounds.y * s)
    const visibleBottom = Math.min(rect.height, instance.y + (bounds.y + bounds.height) * s)
    const center = {
      x: rect.left + instance.x + (bounds.x + bounds.width / 2) * s,
      y: rect.top + (visibleTop + visibleBottom) / 2,
    }
    const target = getPointerFocus(pointer, center, rect.width, rect.height)
    const now = performance.now()
    const dt = lastFrame === null ? 0 : Math.min(0.05, Math.max(0, (now - lastFrame) / 1000))
    lastFrame = now
    const focus = follow(target, now)
    const motionActive = motionOwner === instance
    followWeight = motionActive ? 0 : Math.min(1, followWeight + dt / 0.16)
    const followSet = (id, value) => {
      if (!ids.has(id)) return
      const original = core.getParameterValueById(id)
      set(id, original + (value - original) * followWeight)
    }
    // 保留 master 的增强跟踪和点击动作；动作结束后淡入跟随，避免抢写和突然跳头。
    if (!motionActive) {
      followSet('ParamAngleX', focus.x * 16)
      followSet('ParamAngleY', focus.y * 12)
      followSet('ParamAngleZ', -focus.x * focus.y * 6)
      followSet('ParamEyeBallX', focus.x * 0.6)
      followSet('ParamEyeBallY', focus.y * 0.5)
      followSet('ParamBodyAngleX', focus.x * 4)
      followSet('ParamBodyAngleY', focus.y * 3)
      followSet('ParamBodyAngleZ', 0)
      followSet('ParamBodyLean', 0)
    }
    const speaking = speechState.active
    const amplitude = readSpeechAmplitude()
    // 暂停/网络短空档仍由语音闭嘴；完全静默后允许表情自主控制嘴部。
    if (speaking || prevSpeaking) {
      for (const id of mouthIds) {
        const index = core.getParameterIndex(id)
        const max = core.getParameterMaximumValue(index)
        core.setParameterValueById(id, Math.min(0.9, amplitude) * max)
      }
    }
    // 播报结束（下降沿）→ 点头致意
    if (prevSpeaking && !speaking) playMotionSafely(instance, 'Nod')
    prevSpeaking = speaking
  })
}

async function loadModel(id) {
  if (!app || live2dState.loading) return false
  const entry = LIVE2D_MODELS.find((item) => item.id === id)
  if (!entry) return false
  const myGeneration = generation
  const owner = app
  live2dState.loading = true
  showModelError('')
  try {
    const next = await window.PIXI.live2d.Live2DModel.from(entry.url, {
      autoInteract: false,
      idleMotionGroup: '__manual__', // 不播放示例中的大幅 Idle/Nod/Shake；保留自动眨眼和轻呼吸。
    })
    if (myGeneration !== generation || owner !== app) {
      next.destroy({ texture: true, baseTexture: true })
      return false
    }
    const nextBounds = getDrawableBounds(next)
    const previous = model
    model = next
    bounds = nextBounds
    setupParameters(next)
    owner.stage.addChild(next)
    if (previous) {
      owner.stage.removeChild(previous)
      previous.destroy({ texture: true, baseTexture: true })
    }
    live2dState.modelId = id
    live2dState.ready = true
    live2dState.expressionSupported = !!next.internalModel.motionManager.expressionManager?.expressions?.length
    fitModel()
    setEmotion(currentEmotion)
    // 点击数字人 → 随机互动动作（点头/摇头/鞠躬）
    next.interactive = true
    next.on('pointerdown', () => {
      playMotionSafely(next, TAP_MOTIONS[Math.floor(Math.random() * TAP_MOTIONS.length)])
    })
    return true
  } catch (error) {
    if (myGeneration === generation) {
      console.error('Live2D 模型加载失败:', error)
      showModelError('模型加载失败，请重试切换形象')
    }
    return false
  } finally {
    if (myGeneration === generation) live2dState.loading = false
  }
}

export function switchLive2DModel() {
  const index = LIVE2D_MODELS.findIndex((item) => item.id === live2dState.modelId)
  return loadModel(LIVE2D_MODELS[(index + 1) % LIVE2D_MODELS.length].id)
}

export async function initLive2D() {
  const canvas = document.getElementById('live2d')
  if (!canvas) return false
  destroyLive2D()
  container = canvas.closest('.character-3d') || canvas.parentElement
  // 移动端悬浮圆框用更大的初始缩放（人物在圆框内更近），桌面端用默认
  live2dState.zoom = (container?.clientWidth ?? 0) < 300 ? MOBILE_ZOOM_DEFAULT : ZOOM_DEFAULT
  live2dState.canZoomIn = live2dState.canZoomOut = true
  try {
    if (!window.PIXI?.live2d?.Live2DModel || !window.Live2DCubismCore) {
      throw new Error('Live2D 库未加载，请检查网络后刷新')
    }
    app = new window.PIXI.Application({
      view: canvas, width: Math.max(1, container.clientWidth), height: Math.max(1, container.clientHeight),
      transparent: true, autoStart: true, resolution: window.devicePixelRatio || 1, autoDensity: true,
    })
    const onPointer = (e) => { if (e.pointerType !== 'touch') pointer = { x: e.clientX, y: e.clientY } }
    const onLeave = () => { pointer = null }
    window.addEventListener('pointermove', onPointer)
    window.addEventListener('blur', onLeave)
    document.addEventListener('pointerleave', onLeave)
    const stage = container.closest('.left-stage')
    let drag = null
    const onDown = (e) => {
      if (!stage || container.clientWidth >= 180 || e.target.closest('button')) return
      const rect = stage.getBoundingClientRect()
      drag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top }
      stage.setPointerCapture(e.pointerId)
    }
    const onMove = (e) => {
      if (!drag) return
      stage.style.left = `${Math.max(8, Math.min(window.innerWidth - stage.clientWidth - 8, drag.left + e.clientX - drag.x))}px`
      stage.style.top = `${Math.max(72, Math.min(window.innerHeight - stage.clientHeight - 8, drag.top + e.clientY - drag.y))}px`
      stage.style.right = stage.style.bottom = 'auto'
    }
    const onUp = () => { drag = null }
    stage?.addEventListener('pointerdown', onDown)
    stage?.addEventListener('pointermove', onMove)
    stage?.addEventListener('pointerup', onUp)
    stage?.addEventListener('pointercancel', onUp)
    const onWheel = (e) => { e.preventDefault(); zoomLive2D(e.deltaY < 0 ? 1 : -1) }
    container.addEventListener('wheel', onWheel, { passive: false })
    const ownerContainer = container
    cleanup.push(() => {
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('blur', onLeave)
      document.removeEventListener('pointerleave', onLeave)
      ownerContainer.removeEventListener('wheel', onWheel)
      stage?.removeEventListener('pointerdown', onDown)
      stage?.removeEventListener('pointermove', onMove)
      stage?.removeEventListener('pointerup', onUp)
      stage?.removeEventListener('pointercancel', onUp)
    })
    resizeObserver = new ResizeObserver(fitModel)
    resizeObserver.observe(container)
    return await loadModel(live2dState.modelId)
  } catch (error) {
    console.error('Live2D 初始化失败:', error)
    showModelError(error.message || 'Live2D 初始化失败')
    return false
  }
}

export function setEmotion(emotion) {
  currentEmotion = emotion
  const manager = model?.internalModel.motionManager.expressionManager
  if (!manager) return
  const map = { happy: '微笑', gentle: '微笑', surprised: '惊讶', thoughtful: '悲伤' }
  if (emotion === 'peace') manager.resetExpression()
  else model.expression(map[emotion] || '微笑').catch(console.warn)
}

// 兼容现有调用点；口型开关以实际播放器状态为准，不再受估算时长影响。
export function startLipsync() { /* 由播放器驱动，无需手动开启。 */ }
export function stopLipsync() { /* 由播放器驱动，无需按估算时长关闭。 */ }

export function destroyLive2D() {
  generation++
  resizeObserver?.disconnect()
  resizeObserver = null
  cleanup.forEach((fn) => fn())
  cleanup = []
  if (app) app.destroy(false, { children: true, texture: true, baseTexture: true })
  // 保留 Vue 持有的 canvas：切换路由和重复初始化不能由 PIXI 删除 DOM。
  container?.querySelector('.live2d-error-message')?.remove()
  app = model = container = bounds = null
  pointer = null
  live2dState.loading = live2dState.ready = live2dState.expressionSupported = false
  live2dState.error = ''
}
