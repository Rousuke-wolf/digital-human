<template>
  <div class="culture-chat-panel" :style="avatarStyle">
    <!-- 会话入口占用现有工具栏，不新增侧栏或压缩聊天区域 -->
    <div class="function-bar session-function-bar">
      <SessionManager />
      <div class="function-group">
        <button class="func-item" type="button" title="语音设置" :aria-expanded="settingsOpen" @click="settingsOpen = !settingsOpen">
          <i>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          </i>
          <span class="function-label">语音设置</span>
        </button>
        <button class="func-item" type="button" title="清空当前对话" @click="confirmClear = !confirmClear">
          <i>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" x2="10" y1="11" y2="17" />
              <line x1="14" x2="14" y1="11" y2="17" />
            </svg>
          </i>
          <span class="function-label">清空对话</span>
        </button>
      </div>
    </div>
    <div v-if="confirmClear" class="chat-clear-confirm" role="alert" @keydown.esc="confirmClear = false">
      <span>清空「{{ activeSession?.title }}」？其他会话不会受影响，此操作无法恢复。</span>
      <button type="button" @click="confirmClear = false">取消</button>
      <button type="button" class="confirm-danger" @click="onClearChat">确认清空</button>
    </div>
    <p v-if="storageWarning" class="chat-storage-warning" role="status">{{ storageWarning }}</p>

    <!-- 语音设置 -->
    <div ref="voiceSettingsRef" class="voice-settings-panel" :class="{ open: settingsOpen }">
      <div class="vs-row">
        <span class="vs-label">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          </svg>
          音量
        </span>
        <input
          v-model.number="ttsSettings.volume"
          type="range"
          class="vs-slider"
          min="0"
          max="100"
        />
        <span class="vs-val">{{ Math.round(ttsSettings.volume) }}</span>
      </div>
      <div class="vs-row">
        <span class="vs-label">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;">
            <path d="m12 14 4-4" />
            <path d="M3.34 19a10 10 0 1 1 17.32 0" />
          </svg>
          语速
        </span>
        <input
          v-model.number="ttsSettings.rate"
          type="range"
          class="vs-slider"
          min="0.5"
          max="2.0"
          step="0.1"
        />
        <span class="vs-val">{{ ttsSettings.rate.toFixed(1) }}x</span>
      </div>
      <div class="vs-row">
        <span class="vs-label">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          方言
        </span>
        <select v-model="ttsSettings.dialect" class="vs-select" title="选择绫韵的方言口音" @change="setTtsDialect($event.target.value)">
          <option v-for="d in DIALECT_OPTIONS" :key="d.name" :value="d.name">{{ d.name }}</option>
        </select>
      </div>
    </div>

    <!-- 聊天历史 -->
    <div ref="chatHistoryRef" class="chat-history">
      <!-- ⚠️ 欢迎横幅卡片：用户指定的保留设计，禁止修改/替换（见 CLAUDE.md 本仓库约定） -->
      <div class="welcome-banner">
        <div class="welcome-banner-left">
          <div class="welcome-avatar">绣</div>
          <div>
            <div class="welcome-name">绫韵</div>
            <div class="welcome-status"><span class="welcome-dot"></span>在线</div>
          </div>
        </div>
        <div class="welcome-body">
          👋 你好！我是刺绣文化讲解员绫韵~🧵<br>
          你可以向我提问关于刺绣历史、针法、四大名绣等任何问题，也可以点击下方卡片快速了解！
        </div>
      </div>
    </div>

    <!-- 输入区：毛玻璃圆角长条 -->
    <div class="input-area" :class="{ sending: inputLocked }">
      <!-- 胶囊：输入框 + 发送键（桌面端 display:contents 与原布局完全一致） -->
      <div class="input-capsule">
        <input
          ref="inputRef"
          v-model="inputText"
          type="text"
          placeholder="输入你想问的问题..."
          :disabled="inputLocked"
          @keydown.enter="onSend"
        />
        <button title="发送消息" :disabled="inputLocked" @click="onSend">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
        </button>
      </div>
      <!-- 暂停/停止/语音三键：桌面端与输入框同行（display:contents），移动端换到下一行 -->
      <div class="input-ctrl-row">
        <button
          class="tts-control-btn"
          :class="{ active: ttsPlaying }"
          :title="ttsPaused ? '继续语音' : '暂停语音'"
          @click="toggleTtsPause"
        >
          <svg v-if="ttsPaused" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        </button>
        <button
          class="tts-control-btn"
          :class="{ active: ttsPlaying }"
          title="停止语音"
          @click="stopAll"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>
        <button class="voice-chat-btn" title="切换语音模式" @click="enterVoiceMode">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import SessionManager from './SessionManager.vue'
import {
  registerChatUI,
  unregisterChatUI,
  sendMessage,
  toggleTtsPause,
  stopAll,
  clearChat,
  chatSessions,
  inputLocked,
  ttsPlaying,
  ttsPaused,
  ttsSettings,
  DIALECT_OPTIONS,
  setTtsDialect,
  voiceModeActive,
} from '../../composables/useCultureChat.js'
import { useAuth } from '../../composables/useAuth.js'
import { LIVE2D_MODELS, live2dState } from '../../composables/useLive2D.js'

const { user } = useAuth()

// 用户头像：设置过则通过 CSS 变量替换聊天气泡旁的小头像（未设置走默认线稿）
// 绫韵头像：跟随当前 Live2D 形象（res1→avatar_1、res2→avatar_2），欢迎横幅与 AI 气泡共用
const avatarStyle = computed(() => ({
  ...(user.value?.avatar ? { '--user-avatar': `url(${user.value.avatar})` } : {}),
  '--lingyun-avatar': `url(${LIVE2D_MODELS.find((m) => m.id === live2dState.modelId)?.avatar ?? LIVE2D_MODELS[0].avatar})`,
}))

const chatHistoryRef = ref(null)
const inputRef = ref(null)
const settingsOpen = ref(false)
const confirmClear = ref(false)
const { activeSession, activeSessionId, storageWarning } = chatSessions
const inputText = computed({
  get: () => activeSession.value?.draft || '',
  set: value => chatSessions.updateDraft(value),
})
watch(activeSessionId, () => { confirmClear.value = false })

function onSend(event) {
  if (event?.isComposing || inputLocked.value) return
  const text = inputText.value.trim()
  if (!text) return
  inputText.value = ''
  sendMessage(text)
}

function enterVoiceMode() {
  voiceModeActive.value = true
}

function onClearChat() {
  clearChat()
  confirmClear.value = false
}

// 聊天逻辑由 useCultureChat 单例承载，这里只注册 DOM 引用
onMounted(() => {
  registerChatUI({ chatEl: chatHistoryRef.value, inputEl: inputRef.value })
})

onBeforeUnmount(() => {
  unregisterChatUI()
})
</script>

<style scoped>
.culture-chat-panel .session-function-bar {
  justify-content: space-between !important;
  gap: 12px;
  padding: 6px 12px !important;
}
.session-function-bar .function-group { flex-shrink: 0; }
.chat-clear-confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid #dcc5a1;
  border-radius: 12px;
  background: #fff8eb;
  color: #84623c;
  font-size: 12px;
}
.chat-clear-confirm span { flex: 1 1 180px; }
.chat-clear-confirm button { padding: 6px 10px; border: 1px solid #dcc5a1; border-radius: 8px; background: transparent; color: inherit; cursor: pointer; }
.chat-clear-confirm .confirm-danger { color: #a64d3c; border-color: #a64d3c60; }
.chat-storage-warning { margin: 0 0 8px; color: #a64d3c; font-size: 11px; }
@media (max-width: 600px) {
  .session-function-bar .function-label { display: none; }
  .session-function-bar .func-item { min-width: 34px; min-height: 34px; padding: 8px !important; justify-content: center; }
  .culture-chat-panel .session-function-bar { gap: 8px; }
}
</style>
