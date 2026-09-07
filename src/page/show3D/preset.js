// preset.js — 预设展品展示逻辑（Show3DPage 与 Meshy 预设名守卫共用）
// 原 window.switchModel / window.onDropdownChange 全局迁移而来
import { MODELS } from '../../utils/models.js'
import { appState } from '../../utils/state.js'
import { attachViewerLoading } from '../../utils/viewerLoading.js'

// 展示指定下标的预设展品；viewer 不存在时（空态）直接在位构建
export function showPresetModel(index) {
  const idx = Number(index)
  if (isNaN(idx) || idx < 0 || idx >= MODELS.length) return

  appState.currentModelIndex = idx
  appState._modelHasContent = true
  const model = MODELS[idx]

  const viewer = document.getElementById('mainModelViewer')
  if (viewer) {
    viewer.setAttribute('src', model.src)
  } else {
    const wrap = document.getElementById('modelViewerWrap')
    if (wrap) {
      wrap.querySelector('.model-empty-hint')?.remove()
      wrap.innerHTML = `
        <model-viewer id="mainModelViewer" src="${model.src}" alt="3D模型展示"
          auto-rotate camera-controls shadow-intensity="1" exposure="1"
          style="width:100%;height:100%;background:transparent;"></model-viewer>`
      attachViewerLoading(document.getElementById('mainModelViewer'))
    }
  }

  const nameEl = document.getElementById('modelInfoName')
  if (nameEl) nameEl.textContent = model.name
  const introEl = document.getElementById('modelIntroText')
  if (introEl) introEl.textContent = model.intro

  // 下拉框同步（含「输入预设名点生成」的守卫路径）
  const dropdown = document.getElementById('modelDropdown')
  if (dropdown) dropdown.value = String(idx)
}
