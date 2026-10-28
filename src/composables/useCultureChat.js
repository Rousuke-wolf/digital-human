// useCultureChat.js — 文化页数字人聊天核心（模块级单例）
// 从原 script.js 全局函数迁移而来：
//   原：window.quickQuestion / window._ttsSettings / getElementById 全局查找 DOM
//   现：ChatPanel / KnowledgeCards / VoiceOverlay 直接 import 本模块共享同一份状态
//
// DOM 由 ChatPanel 通过 registerChatUI 注册（组件卸载时注销），
// 其余组件只调用方法、不碰 DOM。

import { ref, reactive } from 'vue'
import { chatWithAIStream, generateImage, systemPrompt } from '../api/qwen.js'
import { speak, stop, pause, resume } from '../tts.js'
import { startLipsync, stopLipsync } from './useLive2D.js'
import { openImagePreview } from '../utils/lightboxBus.js'
import { goToExhibit } from '../utils/navigation.js'
import { getTimeGreeting, getFestival, getVoiceGreeting } from '../utils/companion.js'
import { guideRecentlyScheduled } from '../utils/voiceGuide.js'
import { useLoginPrompt } from './useLoginPrompt.js'
import { createChatSessionStore } from './useChatSessions.js'

function readBubbleMessages(container) {
  return [...container.querySelectorAll('.message')]
    .filter(el => !el.matches('.greeting-bubble, .companion-bubble, .welcome-bubble, .thinking'))
    .map(el => {
      const clone = el.cloneNode(true)
      clone.querySelectorAll('.ai-image-loading, .ai-image-skeleton').forEach(n => n.remove())
      clone.querySelectorAll('br').forEach(n => n.replaceWith('\n'))
      return {
        role: el.classList.contains('user') ? 'user' : el.classList.contains('system-notice') ? 'notice' : 'assistant',
        content: clone.textContent || '',
        imageUrl: el.querySelector('img.ai-generated-image')?.getAttribute('src') || '',
      }
    }).filter(m => m.content.trim() || m.imageUrl)
}

let sessionStorage
try { sessionStorage = window.localStorage } catch { /* In-memory mode remains available. */ }
export const chatSessions = createChatSessionStore({
  storage: sessionStorage,
  parseLegacy: html => typeof html === 'string'
    ? readBubbleMessages(new DOMParser().parseFromString(html, 'text/html')) : [],
})

// 全局登录引导弹窗（与 App.vue 的 LoginPromptModal 共用同一份状态）
const { promptLogin } = useLoginPrompt()

// ── 共享响应式状态 ──────────────────────────────────
export const inputLocked = ref(false)   // 回复进行中：锁定输入与知识卡片
export const voiceModeActive = ref(false)  // 语音聊天模式（Live2D 缩放/页面布局联动）
export const ttsPlaying = ref(false)    // TTS 播放中（暂停/停止按钮高亮）
export const ttsPaused = ref(false)     // TTS 已暂停（暂停按钮 ▶/⏸ 文字）

// 语音设置：必须是响应式对象（v-model 绑定的数值显示依赖它触发重渲染）
// tts.js 在 speak 时仍读取 window._ttsSettings，后续批次改为模块直读
export const ttsSettings = reactive({ volume: 50, rate: 1.2 })
window._ttsSettings = ttsSettings

// ── 模块内部状态 ────────────────────────────────────
const MAX_HISTORY_ROUNDS = 6

let _chatEl = null      // 聊天历史容器（ChatPanel 注册）
let _inputEl = null     // 文本输入框（ChatPanel 注册）

let _historyMessages = [
  { role: 'system', content: systemPrompt.trim() },
]

let _replyStopped = false
let _streamGeneration = 0
let _replyController = null

let _typingTimer = null
let _typingPaused = false
let _typingResume = null
let _typingResolve = null

let _greetVoiceTimer = null   // 语音问好的 1 秒延迟定时器

// 会话以结构化消息保存，不再持久化/恢复任意 HTML。

// ── 情感化陪伴：已问候文案记录（localStorage，同一文案只触发一次）──
const USED_GREETINGS_KEY = 'zhichuan-used-greetings'

function _usedGreetings() {
  try {
    const raw = localStorage.getItem(USED_GREETINGS_KEY)
    const data = raw ? JSON.parse(raw) : []
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

function _markGreetingUsed(text) {
  try {
    const used = _usedGreetings()
    if (!used.includes(text)) {
      used.push(text)
      localStorage.setItem(USED_GREETINGS_KEY, JSON.stringify(used))
    }
  } catch {}
}

function persistChat() {
  if (!_chatEl) return
  chatSessions.updateConversation({ messages: readBubbleMessages(_chatEl), context: _historyMessages })
}

function createChatImage(url) {
  const img = document.createElement('img')
  img.src = url
  img.alt = '刺绣配图'
  img.className = 'ai-generated-image'
  img.style.cssText = 'display:block;max-width:100%;border-radius:10px;margin-top:10px;cursor:zoom-in;'
  img.onclick = () => openImagePreview(url)
  return img
}

function restoreSession() {
  const session = chatSessions.activeSession.value
  _historyMessages = [{ role: 'system', content: systemPrompt.trim() }, ...(session?.context || [])]
  if (!_chatEl) return
  // 保留原欢迎卡片，只重建消息；innerText 安全还原文本与换行，不执行存档 HTML。
  _chatEl.querySelectorAll('.message').forEach(n => n.remove())
  for (const message of session?.messages || []) {
    const div = document.createElement('div')
    div.className = `message ${message.role === 'user' ? 'user' : 'ai'}${message.role === 'notice' ? ' system-notice' : ''}`
    div.innerText = message.content
    if (message.imageUrl) div.appendChild(createChatImage(message.imageUrl))
    _chatEl.appendChild(div)
  }
  _chatEl.scrollTop = _chatEl.scrollHeight
}

export function createConversation() {
  stopAll()
  const id = chatSessions.createSession()
  restoreSession()
  return id
}

export function switchConversation(id) {
  if (id === chatSessions.activeSessionId.value || !chatSessions.sessions.value.some(s => s.id === id)) return
  stopAll()
  chatSessions.selectSession(id)
  restoreSession()
}

export function deleteConversation(id) {
  const deletingActive = id === chatSessions.activeSessionId.value
  if (deletingActive) stopAll()
  chatSessions.deleteSession(id)
  if (deletingActive) restoreSession()
}

// ── DOM 注册（ChatPanel onMounted / onBeforeUnmount 调用）──
export function registerChatUI({ chatEl, inputEl }) {
  _chatEl = chatEl
  _inputEl = inputEl
  restoreSession()
  maybeGreet()
  window.addEventListener('pagehide', stopAll)
}

export function unregisterChatUI() {
  window.removeEventListener('pagehide', stopAll)
  // 卸载前先中断并保存，异步回调不能写入下一次挂载的会话。
  stopAll()
  _chatEl = null
  _inputEl = null
}

// ── 情感化陪伴：追加问候气泡（普通 AI 气泡样式，仅文字不触发 TTS）──
function _appendGreetingBubble(text) {
  if (!_chatEl) return
  const div = document.createElement('div')
  div.className = 'message ai greeting-bubble'
  div.innerText = text
  _chatEl.appendChild(div)
  _chatEl.scrollTop = _chatEl.scrollHeight
  persistChat()
}

// ── 系统提示气泡（额度超限等非对话内容）──
function _appendSystemNotice(text) {
  if (!_chatEl) return
  const div = document.createElement('div')
  div.className = 'message ai system-notice'
  div.innerText = text
  _chatEl.appendChild(div)
  _chatEl.scrollTop = _chatEl.scrollHeight
  persistChat()
}

// ── 额度/登录类错误处理（必做项 4）──
// LOGIN_REQUIRED / GUEST_QUOTA_EXCEEDED → 登录引导弹窗（游客）
// QUOTA_EXCEEDED → 登录用户额度用完，系统气泡提示（不引导登录）
function handleAIError(err) {
  if (err?.code === 'LOGIN_REQUIRED' || err?.code === 'GUEST_QUOTA_EXCEEDED') {
    promptLogin('chat')
    return
  }
  _appendSystemNotice(err?.message || '绣娘正在穿针引线，请稍后再试')
}

// 进入文化页时调用：文字问候（时间段 + 节日）+ 1 秒后语音问好
// 同一文案（如「晚上好～」）在本地记录中出现过一次后不再触发，语音同理
function maybeGreet() {
  if (!_chatEl) return
  // 幂等：先移除已有问候气泡（热更重挂载/历史恢复场景），保证同时只有一组问候
  _chatEl.querySelectorAll('.greeting-bubble, .companion-bubble').forEach((n) => n.remove())

  const used = _usedGreetings()
  const fest = getFestival()

  // 文字问候：该文案未出现过才追加
  const timeText = getTimeGreeting()
  if (!used.includes(timeText)) {
    _appendGreetingBubble(timeText)
    _markGreetingUsed(timeText)
  }
  if (fest && !used.includes(fest.greeting)) {
    _appendGreetingBubble(fest.greeting)
    _markGreetingUsed(fest.greeting)
  }

  // 语音问好：该文案未播过才播
  _greetVoiceTimer = setTimeout(() => {
    _greetVoiceTimer = null
    // 用户已开始提问或已有语音在播：不打扰
    if (!_chatEl || inputLocked.value || ttsPlaying.value) return
    // 语音引导刚安排过（首次进入的页面介绍）：不重复语音问好
    if (guideRecentlyScheduled()) return
    const text = getVoiceGreeting()
    if (_usedGreetings().includes(text)) return
    _markGreetingUsed(text)
    speak(text, null, null, () => {
      // 语音问好播完：复位播报状态与嘴型
      ttsPlaying.value = false
      stopLipsync()
    })
    startLipsync()
    ttsPlaying.value = true
  }, 1000)
}

// ── 清空对话（ChatPanel「清空对话」按钮）──
export function clearChat() {
  stopAll()
  chatSessions.clearSession()
  restoreSession()
}

// ── 历史裁剪：system + 最近 6 轮（12 条）──
function trimHistory() {
  const sys = _historyMessages[0]
  const rest = _historyMessages.slice(1)
  const limit = MAX_HISTORY_ROUNDS * 2
  if (rest.length > limit) {
    _historyMessages = [sys, ...rest.slice(rest.length - limit)]
  }
}

function getContextForAPI() {
  const sys = _historyMessages[0]
  const rest = _historyMessages.slice(1)
  const limit = MAX_HISTORY_ROUNDS * 2
  const trimmed = rest.length > limit ? rest.slice(rest.length - limit) : rest
  return [sys, ...trimmed]
}

// ── 输入锁 ──────────────────────────────────────────
function lockInput() {
  _replyStopped = false
  inputLocked.value = true
}

function unlockInput() {
  _replyStopped = true
  inputLocked.value = false
}

// ── 打字机暂停/恢复/停止 ────────────────────────────
function pauseTyping() {
  _typingPaused = true
  if (_typingTimer) { clearTimeout(_typingTimer); _typingTimer = null }
}

function resumeTyping() {
  if (!_typingPaused) return
  _typingPaused = false
  if (_typingResume) {
    const r = _typingResume
    _typingResume = null
    r()
  }
}

function stopTyping() {
  _typingPaused = false
  _typingResume = null
  if (_typingTimer) { clearTimeout(_typingTimer); _typingTimer = null }
  if (_typingResolve) { _typingResolve(); _typingResolve = null }
}

// ── 打断当前输出（停止语音 + 打字）──
export function interruptCurrent() {
  stop()
  stopTyping()
  stopLipsync()
  ttsPlaying.value = false
}

// ── TTS 暂停/继续（ChatPanel 按钮用）──
export function toggleTtsPause() {
  if (ttsPaused.value) {
    resume()
    resumeTyping()
    ttsPaused.value = false
  } else {
    pause()
    pauseTyping()
    ttsPaused.value = true
  }
}

// ── TTS 停止 + 中断流式输出 ─────────────────────────
export function stopAll() {
  _streamGeneration++   // 使进行中的 appendAIStream 失效
  _replyController?.abort()
  _replyController = null
  if (_greetVoiceTimer) { clearTimeout(_greetVoiceTimer); _greetVoiceTimer = null }
  stop()
  stopTyping()
  stopLipsync()
  ttsPlaying.value = false
  ttsPaused.value = false
  unlockInput()
  removeThinking()
  persistChat()
}

// ── 气泡 DOM 操作（仅操作注册的聊天容器）──
function appendThinking() {
  if (!_chatEl) return
  const div = document.createElement('div')
  div.className = 'message thinking'
  div.id = 'thinkingBubble'
  div.innerHTML = `
        <div class="thinking-dots"><span></span><span></span><span></span></div>
        <span>正在思考...</span>
    `
  _chatEl.appendChild(div)
  _chatEl.scrollTop = _chatEl.scrollHeight
}

function removeThinking() {
  document.getElementById('thinkingBubble')?.remove()
}

function appendUser(text) {
  if (!_chatEl) return
  const div = document.createElement('div')
  div.className = 'message user'
  div.innerText = text
  _chatEl.appendChild(div)
  _chatEl.scrollTop = _chatEl.scrollHeight
  persistChat()
}

// ── 3D 展品联动（isShowModel 时跳 3D 展厅）──
function handleModelDisplay(index) {
  goToExhibit(index)
}

// ─────────────────────────────────────────────
// 流式接收 AI 回复，收完后同步启动打字 + TTS
// ─────────────────────────────────────────────
async function appendAIStream(historyMessages, userInput, onDone, myGen) {
  const isAborted = () => _streamGeneration !== myGen

  removeThinking()
  if (!_chatEl) return

  const div = document.createElement('div')
  div.className = 'message ai'
  // 注意：此处不立即设置 id，等到打字阶段才设置
  // 避免 div 在 DOM 中但未开始打字时，id 泄漏给其他调用的 tick
  _chatEl.appendChild(div)
  _chatEl.scrollTop = _chatEl.scrollHeight

  // ── 阶段一：流式接收，仅缓冲字符 ────────────
  let collectedMessage = ''
  let finalData = null

  _replyController = new AbortController()
  const stream = chatWithAIStream(historyMessages, userInput, { signal: _replyController.signal })
  try {
    for await (const chunk of stream) {
      if (isAborted()) break
      if (chunk.__done) { finalData = chunk; break }
      const chars = chunk.__message != null
        ? [chunk.__message]
        : [...(chunk.delta ?? '')]
      for (const c of chars) { if (c) collectedMessage += c }
    }
  } catch (err) {
    // 额度/登录类错误：气泡已创建但无内容，先移除再上抛给 _send 处理
    div.remove()
    throw err
  }

  // ── 被终止：移除空气泡，干净退出 ─────────────
  if (isAborted()) {
    div.remove()
    return
  }

  // ── 兜底：状态机未提取时用 finalData.message ──
  if (!collectedMessage.trim() && finalData?.message) {
    collectedMessage = finalData.message
  }
  if (!collectedMessage.trim()) {
    div.remove()
    return
  }

  // ── 阶段二：TTS 先启动，打字延迟等待 ─────────
  speak(collectedMessage)
  startLipsync()
  ttsPlaying.value = true

  const TTS_STARTUP_MS = 350
  const rate = ttsSettings.rate ?? 1.2
  const CHAR_INTERVAL = Math.max(30, Math.round(1000 / (rate * 4.2)))

  await new Promise(r => setTimeout(r, TTS_STARTUP_MS))

  if (isAborted()) {
    div.remove()
    return
  }

  // ── 阶段三：打字 ─────────────────────────────
  const charArray = [...collectedMessage]
  let i = 0

  // 打字开始时才挂 id，结束或中断时立即摘掉
  // 保证同一时刻 DOM 里最多只有一个 _typingBubble
  div.id = '_typingBubble'

  stopTyping()
  await new Promise(resolve => {
    _typingResolve = resolve

    ;(function tick() {
      // ── 每次 tick 开头都注册自己，确保 pause/resume 可用 ──
      _typingResume = tick

      if (_typingPaused) return   // 暂停：_typingResume 已注册，等 resumeTyping 调用

      // 检测外部 stop：立即结束
      if (isAborted()) {
        div.id = ''             // 摘掉 id，防止 id 泄漏
        _typingResume = null
        resolve()
        return
      }

      if (i < charArray.length) {
        // 始终用 div 直接写，不依赖 getElementById（更安全）
        div.innerText = collectedMessage.slice(0, ++i)
        if (_chatEl) _chatEl.scrollTop = _chatEl.scrollHeight
        _typingTimer = setTimeout(tick, CHAR_INTERVAL)
      } else {
        // 正常打完
        div.id = ''
        _typingResume = null
        stopTyping()
        resolve()
      }
    })()
  })

  // ── 无论以何种方式退出打字，都确保 id 被清除 ──
  div.id = ''
  if (isAborted()) return

  ttsPlaying.value = false
  stopLipsync()

  if (finalData) {
    if (typeof onDone === 'function') onDone(finalData)
    persistChat()
    if (finalData.isShowModel) handleModelDisplay(finalData.modelIndex)

    // ── 图片生成：打字完成后异步追加到同一气泡 ──
    // 不阻塞主流程，用户可以继续聊天，图片加载好后自动出现
    if (finalData.isGenerateImage && finalData.imagePrompt) {
      appendImageToDiv(div, finalData.imagePrompt)
    }
  }
  persistChat()
}

// ─────────────────────────────────────────────
// 图片生成并追加到指定气泡 div
// ─────────────────────────────────────────────
async function appendImageToDiv(div, imagePrompt) {
  const sessionId = chatSessions.activeSessionId.value
  const isCurrent = () => chatSessions.activeSessionId.value === sessionId && _chatEl?.contains(div)
  if (!isCurrent()) return
  // 先在气泡底部插入骨架占位
  const placeholder = document.createElement('div')
  placeholder.className = 'ai-image-loading'
  placeholder.style.cssText = 'display:flex;align-items:center;margin-top:10px;padding:6px 0;'
  placeholder.innerHTML = `
        <div class="ai-image-skeleton" style="display:flex;align-items:center;">
            <span class="ai-image-loading-dot"></span>
            <span class="ai-image-loading-dot"></span>
            <span class="ai-image-loading-dot"></span>
            <span style="margin-left:8px;font-size:12px;color:#999;">正在生成图片，约需15秒…</span>
        </div>`
  div.appendChild(placeholder)
  if (_chatEl) _chatEl.scrollTop = _chatEl.scrollHeight

  try {
    const url = await generateImage(imagePrompt)
    if (!isCurrent()) return
    placeholder.remove()

    if (!url) {
      console.warn('图片生成失败，跳过展示')
      return
    }

    // 与历史恢复共用图片节点创建逻辑，恢复后依旧支持放大。
    div.appendChild(createChatImage(url))
    if (_chatEl) _chatEl.scrollTop = _chatEl.scrollHeight
    persistChat()

  } catch (err) {
    if (!isCurrent()) return
    placeholder.remove()
    // 额度/登录类错误：游客引导登录，登录用户提示额度（必做项 4）
    if (err?.code === 'LOGIN_REQUIRED') {
      promptLogin('image')
      persistChat()
      return
    }
    _appendSystemNotice(err?.message || '图片生成失败，请稍后再试')
    persistChat()
  }
}

// onDone 回调里统一记录历史（sendMessage / quickQuestion / 语音共用）
function _onAIDone(userText, resMsg) {
  _historyMessages.push({ role: 'user', content: userText })
  _historyMessages.push({ role: 'assistant', content: resMsg })
  trimHistory()
}

// ─────────────────────────────────────────────
// 发送入口：文本 / 快捷卡片 / 语音结果统一走这里
// ─────────────────────────────────────────────
async function _send(text, { clearInput = true } = {}) {
  if (!text?.trim() || !_chatEl) return

  // 先打断当前输出，generation 同时隔离请求、打字、错误提示与解锁回调。
  stopAll()
  const myGen = ++_streamGeneration
  lockInput()
  appendUser(text)
  chatSessions.updateDraft(clearInput ? '' : text)
  appendThinking()
  try {
    await appendAIStream(getContextForAPI(), text, (res) => {
      _onAIDone(text, res.message)
    }, myGen)
  } catch (err) {
    if (myGen !== _streamGeneration) return
    removeThinking()
    handleAIError(err)
  }
  if (myGen !== _streamGeneration) return
  _replyController = null
  if (!_replyStopped) {
    unlockInput()
    _inputEl?.focus()
  }
}

// 文本输入框发送（ChatPanel）
export function sendMessage(text) {
  return _send(text, { clearInput: true })
}

// 知识卡片快捷提问（KnowledgeCards）
export function quickQuestion(question) {
  if (inputLocked.value) return
  return _send(question, { clearInput: false })
}

// 语音识别结果（VoiceOverlay）
export function handleVoiceResult(text) {
  return _send(text, { clearInput: false })
}
