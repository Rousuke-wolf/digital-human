// viewerLoading.js — model-viewer 加载状态遮罩
// 展品 GLB 体积大（5~29MB），加载期间在 viewer 容器内显示进度遮罩。
// model-viewer 自带 progress / load / error 事件，src 每次变更都会重新触发
// progress，因此只需在 viewer 元素创建时 attach 一次。
//
// 用法：attachViewerLoading(viewerElement)

const STYLE_ID = 'viewer-loading-style'

function injectStyleOnce() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .viewer-loading-ring {
      width: 42px; height: 42px;
      border: 4px solid #e8d5a3;
      border-top-color: #c8a96e;
      border-radius: 50%;
      animation: viewerSpin 0.9s linear infinite;
    }
    @keyframes viewerSpin { to { transform: rotate(360deg); } }
    .viewer-loading-text {
      font-size: 13px; color: #8a6030; letter-spacing: 0.03em;
    }
  `
  document.head.appendChild(style)
}

export function attachViewerLoading(viewer) {
  const wrap = viewer.parentElement
  if (!wrap) return

  // 容器需要相对定位承载遮罩（绝对定位）
  if (getComputedStyle(wrap).position === 'static') {
    wrap.style.position = 'relative'
  }

  // 重复 attach（viewer 重建）时先清理旧遮罩
  wrap.querySelector('.viewer-loading-overlay')?.remove()

  injectStyleOnce()

  const overlay = document.createElement('div')
  overlay.className = 'viewer-loading-overlay'
  overlay.style.cssText = [
    'position:absolute', 'inset:0',
    'display:none', 'flex-direction:column',
    'align-items:center', 'justify-content:center', 'gap:12px',
    'background:rgba(255,252,245,0.75)',
    'z-index:5', 'pointer-events:none',
  ].join(';')
  overlay.innerHTML = `
    <div class="viewer-loading-ring"></div>
    <div class="viewer-loading-text">模型加载中…</div>
  `
  wrap.appendChild(overlay)

  const textEl = overlay.querySelector('.viewer-loading-text')
  const show = () => { overlay.style.display = 'flex' }
  const hide = () => { overlay.style.display = 'none' }

  // model-viewer 在 load 之后仍可能派发 progress 事件（已知行为），
  // 必须加 loaded 标记：加载完成后忽略一切晚到的 progress，
  // 否则遮罩会被重新拉起且再也没有事件隐藏它 → 永久卡在"加载中"
  let loaded = false

  viewer.addEventListener('progress', (e) => {
    if (loaded) return
    const p = e.detail?.totalProgress ?? 0
    if (p >= 1) {
      // 兜底：进度到 100% 视为加载完成（部分版本不派发 load）
      loaded = true
      hide()
      return
    }
    if (textEl) {
      textEl.textContent = p > 0 ? `模型加载中 ${Math.round(p * 100)}%…` : '模型加载中…'
      textEl.style.color = '#8a6030'
    }
    show()
  })
  viewer.addEventListener('load', () => {
    loaded = true
    hide()
  })
  viewer.addEventListener('error', () => {
    loaded = true
    if (textEl) {
      textEl.textContent = '模型加载失败，请检查网络后重试'
      textEl.style.color = '#c0392b'
    }
    // 停留几秒让用户看到错误提示
    setTimeout(hide, 3000)
  })
}
