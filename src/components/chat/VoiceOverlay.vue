<template>
  <Teleport to="body">
    <div
      id="voiceModeUI"
      ref="voiceUIRef"
      class="voice-mode-ui"
      :style="{ display: voiceModeActive ? 'flex' : 'none' }"
    >
      <div
        id="voiceControlPanel"
        class="voice-control-panel"
        @mousedown="onPanelMouseDown"
        @touchstart="onPanelTouchStart"
      >
        <div id="voiceStatus" class="voice-status">{{ statusText }}</div>
        <div class="voice-btn-group">
          <button class="voice-mic-btn" @click="toggleMic">{{ recording ? '⏹' : '🎙' }}</button>
          <button class="voice-end-btn" @click="exitVoiceMode">✕</button>
        </div>
        <button class="voice-back-btn" @click="exitVoiceMode">⌨ 返回文字聊天</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
// VoiceOverlay — 语音聊天浮层（原 script.js 语音识别 + 面板拖动逻辑迁入）
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { voiceModeActive, handleVoiceResult, interruptCurrent } from '../../composables/useCultureChat.js'

const voiceUIRef = ref(null)
const statusText = ref('点击麦克风开始说话')
const recording = ref(false)

let recognition = null
let recognizing = false

// 进入语音模式时重置提示
watch(voiceModeActive, (active) => {
  if (active) statusText.value = '点击麦克风开始语音聊天'
})

// ── 语音识别 ─────────────────────────────────────────
function initRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) {
    statusText.value = '当前浏览器不支持语音识别'
    return null
  }
  const rec = new SR()
  rec.lang = 'zh-CN'
  rec.continuous = false
  rec.interimResults = false
  rec.onstart = () => { recognizing = true; statusText.value = '正在听...' }
  rec.onend = () => { recognizing = false }
  rec.onerror = (e) => {
    recognizing = false
    recording.value = false
    statusText.value = '语音识别出错'
    console.error(e)
  }
  rec.onresult = async (e) => {
    const text = e.results[0][0].transcript
    recording.value = false
    statusText.value = '正在思考...'
    await handleVoiceResult(text)
    statusText.value = '点击麦克风继续'
  }
  return rec
}

function stopRecognition() {
  if (recognition && recognizing) recognition.stop()
}

// ── 麦克风切换：点一下开始录音，再点一下结束 ─────────
function toggleMic() {
  if (recognizing) {
    stopRecognition()
    recording.value = false
    statusText.value = '点击麦克风开始说话'
    return
  }
  // 未录音 → 点击开始：先打断大模型当前发言，再开始录音
  interruptCurrent()
  if (!recognition) recognition = initRecognition()
  if (recognition) {
    recognition.start()
    recording.value = true
  }
}

// ── 退出语音模式 ─────────────────────────────────────
function exitVoiceMode() {
  stopRecognition()
  recording.value = false
  voiceModeActive.value = false
  statusText.value = '点击麦克风开始说话'
}

// ── 面板拖动（鼠标 + 触屏）──
let dragState = null

function beginDrag(clientX, clientY, isTouch) {
  if (!voiceUIRef.value) return
  const rect = voiceUIRef.value.getBoundingClientRect()
  dragState = { startX: clientX, startY: clientY, initLeft: rect.left, initTop: rect.top, isTouch }
  // 切换到绝对坐标模式，脱离 transform 居中
  voiceUIRef.value.style.left = rect.left + 'px'
  voiceUIRef.value.style.top = rect.top + 'px'
  voiceUIRef.value.style.bottom = 'auto'
  voiceUIRef.value.style.transform = 'none'
}

function moveDrag(clientX, clientY) {
  if (!dragState || !voiceUIRef.value) return
  voiceUIRef.value.style.left = (dragState.initLeft + clientX - dragState.startX) + 'px'
  voiceUIRef.value.style.top = (dragState.initTop + clientY - dragState.startY) + 'px'
}

function endDrag() { dragState = null }

function onPanelMouseDown(e) {
  if (e.target.tagName === 'BUTTON') return   // 点击按钮时不触发拖动
  beginDrag(e.clientX, e.clientY, false)
  e.preventDefault()
}

function onPanelTouchStart(e) {
  if (e.target.tagName === 'BUTTON') return
  const t = e.touches[0]
  beginDrag(t.clientX, t.clientY, true)
}

function onDocMouseMove(e) { if (dragState && !dragState.isTouch) moveDrag(e.clientX, e.clientY) }
function onDocTouchMove(e) { if (dragState && dragState.isTouch) moveDrag(e.touches[0].clientX, e.touches[0].clientY) }

onMounted(() => {
  document.addEventListener('mousemove', onDocMouseMove)
  document.addEventListener('mouseup', endDrag)
  document.addEventListener('touchmove', onDocTouchMove, { passive: true })
  document.addEventListener('touchend', endDrag)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onDocMouseMove)
  document.removeEventListener('mouseup', endDrag)
  document.removeEventListener('touchmove', onDocTouchMove)
  document.removeEventListener('touchend', endDrag)
  stopRecognition()
  voiceModeActive.value = false
})
</script>
