<template>
  <div class="app-wrapper">
    <Navbar />

    <div class="main-dashboard">
      <div class="left-stage">
        <div class="character-section">
          <div class="character-3d">
            <canvas id="live2d" style="width:45vw;"></canvas>
          </div>
        </div>
      </div>

      <div id="modelPanel" class="right-panel model-right-panel">
        <div id="modelViewBox" class="model-view-box model-view-box-top">
          <!-- 预设展品下拉 + AI 生成（原 buildModelDropdown 字符串模板迁入） -->
          <div class="meshy-combo-bar">
            <div class="meshy-combo-row">
              <span class="meshy-combo-icon">🏮</span>
              <div class="meshy-select-wrap">
                <select id="modelDropdown" class="meshy-select" :disabled="processingAtMount" @change="onDropdownSelect">
                  <option value="">— 选择预设展品 —</option>
                  <optgroup label="预设展品">
                    <option v-for="(m, i) in MODELS" :key="m.key" :value="String(i)">{{ m.name }}</option>
                  </optgroup>
                  <optgroup v-if="appState.generatedModels.length" label="我的生成">
                    <option v-for="(g, i) in appState.generatedModels" :key="g.glbUrl" :value="'g' + i">✨ {{ g.name }}</option>
                  </optgroup>
                </select>
                <span class="meshy-select-arrow">▾</span>
              </div>
            </div>

            <div class="meshy-combo-row">
              <span class="meshy-combo-icon">✨</span>
              <input
                id="meshyPrompt"
                class="meshy-combo-input"
                placeholder="或输入描述，AI 生成专属 3D 展品..."
                autocomplete="off"
              />
              <button id="meshyGenBtn" class="meshy-gen-btn" @click="meshyGenerate()">
                <span id="meshyBtnText">🪄 生成</span>
              </button>
            </div>

            <!-- 状态提示（原 HTML 缺失导致 setStatus 一直是静默 no-op，本次补回） -->
            <div id="meshyStatus" class="meshy-status"></div>
            <div id="meshyTimeTag" class="meshy-time-tag">⏱ 预计 3 ~ 8 分钟</div>

            <!-- 我的生成：快速切换与删除管理（响应式，随生成/删除自动增减） -->
            <div v-if="appState.generatedModels.length" class="generated-chips">
              <div
                v-for="(g, i) in appState.generatedModels"
                :key="g.glbUrl"
                class="generated-chip"
                title="点击展示该模型"
                @click="onChipClick(i)"
              >
                <span>✨ {{ g.name }}</span>
                <button
                  class="generated-chip-del"
                  title="删除该生成模型"
                  @click.stop="onDeleteGenerated(g)"
                >✕</button>
              </div>
            </div>
          </div>

          <!--
            模型展示区：v-once 标记 Vue 永不重渲染此子树。
            内部的 viewer / 加载遮罩 / 空态提示由 preset.js 与 Meshy.js 命令式管理，
            避免 Vue 的虚拟 DOM 与外部 DOM 操作互相覆盖
          -->
          <div v-once id="modelViewerWrap" class="model-viewer-wrap"></div>
        </div>

        <!--
          展品介绍卡：同样 v-once。
          名称/介绍文本由 preset.js / Meshy.js 命令式更新；
          「朗读介绍」按钮常驻于此（v-once 只渲染一次），状态由 infoTts.js 命令式管理，
          预设展品与 AI 生成模型共用
        -->
        <div v-once class="model-info-card">
          <div class="model-info-header">
            <div class="model-info-title">展品介绍</div>
          </div>
          <div id="modelInfoName" class="model-info-name"></div>
          <div id="modelIntroText" class="model-info-text"></div>
          <button id="meshyTtsBtn" class="model-info-tts" disabled @click="handleInfoTtsClick">
            <span id="meshyTtsBtnIcon">🔊</span><span id="meshyTtsBtnLabel"> 朗读介绍</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import '../page/show3D/index.css'
import '../page/show3D/combo.css'
import Navbar from '../components/Navbar.vue'
import { MODELS } from '../utils/models.js'
import { appState } from '../utils/state.js'
import { showPresetModel } from '../page/show3D/preset.js'
import { handleInfoTtsClick, infoTtsEnable, infoTtsDisable } from '../page/show3D/infoTts.js'
import {
  meshyGenerate,
  meshyRestoreState,
  showGeneratedModel,
  clearGeneratedDisplay,
  meshySetStatus,
} from '../page/show3D/Meshy.js'
import { initLive2D, destroyLive2D } from '../composables/useLive2D.js'
import { attachViewerLoading } from '../utils/viewerLoading.js'
import { removeGeneratedModel } from '../utils/state.js'
import { consumeExhibitJump, consumeGeneratedJump } from '../utils/navigation.js'
import { guideOnPageEnter } from '../utils/voiceGuide.js'
import { useAuth } from '../composables/useAuth.js'
import { userAPI } from '../api/client.js'

const { isLoggedIn } = useAuth()

// 挂载时的生成状态（一次性快照；后续状态由 Meshy.js 的 setBtnLoading 等管理）
const processingAtMount = appState.meshyTask.status === 'processing'

// ── 初始渲染：与旧 build3DPage 的行为一致 ──
function buildInitialViewer() {
  const task = appState.meshyTask
  let src = ''
  let title = ''
  let intro = '暂无展品，请选择或生成内容。'

  if (task.status === 'success' && task.resultUrl) {
    src = task.resultUrl
    title = task.prompt
    intro = '由 Meshy AI 根据您的描述生成的 3D 模型。'
  } else if (appState._modelHasContent) {
    const preset = MODELS[appState.currentModelIndex]
    if (preset) {
      src = preset.src
      title = preset.name
      intro = preset.intro
    }
  }

  const wrap = document.getElementById('modelViewerWrap')
  if (wrap) {
    wrap.innerHTML = src
      ? `<model-viewer id="mainModelViewer" src="${src}" auto-rotate camera-controls
          style="width:100%;height:100%;background:transparent;"></model-viewer>`
      : `<div class="model-empty-hint">
          <div class="hint-icon">🧵</div>
          <div class="hint-text">请选择展品或描述生成</div>
        </div>`
    if (src) attachViewerLoading(document.getElementById('mainModelViewer'))
  }
  const nameEl = document.getElementById('modelInfoName')
  if (nameEl) nameEl.textContent = title
  const introEl = document.getElementById('modelIntroText')
  if (introEl) introEl.textContent = intro

  // 朗读介绍：有展品内容时可播报，空态禁用
  if (src) infoTtsEnable()
  else infoTtsDisable()
}

// ── 下拉框选中项同步（挂载/删除生成条目后调用）──
function syncDropdownSelection() {
  const sel = document.getElementById('modelDropdown')
  if (!sel) return
  const task = appState.meshyTask
  if (task.status === 'success' && task.resultUrl) {
    const gi = appState.generatedModels.findIndex((m) => m.glbUrl === task.resultUrl)
    sel.value = gi !== -1 ? `g${gi}` : ''
  } else if (appState._modelHasContent) {
    sel.value = String(appState.currentModelIndex)
  } else {
    sel.value = ''
  }
}

// ── 下拉框选择（原 __bindComboEvents 全局迁移而来）──
function onDropdownSelect() {
  const sel = document.getElementById('modelDropdown')
  const val = sel?.value
  if (!val) return

  if (val.startsWith('g')) {
    showGeneratedModel(Number(val.slice(1)))
    return
  }
  showPresetModel(Number(val))
}

// ── 「我的生成」chip：点击展示 ──
function onChipClick(i) {
  showGeneratedModel(i)
}

// ── 「我的生成」chip：删除（含展示区/下拉框联动）──
function onDeleteGenerated(g) {
  removeGeneratedModel(g.glbUrl)

  // 云端作品同步删除（静默失败，下次 loadCloudWorks 会以云端为准回填）
  if (g.cloudId && isLoggedIn.value) {
    userAPI.deleteWork(g.cloudId).catch(() => {})
  }

  // 删除的是正在展示的模型 → 恢复空态
  if (appState.meshyTask.status === 'success' && appState.meshyTask.resultUrl === g.glbUrl) {
    clearGeneratedDisplay(g.glbUrl)
  }

  // 下拉框选中值可能因索引错位失效，重新同步
  syncDropdownSelection()
  meshySetStatus(`已删除「${g.name}」`, false, true)
}

onMounted(() => {
  // 跨页跳转指定展品（goToExhibit 整页跳转 + sessionStorage 传参）：
  // 先恢复目标展品索引，再构建初始视图
  const jumpIdx = consumeExhibitJump()
  if (jumpIdx != null) {
    appState.currentModelIndex = jumpIdx
    appState._modelHasContent = true
  }

  // 顺序对齐旧实现：初始内容 → Live2D → Meshy 状态恢复
  buildInitialViewer()
  syncDropdownSelection()

  // 个人中心「查看」跳转：展示指定生成模型
  const genUrl = consumeGeneratedJump()
  if (genUrl != null) {
    const gi = appState.generatedModels.findIndex((m) => m.glbUrl === genUrl)
    if (gi !== -1) showGeneratedModel(gi)
  }

  initLive2D()
  // 仅在 Meshy 任务非空闲时恢复生成状态；跳转指定展品时跳过恢复
  if (appState.meshyTask.status !== 'idle') meshyRestoreState()
  // 语音引导：首次进入播报展厅介绍，之后每次进入随机问候
  guideOnPageEnter('3d')
})

onBeforeUnmount(() => {
  destroyLive2D()
})
</script>
