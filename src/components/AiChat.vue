<template>
  <div class="ai-chat">
    <!-- 悬浮按钮 -->
    <button v-show="!open" class="ai-fab" title="锦绣助手 · 刺绣问答" @click="openPanel">🧵</button>

    <!-- 聊天窗口 -->
    <Transition name="panel">
      <div v-if="open" class="ai-panel">
        <div class="ai-panel-head">
          <div class="ai-head-info">
            <span class="ai-head-avatar">🧵</span>
            <div>
              <div class="ai-head-title">锦绣助手</div>
              <div class="ai-head-sub"><span class="ai-status-dot"></span>DeepSeek 驱动 · 刺绣知识问答</div>
            </div>
          </div>
          <div class="ai-head-actions">
            <button class="ai-clear-btn" title="清空对话" @click="clearChat">🗑</button>
            <button class="ai-close-btn" title="收起" @click="open = false">✕</button>
          </div>
        </div>

        <div ref="msgBoxRef" class="ai-msg-box">
          <div v-for="(m, i) in messages" :key="i" class="ai-msg" :class="m.role">
            <div class="ai-msg-bubble">{{ m.content }}</div>
          </div>

          <!-- 打字指示器 -->
          <div v-if="loading" class="ai-msg assistant">
            <div class="ai-msg-bubble typing"><span></span><span></span><span></span></div>
          </div>

          <!-- 空状态快捷提问 -->
          <div v-if="messages.length === 0 && !loading" class="ai-suggests">
            <p class="ai-suggest-hint">试着问我：</p>
            <button v-for="q in quickQuestions" :key="q" class="ai-suggest-btn" @click="send(q)">{{ q }}</button>
          </div>
        </div>

        <form class="ai-input-row" @submit.prevent="send()">
          <input
            v-model="draft"
            class="ai-input"
            type="text"
            placeholder="问问关于刺绣的任何问题…"
            :disabled="loading"
          />
          <button class="ai-send-btn" type="submit" :disabled="loading || !draft.trim()">➤</button>
        </form>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

// ── DeepSeek 经本地后端 /api/chat 代理调用 ──────────────
// API Key 只存在于 server/.env（DEEPSEEK_API_KEY），前端不再持有，
// 避免密钥打进打包产物 + 浏览器直连 api.deepseek.com 的 401/跨域问题

const SYSTEM_PROMPT =
  '你是「锦绣助手」，一名深耕中国非遗刺绣领域的数字导览员。' +
  '请用中文、亲切而专业的口吻回答关于刺绣（流派、针法、历史、传承人物、现代发展等）的问题，' +
  '回答尽量简洁清晰，多用短段落或要点。若问题与刺绣无关，请礼貌地引导用户回到刺绣话题。'

const open = ref(false)
const draft = ref('')
const loading = ref(false)
const messages = ref([])
const msgBoxRef = ref(null)

const quickQuestions = [
  '四大名绣各有什么特点？',
  '苏绣的乱针绣是怎么诞生的？',
  '苗绣的蝴蝶妈妈纹样有什么含义？',
]

function openPanel() {
  open.value = true
  nextTick(scrollToBottom)
}

function clearChat() {
  messages.value = []
}

function scrollToBottom() {
  const box = msgBoxRef.value
  if (box) box.scrollTop = box.scrollHeight
}

// 发送消息（text 参数用于快捷提问，缺省取输入框内容）
async function send(text) {
  const content = (text ?? draft.value).trim()
  if (!content || loading.value) return
  draft.value = ''
  messages.value.push({ role: 'user', content })
  await nextTick(scrollToBottom)

  const assistant = { role: 'assistant', content: '' }
  messages.value.push(assistant)
  loading.value = true

  try {
    // 调用本地后端代理（后端拼接 Authorization: Bearer <key>，密钥不出服务端）
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.value.filter((m) => m.content).slice(-12),
        ],
      }),
    })

    if (!res.ok) {
      // 后端返回可读错误（未配置 Key / Key 失效 / 服务异常）
      let message = `请求失败（HTTP ${res.status}），请稍后重试`
      try {
        const data = await res.json()
        if (data?.message) message = data.message
      } catch {
        // 非 JSON 响应，保留默认提示
      }
      assistant.content = message
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const json = JSON.parse(payload)
          assistant.content += json.choices?.[0]?.delta?.content || ''
        } catch {
          // 忽略无法解析的片段
        }
      }
      scrollToBottom()
    }

    if (!assistant.content) {
      assistant.content = '（模型未返回内容，请稍后再试）'
    }
  } catch (err) {
    assistant.content = `请求失败：${err.message}。请检查网络连接，或稍后重试。`
  } finally {
    loading.value = false
    await nextTick(scrollToBottom)
  }
}
</script>

<style scoped>
.ai-chat {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 300;
}

/* ── 悬浮按钮 ── */
.ai-fab {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #a63a2b, #7c3a30);
  color: #f2ead8;
  font-size: 26px;
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(166, 58, 43, 0.4);
  transition: all 0.25s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-fab:hover {
  transform: translateY(-3px) scale(1.05);
  box-shadow: 0 14px 34px rgba(166, 58, 43, 0.5);
}

/* ── 聊天窗口 ── */
.ai-panel {
  width: 380px;
  height: 560px;
  display: flex;
  flex-direction: column;
  border-radius: 22px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(185, 138, 47, 0.16);
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.22);
}

.ai-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  background: rgba(26, 47, 42, 0.85);
  border-bottom: 1px solid rgba(185, 138, 47, 0.12);
}

.ai-head-info {
  display: flex;
  align-items: center;
  gap: 11px;
}

.ai-head-avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #a63a2b, #7c3a30);
  color: #f2ead8;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-head-title {
  font-size: 15px;
  font-weight: 700;
  color: #f2ead8;
}

.ai-head-sub {
  font-size: 11px;
  color: #b98a2f;
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
}

.ai-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #63b87e;
  box-shadow: 0 0 6px rgba(95, 132, 116, 0.8);
}

.ai-head-actions {
  display: flex;
  gap: 6px;
}

.ai-clear-btn,
.ai-close-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid rgba(185, 138, 47, 0.2);
  background: rgba(255, 255, 255, 0.7);
  color: #8a6a4f;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-clear-btn:hover,
.ai-close-btn:hover {
  background: #223c35;
  color: #a63a2b;
  border-color: #a63a2b;
}

/* ── 消息区 ── */
.ai-msg-box {
  flex: 1;
  overflow-y: auto;
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-msg {
  display: flex;
}

.ai-msg.user {
  justify-content: flex-end;
}

.ai-msg.assistant {
  justify-content: flex-start;
}

.ai-msg-bubble {
  max-width: 84%;
  padding: 11px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
  white-space: pre-wrap;
  animation: bubbleIn 0.25s ease-out;
}

.ai-msg.user .ai-msg-bubble {
  background: linear-gradient(135deg, #d9b36a, #6b4226);
  color: #f2ead8;
  border-bottom-right-radius: 6px;
}

.ai-msg.assistant .ai-msg-bubble {
  background: rgba(255, 255, 255, 0.9);
  color: #4a3320;
  border: 1px solid rgba(185, 138, 47, 0.14);
  border-bottom-left-radius: 6px;
}

@keyframes bubbleIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 打字指示器 */
.ai-msg-bubble.typing {
  display: flex;
  gap: 5px;
  align-items: center;
  padding: 14px 18px;
}

.ai-msg-bubble.typing span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #9fb3a8;
  animation: typingDot 1.2s infinite ease-in-out;
}

.ai-msg-bubble.typing span:nth-child(2) {
  animation-delay: 0.2s;
}

.ai-msg-bubble.typing span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typingDot {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* ── 快捷提问 ── */
.ai-suggests {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: auto;
  margin-bottom: auto;
}

.ai-suggest-hint {
  font-size: 13px;
  color: #b98a2f;
  text-align: center;
  margin-bottom: 2px;
}

.ai-suggest-btn {
  padding: 11px 16px;
  border-radius: 14px;
  border: 1px solid rgba(185, 138, 47, 0.2);
  background: rgba(255, 255, 255, 0.8);
  color: #9fb3a8;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

.ai-suggest-btn:hover {
  border-color: #a63a2b;
  color: #a63a2b;
  background: #223c35;
  transform: translateX(3px);
}

/* ── 输入区 ── */
.ai-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(26, 47, 42, 0.85);
  border-top: 1px solid rgba(185, 138, 47, 0.12);
}

.ai-input {
  flex: 1;
  padding: 11px 16px;
  border-radius: 20px;
  border: 1px solid rgba(185, 138, 47, 0.2);
  background: rgba(255, 255, 255, 0.9);
  color: #f2ead8;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

.ai-input:focus {
  border-color: #a63a2b;
}

.ai-input::placeholder {
  color: #9fb3a8;
}

.ai-send-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #a63a2b, #7c3a30);
  color: #f2ead8;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(166, 58, 43, 0.35);
}

.ai-send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── 面板开关动画 ── */
.panel-enter-active,
.panel-leave-active {
  transition: all 0.25s ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.96);
}

/* ── 移动端 ── */
@media (max-width: 640px) {
  .ai-chat {
    right: 14px;
    bottom: 14px;
  }

  .ai-fab {
    width: 52px;
    height: 52px;
    font-size: 23px;
  }

  .ai-panel {
    width: calc(100vw - 28px);
    height: min(560px, 72vh);
  }
}
</style>
