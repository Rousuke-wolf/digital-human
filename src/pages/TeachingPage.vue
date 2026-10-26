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
        <div class="section-label">动画演示区</div>
        <div class="demo-canvas-box">
          <div id="demoVisual" class="demo-visual"></div>
        </div>

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
import { ref, onMounted, onBeforeUnmount } from 'vue'
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
} from '../page/teach/scripts.js'
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

function onStepClick(i) {
  activeStep.value = i   // 即时高亮；下一帧动画相位会通过监听器同步回来
  stepCardClicked(i)
}
function onPickStitch(key) {
  stitchSel.value = key
  selectPill('stitch', key)
}
function onPickType(key) {
  typeSel.value = key
  selectPill('type', key)
}
function onToggleAnim() {
  animPaused.value = !animPaused.value
  toggleStitchAnimation()
}

onMounted(() => {
  // 教学页数字人为 Live2D（修复批次4回归：原 __rebindScriptEvents 会在此初始化）
  initLive2D()
  // 动画相位 → 步骤卡片高亮
  setPhaseListener((cardIdx) => { activeStep.value = cardIdx })
  // 动画演示需要 DOM 就绪后手动触发
  setTimeout(() => updateDemo(), 150)
  // 语音引导：首次进入播报「动画体验」页面介绍
  guideOnPageEnter('teaching')
})

onBeforeUnmount(() => {
  stopDemo()
  destroyLive2D()
})
</script>
