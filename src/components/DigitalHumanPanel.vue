<!-- ═══════════════════════════════════════════════════════
  DigitalHumanPanel.vue — 数字人对话面板（悬浮卡片，答辩技术亮点核心）
  对话链路：用户提问 → useKnowledgeBase 检索（RAG）→ 通义千问生成
           → useTTS 多语言合成 → Live2D 口型实时驱动
  离线兜底：预置对话脚本（presetDialogs）+ 知识库数据直答，
           现场断网 / API 抖动也能完整演示「提问 → 回答 → 语音」
  形象方案：AvatarPlayer 双输入 —— 有预录视频段（videoUrl）播视频，
           无视频时降级 Live2D（hiyori 模型 + TTS 振幅口型同步）
  气泡对话（本轮重构）：
     数字人消息居左（绣娘头像 + 气泡 + 时间戳在下），用户消息居右
     （默认图标 + 气泡 + 时间戳在下）；回答以打字机效果写入气泡
  历史持久化：localStorage（ZHICHUAN_FEIYI_CHAT_STORAGE_KEY），
     刷新页面 / 切换路由回来，历史气泡完整恢复（参考悬浮球聊天
     enable-local-storage 的落盘方案：每次消息变更整体覆盖写入）
  props: autoGreet(Boolean) 页面加载后自动展开并播报欢迎语
  expose: ask(question) / askAbout(node)（详情抽屉「与传承人对话」入口）
═══════════════════════════════════════════════════════ -->
<template>
  <div class="dh-wrap">
    <!-- 收起态：圆形数字人按钮 -->
    <Transition name="dh-pop">
      <button v-if="!expanded" class="dh-fab" @click="openPanel">
        <span class="dh-fab-avatar">绣</span>
        <span class="dh-fab-ring"></span>
      </button>
    </Transition>

    <!-- 展开态：对话卡片（v-show 保住 Live2D 画布不销毁） -->
    <Transition name="dh-pop">
      <div v-show="expanded" class="dh-panel" :class="{ 'is-open': expanded }">
        <!-- 头部 -->
        <header class="dh-head">
          <div class="dh-head-info">
            <b class="dh-name">{{ ui().panelTitle }}</b>
            <span class="dh-role">{{ ui().panelSubtitle }}</span>
          </div>
          <span class="dh-live-dot" :class="{ speaking }" :title="speaking ? '正在讲解' : '待命中'"></span>
          <button class="dh-min" title="收起" @click="expanded = false">—</button>
        </header>

        <!-- 数字人形象区（AvatarPlayer：预录视频优先，Live2D 兜底） -->
        <div class="dh-avatar-zone">
          <AvatarPlayer :video-url="activeVideoUrl" :audio-url="activeAudioUrl" :poster="posterUrl">
            <div class="character-3d">
              <canvas id="live2d" style="width: 100%; height: 100%; display: block"></canvas>
            </div>
          </AvatarPlayer>
        </div>

        <!-- 表情切换（模型支持表情数据时由 useLive2D 自动显示） -->
        <div class="emotion-switch">
          <button v-for="e in emotions" :key="e.key" class="emotion-btn" :class="{ active: currentEmotion === e.key }" @click="setEmotion(e.key)">
            {{ e.icon }} <span>{{ e.label }}</span>
          </button>
        </div>

        <!-- 气泡对话区（数字人居左带绣娘头像 / 用户居右带默认图标，时间戳在气泡下方） -->
        <div ref="chatRef" class="dh-chat">
          <p v-if="!messages.length" class="dh-chat-empty">我是绣娘，点上方问题或直接输入提问～</p>
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="dh-msg"
            :class="[msg.role, { typing: msg.typing }]"
          >
            <!-- 绣娘头像（数字人消息居左） -->
            <span v-if="msg.role === 'assistant'" class="dh-avatar dh-avatar-xiu">绣</span>
            <div class="dh-bubble">
              <span v-if="msg.thinking" class="dh-dots" aria-label="正在思考"><i></i><i></i><i></i></span>
              <template v-else>
                {{ msg.content }}<span v-if="msg.typing" class="dh-caret"></span>
              </template>
              <time class="dh-time">{{ msg.time }}</time>
            </div>
            <!-- 用户默认图标（用户消息居右） -->
            <span v-if="msg.role === 'user'" class="dh-avatar dh-avatar-user" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="8" r="4"></circle>
                <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"></path>
              </svg>
            </span>
          </div>
        </div>

        <!-- 预置问题胶囊（离线兜底路径，答辩点一下即演示） -->
        <div class="dh-chips">
          <button v-for="p in presetQuestions" :key="p.id" class="dh-chip" @click="askPreset(p)">{{ p.q }}</button>
        </div>

        <!-- 输入行 -->
        <form class="dh-input-row" @submit.prevent="submitAsk">
          <input v-model="question" class="dh-input" :placeholder="ui().placeholder" maxlength="120" />
          <button type="submit" class="dh-send" :disabled="busy || !question.trim()">➤</button>
        </form>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import AvatarPlayer from './AvatarPlayer.vue'
import { useLocale } from '../composables/useLocale'
import { speakWithLocale, stopSpeaking } from '../composables/useTTS'
import { retrieve, buildContext } from '../composables/useKnowledgeBase'
import { PRESET_DIALOGS } from '../data/presetDialogs'
import { EMBROIDERY_WORKS } from '../data/embroideryWorks'
import { embroideryData } from '../data/embroideryData'
import { initLive2D, destroyLive2D, setEmotion, startLipsync, stopLipsync } from '../composables/useLive2D'

const props = defineProps({
  autoGreet: { type: Boolean, default: false },
})

const { locale, nodeName, welcome, ui } = useLocale()

/* ── 面板状态 ── */
const expanded = ref(false)
const speaking = ref(false)
const busy = ref(false)
const question = ref('')

/* ── 气泡消息（{ id, role: 'user'|'assistant', content, time, thinking?, typing? }） ── */
const messages = ref([])
const chatRef = ref(null)

// 历史落盘键（UPPER_SNAKE_CASE）；单条会话历史上限，防止 localStorage 膨胀
const CHAT_STORAGE_KEY = 'ZHICHUAN_FEIYI_CHAT_STORAGE_KEY'
const HISTORY_MAX = 50

let msgSeq = 0
function genMsgId() {
  msgSeq += 1
  return msgSeq
}

// HH:MM 时间戳（气泡下方）
function formatTime(ts = Date.now()) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 追加一条消息（返回响应式代理，供打字机回填 / thinking 转正；
// ⚠ 必须从数组里取回代理再返回——直接改原始对象不会触发渲染）
function pushMessage(role, content, extra = {}) {
  const msg = { id: genMsgId(), role, content, time: formatTime(), ...extra }
  messages.value.push(msg)
  scrollChat()
  return messages.value[messages.value.length - 1]
}

// 对话区滚到底部（打字机逐字增长时同步跟随）
function scrollChat() {
  requestAnimationFrame(() => {
    const el = chatRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

/* ── 历史持久化：写入整体覆盖（容量小、无需分段），读取失败静默丢弃 ── */
function saveHistory() {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.value.slice(-HISTORY_MAX)))
  } catch {
    // 隐私模式 / 配额超限：静默失败，现场对话不受影响
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return
    messages.value = list
      // 只保留角色合法且有内容的气泡（落盘时正处于「思考中」的空气泡丢弃）
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content !== '')
      .slice(-HISTORY_MAX)
      .map((m) => ({ id: genMsgId(), role: m.role, content: m.content, time: m.time || '' }))
  } catch {
    // 历史损坏：丢弃，重新开始
    messages.value = []
  }
}

/* ── 打字机：回答逐字写入气泡（36ms/2 字，与 TTS 播报并行） ── */
let typeTimer = null
let activeTypeMsg = null
let activeTypeFull = ''

function typeInto(msg, text) {
  clearInterval(typeTimer)
  // 上一段未打完的话直接补全，避免半句残留
  if (activeTypeMsg && activeTypeFull && activeTypeMsg.content !== activeTypeFull) {
    activeTypeMsg.content = activeTypeFull
    activeTypeMsg.typing = false
    saveHistory()
  }
  activeTypeMsg = msg
  activeTypeFull = text
  msg.content = ''
  msg.typing = true
  const chars = [...text]
  let i = 0
  typeTimer = setInterval(() => {
    i = Math.min(chars.length, i + 2)
    msg.content = chars.slice(0, i).join('')
    scrollChat()
    if (i >= chars.length) {
      clearInterval(typeTimer)
      msg.typing = false
      activeTypeMsg = null
      saveHistory()
    }
  }, 36)
}

/* ── 数字人系统提示词（温柔口语化 + RAG 上下文 + 语言指令） ── */
function buildSystemPrompt(contextText) {
  const langHint = {
    zh: '请用温柔亲切的口语化中文回答，控制在 100 字以内。',
    en: 'Please answer in warm, friendly spoken English, within 80 words.',
    ja: '優しく親しみやすい口語の日本語で、100字以内で答えてください。',
    yue: '請用溫柔親切嘅口語粵語回答，100字以內。',
    bo: 'རྒྱ་ནག་གི་ཚེམ་འཁྲིས་སྐོར་ལ་བོད་སྐད་ཀྱིས་ལན་འདེབས་བྱེད་རོགས།',
  }[locale.value] || '请用温柔亲切的口语化中文回答，控制在 100 字以内。'
  return `你是「绣娘」，一位年轻的非遗刺绣数字人讲解员，声音温柔亲切。你只回答刺绣相关问题（流派、针法、传承人、作品、非遗保护），非刺绣话题请礼貌地引导回刺绣。
以下是检索到的刺绣知识库资料，回答时优先依据：
${contextText || '（未检索到相关资料，请基于常识回答）'}
${langHint}
不要使用 markdown，不要列举序号。`
}

/* ── 知识库直答兜底（完全离线可用） ── */
function dataAnswer(chunks, question) {
  const top = chunks[0]
  const node = top ? findNode(top.embroideryId) : null
  if (!node) return fallbackAnswer(question)

  const works = EMBROIDERY_WORKS[node.id] || []
  if (locale.value !== 'zh') {
    // 非中文兜底：流派简介模板（英文/日文预置稿见 presetDialogs）
    return `${nodeName(node)} is one of the twelve great schools of Chinese embroidery. ${works.length ? `Its masterpiece "${works[0].name}" shows the finest stitches of the craft.` : ''} Let me tell you more — just click the star again.`
  }
  const parts = [
    `${node.name}，${node.slogan}。`,
    (node.features || [])[0] || '',
    works.length ? `代表作品「${works[0].name}」，${works[0].desc}。` : '',
    '我是绣娘，想听更多针法故事，随时问我～',
  ]
  return parts.filter(Boolean).join('')
}

function findNode(id) {
  return embroideryData.nodes.find((n) => n.id === id) || null
}

function fallbackAnswer(question) {
  return locale.value === 'zh'
    ? `这个问题我记下了——关于「${question.slice(0, 24)}」，我建议先看看图谱里的十二大流派。我是绣娘，点击任意星辰，我来讲给你听。`
    : 'Good question! Let me find it in my embroidery library. Please click any star on the graph and I will tell you its story.'
}

/* ── 回答获取：预置脚本 → 大模型(RAG) → 知识库直答 ── */
async function getAnswer(q) {
  // ① 预置脚本精确命中（答辩最稳定路径，中英日全覆盖）
  const preset = (PRESET_DIALOGS[locale.value] || []).find((p) => p.q === q)
  if (preset) return preset.a

  // ② 知识库检索 + 大模型生成
  const chunks = retrieve(q, 3)
  const contextText = buildContext(chunks)
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen-turbo',
        messages: [
          { role: 'system', content: buildSystemPrompt(contextText) },
          { role: 'user', content: q },
        ],
      }),
    })
    const completion = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(completion.message || `AI 请求失败 ${res.status}`)
    const answer = completion.choices?.[0]?.message?.content?.trim()
    if (answer) return answer
    throw new Error('AI 返回为空')
  } catch {
    // ③ 离线兜底：知识库数据直答
    return dataAnswer(chunks, q)
  }
}

/* ── 完整链路：用户气泡 → 思考气泡 → 回答打字机 → TTS → 口型 ── */
async function runDialog(q) {
  const text = (q || '').trim()
  if (!text || busy.value) return
  busy.value = true
  stopSpeaking()

  // 用户消息居右入列 + 落盘
  pushMessage('user', text)
  saveHistory()
  // 数字人先亮「思考中」气泡
  const answerMsg = pushMessage('assistant', '', { thinking: true })

  try {
    const answer = await getAnswer(text)
    answerMsg.thinking = false
    speaking.value = true
    typeInto(answerMsg, answer)
    speakWithLocale(answer, locale.value, {
      onStart: () => startLipsync(),
      onEnd: () => {
        speaking.value = false
        stopLipsync()
      },
    })
  } catch {
    answerMsg.thinking = false
    answerMsg.content = ui().thinking
    saveHistory()
  } finally {
    busy.value = false
  }
}

function submitAsk() {
  runDialog(question.value)
  question.value = ''
}

function askPreset(preset) {
  runDialog(preset.q)
}

/** 抽屉「与传承人对话」入口：针对指定流派发起讲解 */
function askAbout(node) {
  expanded.value = true
  ensureLive2D()
  const zhQ = `请介绍${node.name}的特色和代表作品`
  // 非中文场景用流派名组织提问，回答走 RAG + 兜底模板
  runDialog(locale.value === 'zh' ? zhQ : `Tell me about ${nodeName(node)}`)
}

/* ── 欢迎语（开场 + 语言切换时用新语言重播，作为第一条数字人气泡） ── */
function greet() {
  expanded.value = true
  ensureLive2D()
  stopSpeaking()
  const text = welcome()
  const msg = pushMessage('assistant', '')
  speaking.value = true
  typeInto(msg, text)
  speakWithLocale(text, locale.value, {
    onStart: () => startLipsync(),
    onEnd: () => {
      speaking.value = false
      stopLipsync()
    },
  })
}

function openPanel() {
  expanded.value = true
  ensureLive2D()
  scrollChat()
}

/* ── Live2D 懒初始化（画布需可见，收起态下尺寸为 0） ── */
let live2dReady = false
function ensureLive2D() {
  if (live2dReady) return
  live2dReady = true
  initLive2D()
}

// AvatarPlayer 双输入：答辩现场用 Live2D 兜底；
// 后续录制传承人讲解视频后，把 mp4/mp3 放入 public/avatars/ 并填充这两个 ref
const activeVideoUrl = ref('')
const activeAudioUrl = ref('')
const posterUrl = ref('')

const emotions = [
  { key: 'happy', icon: '😊', label: '开心' },
  { key: 'gentle', icon: '🥰', label: '温柔' },
  { key: 'thoughtful', icon: '🤔', label: '思考' },
]
const currentEmotion = ref('gentle')

const presetQuestions = computed(() => PRESET_DIALOGS[locale.value] || PRESET_DIALOGS.zh)

watch(locale, () => {
  // 语言切换 → 数字人立即用新语言打招呼（答辩亮点：欢迎语同步变化）
  if (expanded.value) greet()
})

onMounted(() => {
  // 先恢复历史气泡（刷新 / 路由切换回来完整还原），再决定是否开场问候
  loadHistory()
  if (props.autoGreet) {
    // 开场镜头 2.4s 推近后，数字人登场问候
    setTimeout(() => {
      if (!expanded.value) greet()
    }, 2600)
  }
})

onBeforeUnmount(() => {
  clearInterval(typeTimer)
  stopSpeaking()
  destroyLive2D()
})

defineExpose({ ask: runDialog, askAbout, greet })
</script>

<style scoped lang="scss">
@use '../styles/variables.scss' as *;

/* 对齐锚点由首页 .graph-hero 注入（CSS 变量沿 DOM 树继承）：
   顶部与 3D 图谱区上沿平齐，底部与图谱区下沿平齐（左右平衡版式） */
.dh-wrap {
  position: fixed;
  top: var(--dh-top, auto);
  right: 20px;
  bottom: var(--dh-bottom, 96px);
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: flex-end;
}

/* ── 收起态圆形按钮 ── */
.dh-fab {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 1px solid $color-glass-border;
  background: $color-glass;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  cursor: pointer;
  box-shadow: $color-shadow-deep;
  transition: transform 0.25s ease;

  &:hover {
    transform: scale(1.06);
  }
}

.dh-fab-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  margin: 8px auto 0;
  border-radius: 50%;
  background: radial-gradient(circle at 34% 28%, $jade-700, $color-bg-card 72%);
  color: $color-accent-gold-pale;
  font-family: $font-title;
  font-size: $font-size-h2;
}

.dh-fab-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 1px solid $color-gold-halo;
  animation: dh-ring-pulse 2.6s ease-out infinite;
  pointer-events: none;
}

@keyframes dh-ring-pulse {
  0% {
    transform: scale(0.96);
    opacity: 0.8;
  }
  70% {
    transform: scale(1.18);
    opacity: 0;
  }
  100% {
    transform: scale(1.18);
    opacity: 0;
  }
}

/* ── 展开态卡片（高度撑满对齐区：毛玻璃 + 极细鎏金边框） ── */
.dh-panel {
  width: 348px;
  height: 100%;
  border-radius: 22px;
  background: $color-glass;
  border: 1px solid $color-glass-border;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: $color-shadow-deep;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dh-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px 10px;
}

.dh-head-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.dh-name {
  font-family: $font-title;
  font-size: $font-size-h2;
  font-weight: 400;
  letter-spacing: 3px;
  color: $color-accent-gold-pale;
}

.dh-role {
  font-size: $font-size-tiny;
  letter-spacing: 2px;
  color: $color-text-secondary;
}

.dh-live-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: $color-text-secondary;
  transition: background 0.3s;

  &.speaking {
    background: $color-accent-cinnabar;
    box-shadow: 0 0 10px $color-accent-cinnabar;
    animation: dh-blink 1s ease-in-out infinite;
  }
}

@keyframes dh-blink {
  50% {
    opacity: 0.35;
  }
}

.dh-min {
  border: none;
  background: transparent;
  color: $color-text-secondary;
  font-size: $font-size-h3;
  cursor: pointer;
  padding: 2px 6px;

  &:hover {
    color: $color-accent-gold-pale;
  }
}

/* ── 数字人形象区（弹性高度：面板整体对齐图谱区，绣娘形象不变） ── */
.dh-avatar-zone {
  position: relative;
  flex: 1;
  min-height: 170px;
  margin: 0 14px;
  border-radius: 16px;
  overflow: hidden;
  background:
    radial-gradient(340px 220px at 50% 22%, $color-gold-glow, transparent 70%),
    radial-gradient(300px 200px at 50% 100%, rgba($color-bg-card, 0.65), transparent 75%),
    linear-gradient(180deg, $color-bg-card, $color-bg-deep);
  border: 1px solid $color-glass-border;
}

.character-3d {
  width: 100%;
  height: 100%;
}

/* 表情切换条（模型支持表情时由 useLive2D 显示） */
.emotion-switch {
  display: none;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px 0;
}

.emotion-btn {
  border: 1px solid $color-gold-soft-border;
  background: $color-jade-deep;
  color: $color-text-secondary;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: $font-size-tiny;
  cursor: pointer;

  &.active {
    color: $color-accent-gold-pale;
    border-color: $color-accent-gold;
  }
}

/* ── 气泡对话区（可滚动；数字人居左 / 用户居右，时间戳在气泡下方） ── */
.dh-chat {
  flex: 1;
  min-height: 90px;
  overflow-y: auto;
  padding: 6px 16px 4px;
  scrollbar-width: thin;
  scrollbar-color: $color-gold-line transparent;

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-thumb {
    background: $color-gold-line;
    border-radius: 3px;
  }
}

.dh-chat-empty {
  margin: 14px 0;
  text-align: center;
  color: $color-text-secondary;
  font-size: $font-size-caption;
  letter-spacing: 1px;
}

.dh-msg {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;

  // 用户消息：气泡在左、头像在右（整体靠右）
  &.user {
    flex-direction: row-reverse;
  }
}

/* 头像：绣娘（鎏金底墨绿字）/ 用户（石青底淡金人形图标） */
.dh-avatar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.dh-avatar-xiu {
  background: linear-gradient(135deg, $color-accent-gold, $color-accent-gold-deep);
  color: $color-bg-deep;
  font-family: $font-title;
  font-size: $font-size-body-lg;
  box-shadow: 0 2px 8px $color-gold-halo;
}

.dh-avatar-user {
  background: rgba($color-accent-azurite, 0.55);
  color: $color-ivory-dim;
  border: 1px solid $color-gold-line;

  svg {
    width: 16px;
    height: 16px;
  }
}

/* 气泡：深墨绿底 + 弱金描边；用户气泡带石青调以示区分 */
.dh-bubble {
  max-width: 78%;
  padding: 8px 12px;
  border-radius: 14px;
  background: $color-jade-deep;
  border: 1px solid $color-gold-faint;
  color: $color-text-primary;
  font-size: $font-size-body-sm;
  line-height: 1.7;
  word-break: break-word;
  white-space: pre-wrap;

  .user & {
    background: rgba($color-accent-azurite, 0.38);
    border-color: $color-gold-line;
  }
}

/* 时间戳：气泡下方（跟随消息侧对齐） */
.dh-time {
  display: block;
  margin-top: 4px;
  font-size: $font-size-tiny;
  color: $color-text-secondary;
  opacity: 0.75;
  text-align: right;

  .user & {
    text-align: left;
  }
}

/* 思考中：三点跳动 */
.dh-dots {
  display: inline-flex;
  gap: 4px;
  padding: 4px 2px;

  i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: $color-accent-gold-pale;
    animation: dh-dot-bounce 1.1s ease-in-out infinite;

    &:nth-child(2) {
      animation-delay: 0.15s;
    }

    &:nth-child(3) {
      animation-delay: 0.3s;
    }
  }
}

@keyframes dh-dot-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

/* 打字机光标 */
.dh-caret {
  display: inline-block;
  width: 2px;
  height: 13px;
  margin-left: 2px;
  background: $color-accent-gold;
  vertical-align: -2px;
  animation: dh-blink 0.9s step-end infinite;
}

/* ── 预置问题胶囊 ── */
.dh-chips {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 18px 8px;
}

.dh-chip {
  text-align: left;
  border: 1px solid $color-gold-line;
  background: $color-jade-chip;
  color: $color-accent-gold-pale;
  border-radius: 999px;
  padding: 6px 14px;
  font-size: $font-size-caption;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.2s;

  &:hover {
    border-color: $color-accent-gold;
    background: $color-gold-glow;
  }
}

/* ── 输入行 ── */
.dh-input-row {
  display: flex;
  gap: 8px;
  padding: 0 18px 16px;
}

.dh-input {
  flex: 1;
  border: 1px solid $color-gold-soft-border;
  background: $color-jade-deep;
  color: $color-text-primary;
  border-radius: 999px;
  padding: 9px 16px;
  font-size: $font-size-body-sm;
  outline: none;

  &:focus {
    border-color: $color-accent-gold;
  }

  &::placeholder {
    color: $color-text-secondary;
  }
}

.dh-send {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, $color-accent-gold, $color-accent-gold-deep);
  color: $color-bg-deep;
  font-size: $font-size-body;
  cursor: pointer;
  transition: transform 0.2s;

  &:hover:not(:disabled) {
    transform: scale(1.08);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

/* ── 弹出过渡 ── */
.dh-pop-enter-active,
.dh-pop-leave-active {
  transition: all 0.28s cubic-bezier(0.34, 1.4, 0.64, 1);
}

.dh-pop-enter-from,
.dh-pop-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.94);
}

/* ── 移动端 / 低高度屏 ── */
@media (max-width: 640px) {
  .dh-wrap {
    right: 10px;
  }

  .dh-panel {
    width: min(92vw, 348px);
  }

  .dh-avatar-zone {
    min-height: 130px;
  }

  .dh-chips {
    display: none; // 窄屏空间有限，收起预置胶囊
  }
}

@media (max-height: 700px) {
  .dh-chips {
    display: none;
  }

  .dh-avatar-zone {
    min-height: 110px;
  }

  .dh-chat {
    min-height: 70px;
  }
}
</style>
