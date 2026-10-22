// worksSync.js — 本地作品与云端作品库同步（必做项 4）
//
// 设计：本地 localStorage 仍作为各页面的工作缓存（PatternPage / 3D 页逻辑不变），
// 登录后本地缓存 = 云端镜像：
//   mergeLocalWorks()  登录成功时：游客本地作品合并上云（服务端按 type+data 去重）→ 拉云端回填
//   loadCloudWorks()   换设备登录后：拉云端作品回填本地缓存
// 两个函数都静默失败（后端不可用时本地体验不受影响）
import { userAPI } from '../api/client.js'

const PATTERN_KEY = 'zhichuan-pattern-works'
const MODEL_KEY = 'zhichuan-generated-models'

function readLocal(key) {
  try {
    const list = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeLocal(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // 存储满/隐私模式等场景静默失败
  }
}

// ── 本地 → 云端结构 ─────────────────────────────────
function patternToCloud(w) {
  return {
    type: 'pattern',
    name: w.theme || '未命名纹样',
    data: w.url,
    payload: {
      style: w.style,
      styleLabel: w.styleLabel,
      elements: w.elements,
      keywords: w.keywords,
      density: w.density,
      layout: w.layout,
      filters: w.filters,
      analysis: w.analysis,
      createdAt: w.createdAt,
    },
  }
}

function modelToCloud(m) {
  return {
    type: 'model3d',
    name: m.name,
    data: m.glbUrl,
    payload: { prompt: m.prompt, intro: m.intro },
  }
}

// ── 云端 → 本地结构（回填）──────────────────────────
function cloudToPattern(item) {
  const p = item.payload || {}
  return {
    id: item.id,
    cloudId: item.id,
    url: item.data,
    theme: item.name,
    style: p.style,
    styleLabel: p.styleLabel,
    elements: p.elements,
    keywords: p.keywords,
    density: p.density,
    layout: p.layout,
    filters: p.filters,
    analysis: p.analysis,
    createdAt: p.createdAt || item.created_at,
  }
}

function cloudToModel(item) {
  return {
    name: item.name,
    glbUrl: item.data,
    prompt: item.payload?.prompt,
    intro: item.payload?.intro,
    cloudId: item.id,
  }
}

// 登录成功后调用：游客本地作品合并上云 → 云端回填本地
export async function mergeLocalWorks() {
  try {
    const patterns = readLocal(PATTERN_KEY)
    const models = readLocal(MODEL_KEY)
    const items = [
      ...patterns.filter((w) => w?.url).map(patternToCloud),
      ...models.filter((m) => m?.glbUrl).map(modelToCloud),
    ]
    if (!items.length) return
    await userAPI.mergeWorks(items)
    // 合并成功后以云端为准回填（包含该账号的历史作品）
    await loadCloudWorks()
  } catch {
    // 后端不可用/网络异常时静默失败，本地数据不丢
  }
}

// 拉取云端作品回填本地缓存（checkAuth 恢复登录态时调用，实现换设备同步）
export async function loadCloudWorks() {
  try {
    const data = await userAPI.works()
    const patterns = []
    const models = []
    for (const item of data.works) {
      if (item.type === 'pattern') patterns.push(cloudToPattern(item))
      else if (item.type === 'model3d') models.push(cloudToModel(item))
    }
    writeLocal(PATTERN_KEY, patterns)
    writeLocal(MODEL_KEY, models)
  } catch {
    // 静默失败
  }
}
