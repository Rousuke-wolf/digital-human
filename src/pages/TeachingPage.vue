<template>
  <div class="app-wrapper">
    <Navbar />

    <div class="main-dashboard teaching-dashboard">
      <div class="left-stage">
        <div class="section-label">数字人引导区</div>
        <div class="character-section">
          <div class="character-3d">
            <canvas id="live2d" style="width:100%;height:100%;display:block;"></canvas>
          </div>
          <Live2DControls />
        </div>
        <div class="live2d-scene-info">
          <div class="scene-title">当前场景：<span>刺绣工坊环境</span></div>
          <div class="scene-desc">数字人后续可作为"绣娘引导员"，负责讲解针法、播放提示、引导步骤学习。</div>
        </div>
      </div>

      <div class="right-panel">
        <div class="demo-head-row">
          <div class="section-label">动画演示区</div>
          <div class="demo-mode-switch">
            <button class="demo-mode-btn" :class="{ active: demoMode === 'anim' }" @click="setDemoMode('anim')">🧵 动画演示</button>
            <button class="demo-mode-btn" :class="{ active: demoMode === 'video' }" @click="setDemoMode('video')">🎬 视频演示</button>
          </div>
        </div>

        <!-- 动画演示：canvas 常驻（v-show 保留实例），切换不重建 -->
        <div v-show="demoMode === 'anim'" class="demo-canvas-box">
          <div id="demoVisual" class="demo-visual"></div>
        </div>

        <!-- 视频演示：AI 生成的分段教学视频 + 台词字幕 + 绫韵播报 -->
        <div v-show="demoMode === 'video'" class="video-demo-box">
          <video
            ref="videoRef"
            class="video-demo"
            :src="videoSources[videoSegIdx]"
            playsinline
            preload="metadata"
            @loadeddata="videoError = false"
            @play="videoPlaying = true"
            @pause="videoPlaying = false"
            @ended="onVideoEnded"
            @error="onVideoError"
          ></video>
          <div v-if="videoError" class="video-placeholder">
            🎬 该步骤视频待生成<br />
            将视频放入 public/videos/teach/ 后刷新即可
          </div>
        </div>
        <div v-if="demoMode === 'video' && subtitle" class="video-subtitle">{{ subtitle }}</div>

        <div class="section-header" style="margin-top:20px;">
          <div class="section-label">步骤教学区</div>
          <div style="display:flex;gap:10px;align-items:center;">
            <button class="glass-game-btn" @click="openModal()">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <line x1="6" x2="10" y1="11" y2="11" />
                <line x1="8" x2="8" y1="9" y2="13" />
                <line x1="15" x2="15.01" y1="12" y2="12" />
                <line x1="18" x2="18.01" y1="10" y2="10" />
                <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
              </svg>
            </button>
            <button class="demo-icon-btn" :class="{ paused: animPaused }" @click="onToggleAnim">
              <span :class="animPaused ? 'icon-play' : 'icon-pause'"></span>
            </button>
          </div>
        </div>

        <div class="step-cards-row">
          <div
            v-for="(s, i) in stepCards"
            :key="i"
            class="step-card"
            :class="{ 'step-active': activeStep === i }"
            @click="onStepClick(i)"
          >
            <div class="step-num">{{ i + 1 }}</div>
            <div class="step-title">{{ s.title }}</div>
            <div class="step-desc">{{ s.desc }}</div>
          </div>
        </div>

        <div class="stitch-controls">
          <div class="control-row">
            <span class="control-label">选择针法</span>
            <button
              v-for="st in stitches"
              :key="st.key"
              class="pill-btn"
              :class="{ 'pill-active': stitchSel === st.key }"
              :data-stitch="st.key"
              @click="onPickStitch(st.key)"
            >{{ st.label }}</button>
          </div>
          <div class="control-row">
            <span class="control-label">选择刺绣类型</span>
            <button
              v-for="tp in types"
              :key="tp.key"
              class="pill-btn"
              :class="{ 'pill-active': typeSel === tp.key }"
              :data-type="tp.key"
              @click="onPickType(tp.key)"
            >{{ tp.label }}</button>
          </div>
        </div>

        <div class="demo-info-bar">
          <span id="demoTitle" class="demo-title">平针 · 苏绣</span>
          <span id="demoDesc" class="demo-desc">正面均匀走行，留下平整细密的线段，正背面短长交替，精致规律。</span>
        </div>
      </div>
    </div>

    <GameModal />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import '../page/teach/index.css'
import Navbar from '../components/Navbar.vue'
import GameModal from '../components/teach/GameModal.vue'
import Live2DControls from '../components/live2d/Live2DControls.vue'
import { initLive2D, destroyLive2D } from '../composables/useLive2D.js'
import {
  updateDemo,
  stepCardClicked,
  selectPill,
  toggleStitchAnimation,
  setPhaseListener,
  stopDemo,
  getSpeechText,
} from '../page/teach/scripts.js'
import { teachSpeak, teachStop } from '../tts-teach.js'
import { openModal } from '../page/teach/game/script.js'
import { guideOnPageEnter } from '../utils/voiceGuide.js'

// ── 静态文案（原字符串模板迁入）──
const stepCards = [
  { title: '穿针引线', desc: '准备阶段：穿针、选线，数字人讲解当前针法的起手动作与注意事项。' },
  { title: '起针定位', desc: '确定起针点，将针从背面穿出，数字人讲解定位要领与针距规律。' },
  { title: '完成针法', desc: '完成一组完整针脚，数字人讲解该针法的文化背景与技法要点。' },
]
const stitches = [
  { key: 'flat', label: '平针' },
  { key: 'back', label: '回针' },
  { key: 'blanket', label: '锁边针' },
]
const types = [
  { key: 'su', label: '苏绣' },
  { key: 'miao', label: '苗绣' },
]

// ── 响应式 UI 状态（原 selectStep / selectPill / toggleStitchAnimation 的 DOM 操作）──
const activeStep = ref(0)
const stitchSel = ref('flat')
const typeSel = ref('su')
const animPaused = ref(false)

// ── 视频演示模式：AI 生成的分段教学视频 + 台词字幕 + 绫韵播报 ──
// 行为：播放按钮 → 从当前段连播到末尾；点击步骤卡 → 只播该段，播完定格等待；
// 视频段（约 5s）比台词（约 8~10s）短：视频播完定格最后一帧，台词播完再进下一段
const demoMode = ref('anim')   // 'anim' | 'video'
const VIDEO_MANIFEST = {
  flat: ['/videos/teach/flat-0.mp4', '/videos/teach/flat-1.mp4', '/videos/teach/flat-2.mp4'],
  back: ['/videos/teach/back-0.mp4', '/videos/teach/back-1.mp4', '/videos/teach/back-2.mp4'],
  blanket: ['/videos/teach/blanket-0.mp4', '/videos/teach/blanket-1.mp4', '/videos/teach/blanket-2.mp4'],
}
const videoRef = ref(null)
const videoSegIdx = ref(0)
const videoPlayAll = ref(false)
const videoPlaying = ref(false)
const videoError = ref(false)
const subtitle = ref('')
let narrationPending = false   // 当前段台词是否仍在播报

const videoSources = computed(() => VIDEO_MANIFEST[stitchSel.value] || [])

function setDemoMode(mode) {
  if (demoMode.value === mode) return
  demoMode.value = mode
  if (mode === 'video') {
    teachStop()
    videoSegIdx.value = 0
    videoPlayAll.value = false
    videoPlaying.value = false
    videoError.value = false
    subtitle.value = ''
  }
}

// 播放第 idx 段；playAll=true 时该段结束后自动进入下一段（台词播完才推进）
function playSegment(idx, { playAll = false } = {}) {
  if (!videoSources.value.length) return
  videoPlayAll.value = playAll
  videoSegIdx.value = idx
  videoError.value = false
  activeStep.value = idx
  const line = getSpeechText(stitchSel.value, typeSel.value, idx)
  subtitle.value = line
  teachStop()
  narrationPending = false
  if (line) {
    narrationPending = true
    teachSpeak(line, () => {
      narrationPending = false
      // 全播模式：台词播完才进入下一段（视频此刻定格在最后一帧）
      if (videoPlayAll.value && demoMode.value === 'video') advanceSegment()
    })
  }
  const v = videoRef.value
  if (!v) return
  v.currentTime = 0
  v.play().catch(() => {})
}

function advanceSegment() {
  const next = videoSegIdx.value + 1
  if (next >= videoSources.value.length) {
    videoPlayAll.value = false
    videoPlaying.value = false
    return
  }
  playSegment(next, { playAll: true })
}

// 视频段播完：单段模式定格等待台词自然结束；全播模式下若台词已播完则推进
function onVideoEnded() {
  videoPlaying.value = false
  if (videoPlayAll.value && !narrationPending) advanceSegment()
}

function onVideoError() {
  videoError.value = true
  // 视频缺失时仍按台词节奏推进全播（占位提示覆盖画面）
  if (videoPlayAll.value && !narrationPending) advanceSegment()
}

function onStepClick(i) {
  activeStep.value = i   // 即时高亮；动画模式下一帧相位会通过监听器同步回来
  if (demoMode.value === 'video') {
    playSegment(i, { playAll: false })
    return
  }
  stepCardClicked(i)
}
function onPickStitch(key) {
  stitchSel.value = key
  selectPill('stitch', key)
  // 视频模式：切换针法后复位到第一段（不自动播放）
  if (demoMode.value === 'video') {
    teachStop()
    const v = videoRef.value
    if (v) v.pause()
    videoSegIdx.value = 0
    videoPlayAll.value = false
    videoPlaying.value = false
    videoError.value = false
    subtitle.value = ''
  }
}
function onPickType(key) {
  typeSel.value = key
  selectPill('type', key)
}
function onToggleAnim() {
  if (demoMode.value === 'video') {
    // 视频模式：播放/暂停按钮控制视频；未开始时点击 = 从当前段起连播全部
    const v = videoRef.value
    if (videoPlaying.value) { v.pause(); return }
    if (!subtitle.value) {
      playSegment(videoSegIdx.value, { playAll: true })
      return
    }
    v.play().catch(() => {})
    return
  }
  animPaused.value = !animPaused.value
  toggleStitchAnimation()
}

onMounted(() => {
  // 教学页数字人为 Live2D（修复批次4回归：原 __rebindScriptEvents 会在此初始化）
  initLive2D()
  // 动画相位 → 步骤卡片高亮（视频模式由分段逻辑接管，忽略画布相位）
  setPhaseListener((cardIdx) => {
    if (demoMode.value === 'anim') activeStep.value = cardIdx
  })
  // 动画演示需要 DOM 就绪后手动触发
  setTimeout(() => updateDemo(), 150)
  // 语音引导：首次进入播报「动画体验」页面介绍
  guideOnPageEnter('teaching')
})

onBeforeUnmount(() => {
  stopDemo()
  teachStop()
  destroyLive2D()
})
</script>
