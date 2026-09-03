// character.js — 教学页 3D 数字人角色模块（model-viewer + GLB）
// 从原 script.js 的 initTeachingGLB 迁移而来：
//   原：window.setCharacterState / window.playMotion / window.startLipsync 覆盖全局
//   现：模块级单例，TeachingPage 在 DOM 就绪后调用 initTeachingCharacter，
//       teach/scripts.js 直接 import startLipsync / stopLipsync
import { attachViewerLoading } from '../../utils/viewerLoading.js'

const GLB_MODELS = {
  idle: '/model/character/idle(model).glb',
  talk: '/model/character/talk(model).glb',
  // 注意：文件名是全角括号
  walk: '/model/character/walk（model）.glb',
  wave: '/model/character/wave(model).glb',
}

// 固定视角参数（theta=0, phi=90deg正面），只允许滚轮改半径
const FIXED_THETA = '0deg'
const FIXED_PHI = '90deg'

let _viewer = null
let _container = null
let _radius = 2.2
let _currentState = ''
let _waveReturnTimer = null
let _initialized = false

function setCharacterState(state) {
  if (!_viewer || !GLB_MODELS[state] || state === _currentState) return
  _currentState = state
  _viewer.setAttribute('src', GLB_MODELS[state])
  // src 变更后 model-viewer 会重置 cameraOrbit，需重新锁定
  _viewer.addEventListener('load', function onLoad() {
    _viewer.removeEventListener('load', onLoad)
    _viewer.cameraOrbit = `${FIXED_THETA} ${FIXED_PHI} ${_radius}m`
    // 确保动画自动播放
    _viewer.play?.()
  }, { once: true })
}

// ── 嘴型/状态开关（TTS 播放时调用；教学页用 talk/idle 状态代替口型）──
export function startLipsync() { setCharacterState('talk') }
export function stopLipsync() { setCharacterState('idle') }

export function playMotion(name, returnDelay = 3000) {
  if (!GLB_MODELS[name]) return
  clearTimeout(_waveReturnTimer)
  setCharacterState(name)
  if (name === 'wave' || name === 'walk') {
    _waveReturnTimer = setTimeout(
      () => setCharacterState('idle'),
      returnDelay
    )
  }
}

// ── 初始化：DOM 就绪后由 TeachingPage 调用 ──
export function initTeachingCharacter() {
  const viewer = document.getElementById('teachingViewer')
  const container = document.getElementById('teachingViewerWrap')
  if (!viewer || !container) return

  if (_initialized) {
    _viewer = viewer
    return
  }
  _initialized = true
  _viewer = viewer
  _container = container

  // 角色 GLB 单个 16MB 左右，状态切换（idle/talk/wave）时显示加载进度
  attachViewerLoading(viewer)

  // ── 仅滚轮缩放，不允许拖拽旋转 ──────────────
  // HTML 里已去掉 camera-controls，鼠标拖拽完全无效
  // 这里只处理滚轮 → 改半径
  const ZOOM_MIN = 0.4
  const ZOOM_MAX = 3.0
  const ZOOM_STEP = 0.10

  container.addEventListener('wheel', (e) => {
    e.preventDefault()
    _radius -= e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
    _radius = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, _radius))
    // 每次缩放都锁定 theta/phi，防止视角漂移
    viewer.cameraOrbit = `${FIXED_THETA} ${FIXED_PHI} ${_radius}m`
  }, { passive: false })

  // 阻止触摸拖动（移动端）
  container.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })

  // 首次加载完成后锁定视角
  viewer.addEventListener('load', () => {
    viewer.cameraOrbit = `${FIXED_THETA} ${FIXED_PHI} ${_radius}m`
    viewer.play?.()
  }, { once: true })

  // 进入页面先 wave 一次
  playMotion('wave', 3000)
  console.log('✅ 教学页 GLB 初始化成功')
}

// ── 离开页面时清理 ──
export function destroyTeachingCharacter() {
  clearTimeout(_waveReturnTimer)
  _waveReturnTimer = null
  _currentState = ''
  _viewer = null
  _container = null
  _initialized = false
}
