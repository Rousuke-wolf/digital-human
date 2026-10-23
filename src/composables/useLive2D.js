// useLive2D.js — Live2D 数字人模块（文化页 / 3D 展厅共用）
// 从原 script.js 全局函数迁移而来：模块级单例，
// 页面组件 import 后在 onMounted 初始化、onBeforeUnmount 销毁
//
// 依赖的浏览器全局（index.html CDN 加载）：
//   PIXI（pixi.js）、Live2DCubismCore、PIXI.live2d（pixi-live2d-display）
// 嘴型振幅由 src/tts.js 写入 window._ttsAmplitude（后续批次改为模块通信）

let _app = null
let _model = null
let _resizeObserver = null
let _avatarDragCleanup = null
let _mouthParam = null
let _lipsyncSmoothed = 0
let _lipsyncActive = false
let _expressionSupported = false
let _zoomFactor = 1.1

function showModelError(message) {
  const canvas = document.getElementById('live2d')
  if (!canvas?.parentElement) return
  const container = canvas.parentElement
  container.querySelector('.live2d-error-message')?.remove()
  const el = document.createElement('div')
  el.className = 'live2d-error-message'
  el.style.cssText = `
    color:#fbbf24;text-align:center;padding:20px;
    background:rgba(0,0,0,0.8);border-radius:10px;
    position:absolute;top:50%;left:50%;
    transform:translate(-50%,-50%);width:80%;
    z-index:100;border:1px solid #fbbf24;line-height:1.6;
  `
  el.innerHTML = `<div style="font-size:18px;">❌ ${message}</div>`
  container.appendChild(el)
}

// ── 初始化：canvas 存在才执行，重复调用先销毁旧实例 ──
export async function initLive2D() {
  const canvas = document.getElementById('live2d')
  if (!canvas) return

  // 销毁旧实例（切页回来 / 重复初始化时避免叠加渲染）
  destroyLive2D()
  _zoomFactor = 1.1

  try {
    if (typeof PIXI === 'undefined') { showModelError('PIXI 库加载失败'); return }
    if (typeof Live2DCubismCore === 'undefined') { showModelError('Cubism Core 未加载'); return }
    if (!PIXI.live2d?.Live2DModel) { showModelError('Cubism4 插件未正确加载'); return }

    const container = canvas.closest('.character-3d') || canvas.parentElement
    if (!container) { showModelError('找不到 Live2D 显示区域'); return }

    const app = new PIXI.Application({
      view: canvas,
      width: container.clientWidth,
      height: container.clientHeight,
      transparent: true,
      autoStart: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })
    const model = await PIXI.live2d.Live2DModel.from('..\\public\\model\\hiyori\\hiyori.model3.json')

    _app = app
    _model = model
    app.stage.addChild(model)

    // ── 自适应尺寸 ──────────────────────────────
    let _baseScale = container.clientWidth * 0.0007
    const ZOOM_MIN = 0.8
    const ZOOM_MAX = 1.4
    const ZOOM_STEP = 0.08

    // ═══ 移动端圆框「面部特写」可调参数（三个页面共用，改这里即可）═══
    // headRatio：头部高度占模型包围盒高度的比例（脸被裁大→调小；头太小→调大）
    // fill：头部高度占圆框直径的比例（越接近 1 脸越满）
    // offsetY：整体上下微调，正数下移 / 负数上移（单位 px）
    // offsetX：整体左右微调，负数=脸部在圆框中往左移 / 正数=往右移（单位 px）
    const AVATAR_HEAD_RATIO = 0.32
    const AVATAR_FILL = 1.25
    const AVATAR_OFFSET_Y = -25
    const AVATAR_OFFSET_X = -13

    // ═══ 桌面端数字人整体位置/高度可调参数（三个页面共用）═══
    // heightRatio：数字人高度占舞台高度的比例（与右侧对话框高度对齐，调大=人变高）
    // topOffset：数字人顶部离舞台顶部的距离（px，调大=整体下移）
    // voiceRatio：语音模式（文化页全屏）下人物高度比例（给右侧面板让位）
    const DESK_MODEL_HEIGHT_RATIO = 1.5
    const DESK_MODEL_TOP_OFFSET = -60
    const VOICE_MODE_HEIGHT_RATIO = 1
    function fitModel() {
      const w = container.clientWidth
      const h = container.clientHeight
      app.renderer.resize(w, h)
      // 移动端悬浮圆形小头像：容器被 CSS 缩成 ~116px 圆形，检测宽度 < 300 切换系数
      const compact = w < 300
      const isVoiceMode = document.querySelector('.app-wrapper')?.classList.contains('voice-mode')
      model.x = w / 2
      if (compact) {
        // 面部特写：读取模型真实绘制包围盒（本地坐标，不受缩放影响），
        // 把头部区域精确平移到圆框中心，缩放让头部填满圆框
        try {
          const b = model.getLocalBounds()
          if (b.height > 10) {
            const targetH = (h * AVATAR_FILL) / AVATAR_HEAD_RATIO   // 包围盒目标高度
            const s = targetH / b.height
            model.anchor.set(0, 0)   // 原点改为画布左上角，坐标计算更直接
            model.scale.set(s * _zoomFactor)
            // 头部中心（本地坐标）→ 屏幕圆框中心（offsetX 负值=脸往左移）
            model.x = w / 2 - s * (b.x + b.width / 2) + AVATAR_OFFSET_X
            model.y = h / 2 - s * (b.y + (AVATAR_HEAD_RATIO / 2) * b.height) + AVATAR_OFFSET_Y
            _baseScale = s
            return
          }
        } catch { /* 包围盒异常时退回下方兜底公式 */ }
        // 兜底：按模型自然高度估算
        const s = (h * AVATAR_FILL) / AVATAR_HEAD_RATIO / (model.height || 1000)
        model.scale.set(s * _zoomFactor)
        model.anchor.set(0.5, 0.28)
        model.y = h / 2 + (0.28 - AVATAR_HEAD_RATIO / 2) * s * (model.height || 1000)
        _baseScale = s
      } else {
        // 桌面端：高度按舞台比例（与右侧对话框对齐），顶部贴齐舞台顶部；
        // 用模型真实包围盒计算，缩放与定位不依赖猜测的模型尺寸
        try {
          const b = model.getLocalBounds()
          if (b.height > 10) {
            const ratio = isVoiceMode ? VOICE_MODE_HEIGHT_RATIO : DESK_MODEL_HEIGHT_RATIO
            const s = (h * ratio) / b.height
            model.anchor.set(0, 0)
            model.scale.set(s * _zoomFactor)
            model.x = w / 2 - s * (b.x + b.width / 2)
            model.y = DESK_MODEL_TOP_OFFSET - s * b.y
            _baseScale = s
          } else {
            throw new Error('bounds empty')
          }
        } catch {
          // 兜底：沿用宽度系数估算（锚点定位）
          model.anchor.set(0.5, 0.28)
          const BASE = isVoiceMode ? 0.00035 : 0.0007
          model.scale.set(w * BASE * _zoomFactor)
          _baseScale = w * BASE
          model.y = h * 0.55
        }
      }
    }
    fitModel()

    model.interactive = true
    model.on('pointerdown', () => {
      try { model.motion('TapBody') } catch {}
    })

    const ro = new ResizeObserver(() => fitModel())
    ro.observe(container)
    _resizeObserver = ro

    // ── 移动端小头像拖动（仅圆形悬浮模式下启用）──
    // 小圆框可拖到屏幕任意位置；拖动时不触发页面滚动
    const stageEl = container.closest('.left-stage') || container.closest('.culture-left')
    let _dragState = null
    const _onAvatarDown = (e) => {
      if (container.clientWidth >= 300) return   // 非圆形模式（桌面大舞台）不启用
      const rect = stageEl.getBoundingClientRect()
      _dragState = { sx: e.clientX, sy: e.clientY, ox: rect.left, oy: rect.top, moved: false }
      try { stageEl.setPointerCapture(e.pointerId) } catch {}
    }
    const _onAvatarMove = (e) => {
      if (!_dragState) return
      if (!_dragState.moved && Math.hypot(e.clientX - _dragState.sx, e.clientY - _dragState.sy) < 5) return
      _dragState.moved = true
      const d = stageEl.clientWidth
      const x = Math.min(window.innerWidth - d - 8, Math.max(8, _dragState.ox + e.clientX - _dragState.sx))
      const y = Math.min(window.innerHeight - d - 8, Math.max(72, _dragState.oy + e.clientY - _dragState.sy))
      stageEl.style.left = `${x}px`
      stageEl.style.top = `${y}px`
      stageEl.style.right = 'auto'
      stageEl.style.bottom = 'auto'
    }
    const _onAvatarUp = () => { _dragState = null }
    stageEl?.addEventListener('pointerdown', _onAvatarDown)
    stageEl?.addEventListener('pointermove', _onAvatarMove)
    stageEl?.addEventListener('pointerup', _onAvatarUp)
    stageEl?.addEventListener('pointercancel', _onAvatarUp)
    if (stageEl) stageEl.style.touchAction = 'none'
    _avatarDragCleanup = stageEl ? () => {
      stageEl.removeEventListener('pointerdown', _onAvatarDown)
      stageEl.removeEventListener('pointermove', _onAvatarMove)
      stageEl.removeEventListener('pointerup', _onAvatarUp)
      stageEl.removeEventListener('pointercancel', _onAvatarUp)
    } : null

    // ── 滚轮缩放 ─────────────────────────────────
    container.addEventListener('wheel', (e) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
      _zoomFactor = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, _zoomFactor + delta))
      model.scale.set(_baseScale * _zoomFactor)
    }, { passive: false })

    // ── 口型同步 ─────────────────────────────────
    const MOUTH_PARAMS = ['ParamMouthOpenY', 'PARAM_MOUTH_OPEN_Y', 'ParamMouthOpen']
    _mouthParam = null
    for (const name of MOUTH_PARAMS) {
      try {
        model.internalModel.coreModel.setParameterValueById(name, 0)
        _mouthParam = name
        break
      } catch {}
    }
    if (!_mouthParam) {
      try {
        const count = model.internalModel.coreModel.getParameterCount()
        for (let i = 0; i < count; i++) {
          const id = model.internalModel.coreModel.getParameterId(i)
          if (id?.toLowerCase().includes('mouth') && id?.toLowerCase().includes('open')) {
            _mouthParam = id
            break
          }
        }
      } catch {}
    }

    const _lipsyncTicker = () => {
      if (!_mouthParam) return
      if (!_lipsyncActive) {
        try { model.internalModel.coreModel.setParameterValueById(_mouthParam, 0) } catch {}
        return
      }
      const raw = window._ttsAmplitude ?? 0
      _lipsyncSmoothed = _lipsyncSmoothed * 0.30 + raw * 0.70
      const val = Math.min(1, _lipsyncSmoothed * 5.0)
      try { model.internalModel.coreModel.setParameterValueById(_mouthParam, val) } catch {}
    }
    app.ticker.add(_lipsyncTicker, null, PIXI.UPDATE_PRIORITY?.NORMAL ?? 0)

    // ── 表情探测：expressionManager 里真实存在表情数据才支持 ──
    _expressionSupported = false
    try {
      const exprMgr = model.internalModel?.motionManager?.expressionManager
      const exprCount = exprMgr?.expressions?.length ?? 0
      if (exprCount > 0) {
        _expressionSupported = true
        try { model.expression(0) } catch {}
      }
    } catch {
      _expressionSupported = false
    }

    // 表情栏显隐（按钮 active 状态由 Live2DPanel 的 ref 自行管理）
    const emotionSwitch = document.querySelector('.emotion-switch')
    if (emotionSwitch) emotionSwitch.style.display = _expressionSupported ? '' : 'none'

    console.log('✅ Live2D 模型加载成功')
  } catch (error) {
    console.error('Live2D 初始化失败:', error)
    showModelError('模型加载失败，请检查控制台报错')
  }
}

// ── 表情切换：只切换模型表情，按钮高亮由组件管理 ──
export function setEmotion(emotion) {
  if (!_expressionSupported || !_model) return
  try {
    const map = { happy: 'f01', peace: 'f02', thoughtful: 'f03', surprised: 'f04', gentle: 'f05' }
    _model.expression(map[emotion])
  } catch {}
}

// ── 嘴型开关（TTS 播放时调用）──
export function startLipsync() { _lipsyncActive = true; _lipsyncSmoothed = 0 }
export function stopLipsync() { _lipsyncActive = false; _lipsyncSmoothed = 0 }

// ── 销毁：页面离开时调用，释放 PIXI 实例与观察器 ──
export function destroyLive2D() {
  if (_resizeObserver) { _resizeObserver.disconnect(); _resizeObserver = null }
  if (_avatarDragCleanup) { _avatarDragCleanup(); _avatarDragCleanup = null }
  if (_app) {
    try { _app.destroy(true, { children: true, texture: true }) } catch {}
    _app = null
  }
  _model = null
  _mouthParam = null
  _lipsyncActive = false
}
