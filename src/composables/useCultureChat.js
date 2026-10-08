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

let _typingTimer = null
let _typingPaused = false
let _typingResume = null
let _typingResolve = null

// ── 对话持久化（localStorage：气泡 HTML + 上下文消息数组）──
const CHAT_STORAGE_KEY = 'zhichuan-culture-chat'

function persistChat() {
  if (!_chatEl) return
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({
      html: _chatEl.innerHTML,
      messages: _historyMessages,
    }))
  } catch {
    // 存储满/隐私模式等场景静默失败，仅影响刷新恢复
  }
}

function loadPersistedChat() {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    return {
      html: typeof data.html === 'string' ? data.html : '',
      messages: Array.isArray(data.messages) ? data.messages : null,
    }
  } catch {
    return null
  }
}

// ── DOM 注册（ChatPanel onMounted / onBeforeUnmount 调用）──
export function registerChatUI({ chatEl, inputEl }) {
  _chatEl = chatEl
  _inputEl = inputEl

  // 刷新页面后恢复上次对话（气泡 + 多轮上下文）
  const saved = loadPersistedChat()
  if (saved?.html) {
    _chatEl.innerHTML = saved.html
    _chatEl.scrollTop = _chatEl.scrollHeight
    if (saved.messages) _historyMessages = saved.messages
  }
}

export function unregisterChatUI() {
  _chatEl = null
  _inputEl = null
  stopAll()
}

// ── 清空对话（ChatPanel「清空对话」按钮）──
export function clearChat() {
  _streamGeneration++
  stop()
  stopTyping()
  stopLipsync()
  ttsPlaying.value = false
  ttsPaused.value = false
  _historyMessages = [{ role: 'system', content: systemPrompt.trim() }]
  unlockInput()
  if (_chatEl) {
    // 只移除消息气泡，保留模板里的欢迎横幅
    _chatEl.querySelectorAll('.message').forEach((n) => n.remove())
    _chatEl.scrollTop = _chatEl.scrollHeight
  }
  try { localStorage.removeItem(CHAT_STORAGE_KEY) } catch {}
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
  stop()
  stopTyping()
  stopLipsync()
  ttsPlaying.value = false
  ttsPaused.value = false
  unlockInput()
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
async function appendAIStream(historyMessages, userInput, onDone) {
  const myGen = ++_streamGeneration
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

  const stream = chatWithAIStream(historyMessages, userInput)
  for await (const chunk of stream) {
    if (isAborted()) break
    if (chunk.__done) { finalData = chunk; break }
    const chars = chunk.__message != null
      ? [chunk.__message]
      : [...(chunk.delta ?? '')]
    for (const c of chars) { if (c) collectedMessage += c }
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
    stop()
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

  ttsPlaying.value = false
  stopLipsync()

  if (!isAborted() && finalData) {
    if (finalData.isShowModel) handleModelDisplay(finalData.modelIndex)
    if (typeof onDone === 'function') onDone(finalData)

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
    placeholder.remove()

    if (!url) {
      console.warn('图片生成失败，跳过展示')
      return
    }

    // 插入图片
    const img = document.createElement('img')
    img.src = url
    img.alt = '刺绣配图'
    img.className = 'ai-generated-image'
    img.style.cssText = [
      'display:block',
      'max-width:100%',
      'border-radius:10px',
      'margin-top:10px',
      'cursor:pointer',
      'box-shadow:0 2px 12px rgba(0,0,0,0.15)',
      'transition:transform 0.2s',
    ].join(';')
    img.onclick = () => openImagePreview(url)
    img.onmouseover = () => { img.style.transform = 'scale(1.02)' }
    img.onmouseout = () => { img.style.transform = '' }

    div.appendChild(img)
    if (_chatEl) _chatEl.scrollTop = _chatEl.scrollHeight
    persistChat()

  } catch (err) {
    placeholder.remove()
    console.error('图片追加失败:', err)
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

  // 先打断当前一切输出，再开新对话
  _streamGeneration++
  stop()
  stopTyping()
  stopLipsync()
  ttsPlaying.value = false

  lockInput()
  appendUser(text)
  if (clearInput && _inputEl) _inputEl.value = ''
  appendThinking()
  await appendAIStream(getContextForAPI(), text, (res) => {
    _onAIDone(text, res.message)
  })
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
