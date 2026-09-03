// 共享可变状态（避免 main.js ↔ show3D/index.js 循环引用）
//
// generatedModels：用户通过 Meshy 文生 3D 成功生成的展品。
// 持久化到 localStorage，刷新后仍出现在预设下拉框「我的生成」分组里。
// 每条：{ name, glbUrl, prompt, intro }

const STORAGE_KEY = 'zhichuan-generated-models'

function loadGeneratedModels() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function persistGeneratedModels() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.generatedModels))
  } catch {
    // 存储满/隐私模式等场景静默失败，不影响本次会话使用
  }
}

export const appState = {
  currentModelIndex: 0,
  _modelHasContent: false,
  generatedModels: loadGeneratedModels(),
}

// 新增/更新生成记录（按 glbUrl 去重），并持久化
export function upsertGeneratedModel({ name, glbUrl, prompt, intro = null }) {
  const existing = appState.generatedModels.find((m) => m.glbUrl === glbUrl)
  if (existing) {
    existing.name = name
    existing.prompt = prompt
    if (intro) existing.intro = intro
  } else {
    appState.generatedModels.push({ name, glbUrl, prompt, intro })
  }
  persistGeneratedModels()
}

// 生成介绍补全后回写（AI 介绍异步生成）
export function setGeneratedIntro(glbUrl, intro) {
  const m = appState.generatedModels.find((x) => x.glbUrl === glbUrl)
  if (m) {
    m.intro = intro
    persistGeneratedModels()
  }
}
