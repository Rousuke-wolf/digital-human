// voiceGuide.js — 绫韵语音引导与问候（数字人陪伴体系扩展）
// 机制：
//   · 首次进入导航栏各页面：播报该页介绍（localStorage 记录，仅一次）
//   · 3D展厅 / 纹样共创 / 知识图谱：每次进入随机播报问候语（各 5 条）
//   · 知识图谱：首次切换 2D / 3D / 列表视图各播报一次简短介绍
//   · 纹样共创：点击生成 / 生成成功后各有一句反馈
// 设置（个人中心「语音引导设置」）：
//   · 总开关（默认开启）+ 独立音量（默认 70）
//   · 音量只作用于本模块的播报，不修改 window._ttsSettings（绫韵问答对话音量独立）
import { speak, stop } from '../tts.js'

const SETTINGS_KEY = 'zhichuan-guide-settings'
const SEEN_KEY = 'zhichuan-guide-seen'

const DEFAULT_SETTINGS = { enabled: true, volume: 70 }
const GUIDE_RATE = 1.1   // 引导语速：比对话稍缓一点，便于听清

// ── 设置读写 ──────────────────────────────────────
export function getGuideSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    return { ...DEFAULT_SETTINGS, ...(typeof raw === 'object' && raw ? raw : {}) }
  } catch { return { ...DEFAULT_SETTINGS } }
}

export function saveGuideSettings(patch) {
  const next = { ...getGuideSettings(), ...patch }
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)) } catch {}
  return next
}

// ── 已播报记录（首次进入 / 首次切换）──
function getSeen() {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}')
    return typeof raw === 'object' && raw ? raw : {}
  } catch { return {} }
}

function markSeen(key) {
  const seen = getSeen()
  seen[key] = 1
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)) } catch {}
}

// ── 播报调度（延迟一点等页面渲染完；新播报替换未触发的旧播报）──
let _pendingTimer = null
let _lastScheduledAt = 0

function schedule(text, delay) {
  if (_pendingTimer) { clearTimeout(_pendingTimer); _pendingTimer = null }
  _lastScheduledAt = Date.now()
  _pendingTimer = setTimeout(() => {
    _pendingTimer = null
    guideSpeak(text)
  }, delay)
}

// 最近是否安排过引导播报（绫韵问答页的主动问候用此判断，避免双重语音）
export function guideRecentlyScheduled(ms = 2500) {
  return Date.now() - _lastScheduledAt < ms
}

// 路由切换时取消未触发的播报（防止快节奏跳转后旧页面语音响起）
export function guideClearPending() {
  if (_pendingTimer) { clearTimeout(_pendingTimer); _pendingTimer = null }
}

// 停止当前引导播报（关闭开关时调用）
export function guideStop() {
  stop()
}

// ── 播报入口：设置关闭时静默 ──────────────────────
export function guideSpeak(text) {
  if (!text?.trim()) return
  const s = getGuideSettings()
  if (!s.enabled) return
  speak(text, null, null, null, { volume: Number(s.volume) || 70, rate: GUIDE_RATE })
}

// ── 页面进入：首次播介绍（仅一次）；重点页之后每次随机问候 ──
export function guideOnPageEnter(pageKey) {
  const s = getGuideSettings()
  if (!s.enabled) return

  if (!getSeen()[pageKey]) {
    markSeen(pageKey)
    const intro = PAGE_INTROS[pageKey]
    if (intro) schedule(intro, 600)
    return
  }
  const greetings = PAGE_GREETINGS[pageKey]
  if (greetings?.length) {
    schedule(greetings[Math.floor(Math.random() * greetings.length)], 600)
  }
}

// ── 知识图谱：首次切换到列表视图介绍一次 ──
export function guideOnGraphSwitchList() {
  if (!getGuideSettings().enabled) return
  const key = 'graph-list'
  if (getSeen()[key]) return
  markSeen(key)
  const text = GRAPH_SWITCH_INTROS.list
  if (text) schedule(text, 400)
}

// ── 知识图谱：首次以「图谱视图」看到 3D 星图时介绍一次 ──
// 由 GraphPage 在（renderMode==='3d' 且 viewMode==='graph'）成立时调用；
// 若在列表视图下先选中 3D，则等切回图谱视图时再补播
export function guideOnGraphView3D() {
  if (!getGuideSettings().enabled) return
  const key = 'graph-3d'
  if (getSeen()[key]) return
  markSeen(key)
  const text = GRAPH_SWITCH_INTROS['3d']
  if (text) schedule(text, 400)
}

// ── 纹样共创：生成点击 / 生成成功的反馈 ─────────────
const PATTERN_GEN_LINES = [
  '好的，绫韵这就为你构思纹样，稍等片刻～',
  '收到灵感！绫韵开始创作啦，请耐心等待～',
]

const PATTERN_DONE_LINES = [
  (theme) => `纹样生成好啦！这枚「${theme}」纹样线条流畅、配色讲究，快看看是否合你的心意～`,
  (theme) => `「${theme}」纹样出炉啦！构图和配色都很有非遗韵味，绫韵很喜欢～`,
  () => '新纹样完成！点击图片可以放大欣赏，也可以调整配色、下载或分享给朋友～',
]

export function guidePatternGenerate() {
  guideSpeak(PATTERN_GEN_LINES[Math.floor(Math.random() * PATTERN_GEN_LINES.length)])
}

export function guidePatternDone(theme) {
  const pick = PATTERN_DONE_LINES[Math.floor(Math.random() * PATTERN_DONE_LINES.length)]
  guideSpeak(pick(theme))
}

// ═══ 文案库 ═══════════════════════════════════════

// 首次进入介绍（导航栏全部页面，各播一次）
const PAGE_INTROS = {
  home: '欢迎来到智传非遗！这是一个用数字技术传承刺绣文化的平台。'
    + '你可以通过顶部导航，走进绫韵问答、动画体验、3D 展厅、纹样共创和知识图谱，开启你的非遗探索之旅。',
  culture: '这里是绫韵问答，我是你的非遗刺绣数字人伙伴绫韵。'
    + '关于刺绣的历史、绣种、针法，任何问题都可以随时问我，我会用心为你解答。',
  teaching: '这里是动画体验。绫韵会一步步演示刺绣针法，'
    + '你还可以亲手玩一玩刺绣小游戏，体验一针一线的乐趣。',
  '3d': '欢迎来到 3D 展厅！这里陈列着精美的刺绣展品，'
    + '你可以拖拽旋转、从任意角度欣赏，也可以输入描述，让我为你 AI 生成一件专属的 3D 展品。',
  create: '欢迎来到纹样共创！填写主题和参数，AI 会为你设计专属的非遗刺绣纹样，'
    + '生成后还可以调整配色、下载和分享。',
  graph: '欢迎来到非遗知识图谱！这里的每一颗星点，都是一项非遗刺绣知识。'
    + '这个页面完全由你自由探索——现在你看到的是 2D 宣纸星图，拖拽可以平移，滚轮可以缩放，'
    + '点击星点，看看技艺、民族与图腾之间千丝万缕的关联；页面上方还可以切换到 3D 深空星图和列表视图。',
  about: '这里是关于我们。你可以了解智传非遗的项目简介与使命、核心功能模块，'
    + '以及 AI 数字人、3D 展示等技术亮点。',
  profile: '欢迎来到个人中心！在这里你可以查看每日额度、完成任务领取奖励、管理你的作品，'
    + '还可以在页面下方的语音引导设置里，调整绫韵的问候方式。',
}

// 每次进入的随机问候（三个重点页各 5 条）
const PAGE_GREETINGS = {
  '3d': [
    '你好呀，欢迎来到 3D 展厅，今天想欣赏哪件展品呢？',
    '又见面啦！展厅里的展品可以拖拽旋转，慢慢欣赏哦。',
    '欢迎回来～也可以试试让我 AI 生成一件你想象中的 3D 展品。',
    '这里是刺绣的立体世界，选一件展品，我们开始吧！',
    '绫韵在展厅等你很久啦，快来挑选心仪的展品吧。',
  ],
  create: [
    '欢迎来到纹样共创！今天想创作什么主题的纹样呢？',
    '嗨，创作灵感来了吗？填好参数，绫韵陪你一起设计。',
    '欢迎回来～你的纹样作品都还收藏在这里哦。',
    '想设计一枚独一无二的纹样吗？我们这就开始吧！',
    '绫韵最喜欢和你一起创作了，说说你的灵感吧。',
  ],
  graph: [
    '欢迎回到知识星图，今天从哪颗星点开始探索呢？',
    '星图里的每一颗星点都有故事，点击它们听听看吧。',
    '嗨，准备好探索非遗刺绣的知识宇宙了吗？',
    '欢迎回来～记得探索过的星点会留下名字，轨迹就在页面上方。',
    '这次试试换一种方式逛星图吧，2D 和 3D 星图可以随时切换哦。',
  ],
}

// 知识图谱视图切换介绍（各一次；2D 说明已并入首次进入的页面介绍）
const GRAPH_SWITCH_INTROS = {
  '3d': '这是 3D 深空星图！拖拽可以旋转视角，滚动滚轮可以拉近推远，'
    + '点击星体就能探索它的故事，页面顶部可以随时切回 2D 星图。',
  list: '这是列表视图。非遗技艺、民族文化、图腾纹样按星座分组排列，'
    + '点击任意一项就能进入它的专属介绍。',
}
