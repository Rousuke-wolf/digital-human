// navigation.js — 跨页面跳转辅助（带 3D 展品状态）
// 原 window.switchTab 全局迁移而来
import router from '../router/index.js'
import { appState } from './state.js'
import { MODELS } from './models.js'

// 从文化页「展示 3D 模型」跳转到 3D 展厅并选中指定展品
export function goToExhibit(index) {
  const idx = Number(index)
  appState.currentModelIndex = idx >= 0 && idx < MODELS.length ? idx : 0
  appState._modelHasContent = true
  router.push('/3d')
}
