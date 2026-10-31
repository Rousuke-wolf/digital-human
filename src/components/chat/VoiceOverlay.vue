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
          <button class="voice-mic-btn" @click="toggleMic">
            <svg v-if="recording" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </button>
          <button class="voice-end-btn" @click="exitVoiceMode">✕</button>
        </div>
        <button class="voice-back-btn" @click="exitVoiceMode">⌨ 返回文字聊天</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
// VoiceOverlay — 语音聊天浮层（原 script.js 语音识别 + 面板拖动逻辑迁入）
// 识别主链路：麦克风 PCM → 前端编码 16kHz 单声道 WAV → POST /api/asr → DashScope qwen3-asr-flash
// 说明：MediaRecorder 的 webm/opus 在 DashScope 端解码不可靠（实测只识别出零星字符），
//       WAV 为已验证格式（端到端实测识别一字不差）；Web Speech API 依赖谷歌服务，
//       国内不可用，仅保留为无 AudioContext 环境的兜底
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { voiceModeActive, handleVoiceResult, interruptCurrent, ttsSettings } from '../../composables/useCultureChat.js'

const voiceUIRef = ref(null)
const statusText = ref('点击麦克风开始说话')
const recording = ref(false)

let audioCtx = null
let processor = null
let stream = null
let pcmChunks = []   // Float32Array 片段（原始采样率）
let recordRate = 48000
let maxTimer = null

// 进入语音模式时重置提示
watch(voiceModeActive, (active) => {
  if (active) statusText.value = '点击麦克风开始语音聊天'
})

// ── 录音识别（主链路）────────────────────────────────
// qwen3-asr-flash 的 zh 覆盖普通话/四川话/吴语等，粤语单独用 yue
function asrLanguage() {
  return ttsSettings.dialect === '广东话' ? 'yue' : 'zh'
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('读取录音失败'))
    reader.readAsDataURL(blob)
  })
}

// PCM Float32 片段 → 16kHz 单声道 16-bit WAV（窗口平均降采样）
function encodeWav(chunks, sourceRate) {
  let total = 0
  for (const c of chunks) total += c.length
  const all = new Float32Array(total)
  let pos = 0
  for (const c of chunks) { all.set(c, pos); pos += c.length }

  const ratio = Math.max(1, Math.round(sourceRate / 16000))
  const outLen = Math.ceil(all.length / ratio)
  const buffer = new ArrayBuffer(44 + outLen * 2)
  const view = new DataView(buffer)
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + outLen * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)       // PCM
  view.setUint16(22, 1, true)       // 单声道
  view.setUint32(24, 16000, true)   // 16kHz
  view.setUint32(28, 16000 * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, outLen * 2, true)
  let o = 44
  for (let i = 0; i < outLen; i++) {
    let s = all[i * ratio]
    if (ratio > 1) {
      let sum = 0, n = 0
      const base = i * ratio
      for (let j = 0; j < ratio && base + j < all.length; j++) { sum += all[base + j]; n++ }
      s = sum / n
    }
    const v = Math.max(-1, Math.min(1, s))
    view.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true)
    o += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

async function transcribe() {
  if (!pcmChunks.length) {
    statusText.value = '没有录到声音，请再试一次'
    return
  }
  const blob = encodeWav(pcmChunks, recordRate)
  statusText.value = '正在识别...'
  try {
    const res = await fetch('/api/asr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: await blobToDataURL(blob), language: asrLanguage() }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      statusText.value = data.message || '语音识别失败，请重试'
      return
    }
    if (!data.text?.trim()) {
      statusText.value = '没有听清，请再试一次'
      return
    }
    statusText.value = '正在思考...'
    await handleVoiceResult(data.text)
    statusText.value = '点击麦克风继续'
  } catch {
    statusText.value = '识别请求失败，请检查网络'
  }
}

async function startRecording() {
  try {
    // 回声消除 + 降噪 + 自动增益，尽量拿到干净的语音
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
  } catch {
    statusText.value = '无法访问麦克风，请检查浏览器权限'
    return
  }
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) {
    fallbackToWebSpeech()
    return
  }
  audioCtx = new AC()
  // 经 getUserMedia await 后可能脱离用户手势上下文被挂起：显式恢复，否则采集回调不触发
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
  recordRate = audioCtx.sampleRate
  const source = audioCtx.createMediaStreamSource(stream)
  processor = audioCtx.createScriptProcessor(4096, 1, 1)
  processor.onaudioprocess = (e) => {
    pcmChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
  }
  // ScriptProcessor 需连接下游才会触发回调：接静音增益，避免麦克风回声
  const mute = audioCtx.createGain()
  mute.gain.value = 0
  source.connect(processor)
  processor.connect(mute)
  mute.connect(audioCtx.destination)

  pcmChunks = []
  recording.value = true
  statusText.value = '正在听...（再点一次结束）'
  maxTimer = setTimeout(stopRecording, 60000)   // 60 秒自动结束，避免超长录音
}

function stopRecording() {
  if (maxTimer) { clearTimeout(maxTimer); maxTimer = null }
  if (processor) {
    processor.onaudioprocess = null
    try { processor.disconnect() } catch {}
    processor = null
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {})
    audioCtx = null
  }
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  recording.value = false
}

// ── 兜底：Web Speech API（无 AudioContext 的旧环境；依赖谷歌服务）──
let recognition = null
let recognizing = false

function fallbackToWebSpeech() {
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) {
    statusText.value = '当前浏览器不支持语音识别'
    return
  }
  const rec = new SR()
  rec.lang = 'zh-CN'
  rec.continuous = false
  rec.interimResults = false
  rec.onstart = () => { recognizing = true; statusText.value = '正在听...' }
  rec.onend = () => { recognizing = false }
  rec.onerror = () => {
    recognizing = false
    recording.value = false
    statusText.value = '语音识别出错'
  }
  rec.onresult = async (e) => {
    const text = e.results[0][0].transcript
    recording.value = false
    statusText.value = '正在思考...'
    await handleVoiceResult(text)
    statusText.value = '点击麦克风继续'
  }
  recognition = rec
  rec.start()
  recording.value = true
}

function stopRecognition() {
  if (recognition && recognizing) recognition.stop()
}

// ── 麦克风切换：点一下开始录音，再点一下结束并识别 ─────
function toggleMic() {
  if (recording.value) {
    if (recognizing) {
      stopRecognition()
      recording.value = false
      statusText.value = '点击麦克风开始说话'
      return
    }
    stopRecording()
    transcribe()
    return
  }
  // 未录音 → 点击开始：先打断大模型当前发言，再开始录音
  interruptCurrent()
  startRecording()
}

// ── 退出语音模式（停止录音但不触发识别）──
function exitVoiceMode() {
  stopRecognition()
  stopRecording()
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
  stopRecording()
  voiceModeActive.value = false
})
</script>
