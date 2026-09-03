import { MODELS } from '../../utils/models.js'
import { appState } from '../../utils/state.js'
import { buildNavbar } from '../../components/Navibar.js'
import { showGeneratedModel } from './Meshy.js'
import { attachViewerLoading } from '../../utils/viewerLoading.js'
import './index.css'
import './combo.css'

// 下拉框选中值约定：'' 占位 / '0'~'N-1' 预设展品下标 / 'g0'~'gN' 我的生成下标
export function buildModelDropdown(selectedValue = '') {
  const isProcessing = window.meshyTask?.status === 'processing'
  const isSel = (v) => (v === selectedValue ? 'selected' : '')
  const generated = appState.generatedModels

  return `
    <div class="meshy-combo-bar">
      <!-- 预设展品：原生 select，始终显示预设列表 -->
      <div class="meshy-combo-row">
        <span class="meshy-combo-icon">🏮</span>
        <div class="meshy-select-wrap">
          <select
            id="modelDropdown"
            class="meshy-select"
            ${isProcessing ? 'disabled' : ''}
          >
            <option value="" ${isSel('')}>— 选择预设展品 —</option>
            <optgroup label="预设展品">
              ${MODELS.map((m, i) =>
                `<option value="${i}" ${isSel(String(i))}>${m.name}</option>`
              ).join('')}
            </optgroup>
            ${generated.length ? `
              <optgroup label="我的生成">
                ${generated.map((g, i) =>
                  `<option value="g${i}" ${isSel(`g${i}`)}>✨ ${g.name}</option>`
                ).join('')}
              </optgroup>
            ` : ''}
          </select>
          <span class="meshy-select-arrow">▾</span>
        </div>
      </div>
      <!-- 自定义描述：AI 文生 3D -->
      <div class="meshy-combo-row">
        <span class="meshy-combo-icon">✨</span>
        <input
          type="text"
          id="meshyPrompt"
          class="meshy-combo-input"
          placeholder="或输入描述，AI 生成专属 3D 展品..."
          autocomplete="off"
          ${isProcessing ? 'disabled' : ''}
        />
        <button class="meshy-gen-btn" id="meshyGenBtn" onclick="window.meshyGenerate()">
          <span id="meshyBtnText">${isProcessing ? '⏳ 生成中...' : '🪄 生成'}</span>
        </button>
      </div>
      <!-- 预计时间 tag，生成中才显示 -->
      <div class="meshy-time-tag${isProcessing ? ' visible' : ''}" id="meshyTimeTag">
        ⏱ 预计 3 ~ 8 分钟
      </div>
    </div>
  `
}

export function build3DPage(hasModel = false) {
  const task = window.meshyTask
  const presetModel = MODELS[appState.currentModelIndex]

  let currentSrc = ''
  let currentTitle = ''
  let currentIntro = '暂无展品，请选择或生成内容。'

  if (task.status === 'success') {
    currentSrc = task.resultUrl
    currentTitle = task.prompt
    currentIntro = '由 Meshy AI 根据您的描述生成的 3D 模型。'
  } else if (hasModel) {
    currentSrc = presetModel.src
    currentTitle = presetModel.name
    currentIntro = presetModel.intro
  }

  // 下拉框选中项：预设展品对应其下标；Meshy 生成结果对应「我的生成」条目
  let dropdownValue = ''
  if (task.status === 'success') {
    const gi = appState.generatedModels.findIndex(m => m.glbUrl === task.resultUrl)
    if (gi !== -1) dropdownValue = `g${gi}`
  } else if (hasModel) {
    dropdownValue = String(appState.currentModelIndex)
  }

  return `
    <div class="app-wrapper">
      ${buildNavbar('3d')}
      <div class="main-dashboard">
        <div class="left-stage">
          <div class="character-section">
            <div class="character-3d">
              <canvas id="live2d" style="width:45vw;"></canvas>
            </div>
          </div>
        </div>
        <div class="right-panel model-right-panel" id="modelPanel">
          <div class="model-view-box model-view-box-top" id="modelViewBox">
            ${buildModelDropdown(dropdownValue)}
            <div class="model-viewer-wrap" id="modelViewerWrap">
              ${currentSrc ? `
                <model-viewer
                  id="mainModelViewer"
                  src="${currentSrc}"
                  auto-rotate
                  camera-controls
                  style="width:100%;height:100%;background:transparent;"
                ></model-viewer>
              ` : `
                <div class="model-empty-hint">
                  <div class="hint-icon">🧵</div>
                  <div class="hint-text">请选择展品或描述生成</div>
                </div>
              `}
            </div>
          </div>
          <div class="model-info-card">
            <div class="model-info-header">
              <div class="model-info-title">展品介绍</div>
            </div>
            <div class="model-info-name" id="modelInfoName">${currentTitle}</div>
            <div class="model-info-text" id="modelIntroText">${currentIntro}</div>
          </div>
        </div>
      </div>
    </div>
  `
}

// ── 绑定预设展品下拉框选中逻辑 ───────────────────
window.__bindComboEvents = function () {
  const select = document.getElementById('modelDropdown')
  if (!select) return

  // 初始展品 viewer 挂加载进度遮罩（GLB 体积大，避免用户干等）
  const viewer = document.getElementById('mainModelViewer')
  if (viewer) attachViewerLoading(viewer)

  select.addEventListener('change', () => {
    const val = select.value
    if (!val) return

    if (val.startsWith('g')) {
      // 「我的生成」条目
      showGeneratedModel(Number(val.slice(1)))
      return
    }
    // 预设展品
    const idx = Number(val)
    if (isNaN(idx) || idx < 0 || idx >= MODELS.length) return
    if (typeof window.onDropdownChange === 'function') {
      window.onDropdownChange(idx)
    }
  })
}
