// navigation.js — 跨页面跳转辅助（带 3D 展品状态）
// 原 window.switchTab 全局迁移而来
import router from '../router/index.js'
import { appState } from './state.js'
import { MODELS } from './models.js'
import { meshyClearResult } from '../page/show3D/Meshy.js'

// 从文化页/知识图谱跳转到 3D 展厅并选中指定展品
export function goToExhibit(index) {
  const idx = Number(index)
  // 重置 Meshy 任务状态与生成结果标记：否则 3D 页挂载时会优先展示
  // 本会话上次生成的模型，把指定展品顶掉（buildInitialViewer 与
  // meshyRestoreState 双重覆盖）。生成记录仍保留在「我的生成」分组里，不丢失
  appState.meshyTask.status = 'idle'
  appState.meshyTask.prompt = ''
  appState.meshyTask.resultUrl = null
  meshyClearResult()
  appState.currentModelIndex = idx >= 0 && idx < MODELS.length ? idx : 0
  appState._modelHasContent = true
  router.push('/3d')
}
