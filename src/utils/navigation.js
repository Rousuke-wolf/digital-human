// navigation.js — 跨页面跳转辅助（带 3D 展品状态）
// 原 window.switchTab 全局迁移而来
import { MODELS } from './models.js'

// 跳转目标暂存键（sessionStorage）：整页跳转时模块状态会重置，
// 3D 页挂载时读取并一次性消费
const JUMP_KEY = 'zhichuan-exhibit-jump'

// 从文化页/知识图谱跳转到 3D 展厅并选中指定展品。
// 采用整页跳转（location.assign）保证导航必定发生；
// 目标展品通过 sessionStorage 传递，3D 页挂载时恢复
export function goToExhibit(index) {
  const idx = Number(index)
  const safeIdx = idx >= 0 && idx < MODELS.length ? idx : 0
  try { sessionStorage.setItem(JUMP_KEY, String(safeIdx)) } catch {}
  window.location.assign('/3d')
}

// 3D 页挂载时调用：读取并清掉跳转目标（无则返回 null）
export function consumeExhibitJump() {
  try {
    const raw = sessionStorage.getItem(JUMP_KEY)
    sessionStorage.removeItem(JUMP_KEY)
    if (raw == null) return null
    const idx = Number(raw)
    return Number.isInteger(idx) && idx >= 0 && idx < MODELS.length ? idx : null
  } catch {
    return null
  }
}

// ── 个人中心「查看生成模型」跳转（必做项 4）──
const GEN_JUMP_KEY = 'zhichuan-gen-jump'

export function goToGeneratedModel(glbUrl) {
  try { sessionStorage.setItem(GEN_JUMP_KEY, String(glbUrl)) } catch {}
  window.location.assign('/3d')
}

// 3D 页挂载时调用：读取并清掉生成模型跳转目标（无则返回 null）
export function consumeGeneratedJump() {
  try {
    const raw = sessionStorage.getItem(GEN_JUMP_KEY)
    sessionStorage.removeItem(GEN_JUMP_KEY)
    // 仅接受本项目的 glb 代理地址，防止跳转目标被篡改
    return typeof raw === 'string' && raw.startsWith('/meshy-glb?url=') ? raw : null
  } catch {
    return null
  }
}

