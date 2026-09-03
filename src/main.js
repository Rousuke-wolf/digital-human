import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

import { MODELS } from './utils/models.js'
import { appState } from './utils/state.js'
import { buildModelDropdown } from './page/show3D/index.js'
import { attachViewerLoading } from './utils/viewerLoading.js'

// ── Meshy AI ──
window.meshyTask = { id: null, status: 'idle', progress: 0, resultUrl: null, prompt: '' }

// ── 模型切换 ──
window.switchModel = function (index) {
  appState.currentModelIndex = index
  const model = MODELS[index]
  const viewer = document.getElementById('mainModelViewer')
  if (!viewer) {
    const viewBox = document.getElementById('modelViewBox')
    if (viewBox) {
      viewBox.innerHTML = `
        ${buildModelDropdown()}
        <model-viewer id="mainModelViewer" src="${model.src}" alt="3D模型展示"
          auto-rotate camera-controls shadow-intensity="1" exposure="1"
          style="width:100%;height:100%;background:transparent;"></model-viewer>`
      attachViewerLoading(document.getElementById('mainModelViewer'))
    }
  } else {
    viewer.setAttribute('src', model.src)
  }
  const nameEl = document.getElementById('modelInfoName')
  if (nameEl) nameEl.textContent = model.name
  const introEl = document.getElementById('modelIntroText')
  if (introEl) introEl.textContent = model.intro
  // 同步下拉框选中项（如从文化页 isShowModel 跳转而来）
  const dropdown = document.getElementById('modelDropdown')
  if (dropdown) dropdown.value = String(index)
}

window.onDropdownChange = function (value) {
  const idx = Number(value)
  if (isNaN(idx) || idx < 0 || idx >= MODELS.length) return
  if (typeof window._meshyStopTts === 'function') window._meshyStopTts()
  appState.currentModelIndex = idx
  appState._modelHasContent = true

  if (document.getElementById('mainModelViewer')) {
    window.switchModel(idx)
    return
  }

  // 首次进入的空态没有 viewer：直接在位构建。
  // 注意不能用 router.push('/3d') —— 跳转当前路由是 no-op，什么都不发生
  const wrap = document.getElementById('modelViewerWrap')
  if (wrap) {
    const model = MODELS[idx]
    wrap.querySelector('.model-empty-hint')?.remove()
    wrap.innerHTML = `
      <model-viewer id="mainModelViewer" src="${model.src}" alt="3D模型展示"
        auto-rotate camera-controls shadow-intensity="1" exposure="1"
        style="width:100%;height:100%;background:transparent;"></model-viewer>`
    attachViewerLoading(document.getElementById('mainModelViewer'))
    const nameEl = document.getElementById('modelInfoName')
    if (nameEl) nameEl.textContent = model.name
    const introEl = document.getElementById('modelIntroText')
    if (introEl) introEl.textContent = model.intro
    // 下拉框同步（如输入框输入预设名点"生成"的守卫路径）
    const dropdown = document.getElementById('modelDropdown')
    if (dropdown) dropdown.value = String(idx)
  }
}

window.switchTab = function (tab, modelIndex) {
  if (modelIndex !== undefined) {
    const idx = Number(modelIndex)
    appState.currentModelIndex = (idx >= 0 && idx < MODELS.length) ? idx : 0
    appState._modelHasContent = true
  }
  router.push(tab === 'ai' ? '/teaching' : '/3d')
}

// ── renderApp → Vue Router ──
// （聊天记录保存/恢复由 CulturePage 组件生命周期自行处理）
window.renderApp = (page) => {
  const map = { home: '/', culture: '/culture', teaching: '/teaching', '3d': '/3d', about: '/about', login: '/login', profile: '/profile' }
  router.push(map[page] || '/')
}

// ── 挂载 ──
createApp(App).use(router).mount('#app')

// 暴露 router 供旧代码使用（Navbar 注册按钮等）
window.__vueRouter = router
