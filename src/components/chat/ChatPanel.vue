<template>
  <div class="culture-chat-panel">
    <!-- 功能栏 -->
    <div class="function-bar">
      <div class="function-group">
        <div class="func-item" style="cursor:pointer;" @click="settingsOpen = !settingsOpen">
          <i>🔊</i> 语音设置
        </div>
        <div class="func-item" style="cursor:pointer;" @click="onClearChat">
          <i>🗑</i> 清空对话
        </div>
      </div>
    </div>

    <!-- 语音设置 -->
    <div ref="voiceSettingsRef" class="voice-settings-panel" :class="{ open: settingsOpen }">
      <div class="vs-row">
        <span class="vs-label">🔉 音量</span>
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
        <span class="vs-label">⏩ 语速</span>
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

    <!-- 输入区 -->
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
        <button title="发送消息" :disabled="inputLocked" @click="onSend">➤</button>
      </div>
      <!-- 暂停/停止/语音三键：桌面端与输入框同行（display:contents），移动端换到下一行 -->
      <div class="input-ctrl-row">
        <button
          class="tts-control-btn"
          :class="{ active: ttsPlaying }"
          :title="ttsPaused ? '继续语音' : '暂停语音'"
          @click="toggleTtsPause"
        >
          {{ ttsPaused ? '▶' : '⏸' }}
        </button>
        <button
          class="tts-control-btn"
          :class="{ active: ttsPlaying }"
          title="停止语音"
          @click="stopAll"
        >
          ⏹
        </button>
        <button class="voice-chat-btn" title="切换语音模式" @click="enterVoiceMode">🎤</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {
  registerChatUI,
  unregisterChatUI,
  sendMessage,
  toggleTtsPause,
  stopAll,
  clearChat,
  inputLocked,
  ttsPlaying,
  ttsPaused,
  ttsSettings,
  voiceModeActive,
} from '../../composables/useCultureChat.js'

const chatHistoryRef = ref(null)
const inputRef = ref(null)
const settingsOpen = ref(false)
const inputText = ref('')

function onSend() {
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
}

// 聊天逻辑由 useCultureChat 单例承载，这里只注册 DOM 引用
onMounted(() => {
  registerChatUI({ chatEl: chatHistoryRef.value, inputEl: inputRef.value })
})

onBeforeUnmount(() => {
  unregisterChatUI()
})
</script>
