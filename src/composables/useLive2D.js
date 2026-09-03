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

    function fitModel() {
      const w = container.clientWidth
      const h = container.clientHeight
      app.renderer.resize(w, h)
      if (model.anchor) model.anchor.set(0.5, 0.28)
      model.x = w / 2
      model.y = h * 0.55
      // 语音模式（文化页）下人物缩小，给右侧面板让位
      const isVoiceMode = document.querySelector('.app-wrapper')?.classList.contains('voice-mode')
      const BASE = isVoiceMode ? 0.00035 : 0.0007
      model.scale.set(w * BASE * _zoomFactor)
      _baseScale = w * BASE
    }
    fitModel()

    model.interactive = true
    model.on('pointerdown', () => {
      try { model.motion('TapBody') } catch {}
    })

    const ro = new ResizeObserver(() => fitModel())
    ro.observe(container)
    _resizeObserver = ro

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
  if (_app) {
    try { _app.destroy(true, { children: true, texture: true }) } catch {}
    _app = null
  }
  _model = null
  _mouthParam = null
  _lipsyncActive = false
}
