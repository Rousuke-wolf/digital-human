// Meshy.js — Meshy Text-to-3D API 集成 + AI 展品介绍 + TTS 播放
import { speak, pause, resume, stop } from '../../tts.js'
import { MODELS } from '../../utils/models.js'
import { appState, upsertGeneratedModel, setGeneratedIntro } from '../../utils/state.js'
import { attachViewerLoading } from '../../utils/viewerLoading.js'
import { showPresetModel } from './preset.js'

// 密钥全部由后端代理持有（server/routes/ai.js、server/routes/meshy.js），
// 前端只访问自己的后端接口
const AI_CHAT_URL = '/api/ai/chat'
const MESHY_API_URL = '/api/meshy/text-to-3d'
const MESHY_TASK_URL = '/api/meshy/task'
const MESHY_GLB_PROXY = '/meshy-glb'
const POLL_INTERVAL = 3000
const POLL_TIMEOUT = 300000

// ── 模块内部状态（原 window._meshyResult / window._meshyTask 全局）──
let _meshyResult = null
let _meshyTask = null

  // ── 注入全局 CSS（只注入一次）────────────────────
  ; (function injectStyles() {
    if (document.getElementById('meshy-anim-style')) return
    const style = document.createElement('style')
    style.id = 'meshy-anim-style'
    style.textContent = `
    /* ── 第一阶段：居中旋转加载动画 ── */
    .meshy-loader {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      background: rgba(255,252,245,0.6);
      z-index: 10;
      pointer-events: none;
    }
    .meshy-loader-ring {
      width: 64px;
      height: 64px;
      border: 5px solid #e8d5a3;
      border-top-color: #c8a96e;
      border-radius: 50%;
      animation: meshySpin 0.9s linear infinite;
    }
    .meshy-loader-text {
      font-size: 13px;
      color: #8a6030;
      letter-spacing: 0.03em;
    }
    @keyframes meshySpin {
      to { transform: rotate(360deg); }
    }

    /* ── 第二阶段：右上角渲染中角标 ── */
    .meshy-rendering-badge {
      position: absolute;
      top: 10px;
      right: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: rgba(200,169,110,0.92);
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      border-radius: 20px;
      box-shadow: 0 2px 8px rgba(120,80,20,0.18);
      z-index: 10;
      pointer-events: none;
      animation: meshyBadgePop 0.25s ease;
    }
    .meshy-rendering-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #fff;
      animation: meshyDotPulse 1.2s ease-in-out infinite;
    }
    @keyframes meshyBadgePop {
      from { opacity:0; transform:scale(0.8) translateY(-4px); }
      to   { opacity:1; transform:scale(1) translateY(0); }
    }
    @keyframes meshyDotPulse {
      0%,100% { opacity:1; transform:scale(1); }
      50%      { opacity:0.4; transform:scale(0.6); }
    }
  `
    document.head.appendChild(style)
  })()

// ── 显示/隐藏第一阶段 spinner ─────────────────────
function showLoader() {
  const wrap = document.getElementById('modelViewerWrap') || document.getElementById('modelViewBox')
  if (!wrap || document.getElementById('meshyLoader')) return
  // 确保 wrap 是 relative，让 absolute 定位生效
  wrap.style.position = 'relative'
  const el = document.createElement('div')
  el.id = 'meshyLoader'
  el.className = 'meshy-loader'
  el.innerHTML = `
    <div class="meshy-loader-ring"></div>
    <div class="meshy-loader-text">模型生成中，请稍候...</div>
  `
  wrap.appendChild(el)
}

function hideLoader() {
  document.getElementById('meshyLoader')?.remove()
}

// ── 显示/隐藏第二阶段渲染角标 ────────────────────
function showRenderingBadge() {
  const wrap = document.getElementById('modelViewerWrap') || document.getElementById('modelViewBox')
  if (!wrap || document.getElementById('meshyRenderingBadge')) return
  wrap.style.position = 'relative'
  const el = document.createElement('div')
  el.id = 'meshyRenderingBadge'
  el.className = 'meshy-rendering-badge'
  el.innerHTML = `<div class="meshy-rendering-dot"></div>贴图渲染中...`
  wrap.appendChild(el)
}

function hideRenderingBadge() {
  document.getElementById('meshyRenderingBadge')?.remove()
}

// ── 状态提示 ──────────────────────────────────────
let _fadeTimer = null
function setStatus(msg, isError = false, autoFade = false) {
  const el = document.getElementById('meshyStatus')
  if (!el) return
  if (_fadeTimer) { clearTimeout(_fadeTimer); _fadeTimer = null }
  if (!msg) {
    el.style.transition = 'opacity 0.4s'; el.style.opacity = '0'
    setTimeout(() => { el.classList.remove('visible'); el.textContent = ''; el.style.opacity = '1' }, 400)
    return
  }
  el.style.transition = 'none'; el.style.opacity = '1'
  el.textContent = msg
  el.style.color = isError ? '#c0392b' : '#8a6030'
  el.classList.add('visible')
  if (autoFade) {
    _fadeTimer = setTimeout(() => {
      el.style.transition = 'opacity 0.8s ease'; el.style.opacity = '0'
      setTimeout(() => { el.classList.remove('visible'); el.textContent = ''; el.style.opacity = '1'; el.style.transition = 'none' }, 800)
    }, 2500)
  }
}

function setBtnLoading(loading) {
  const btn = document.getElementById('meshyGenBtn')
  const text = document.getElementById('meshyBtnText')
  const inp = document.getElementById('meshyPrompt')
  if (!btn || !text) return
  btn.disabled = loading
  if (inp) inp.disabled = loading
  text.textContent = loading ? '⏳ 生成中...' : '🪄 生成'
}

function setTimeTag(visible) {
  document.getElementById('meshyTimeTag')?.classList.toggle('visible', visible)
}

// ── TTS 状态机 ────────────────────────────────────
let _ttsState = 'idle'

function _setTtsBtnUI(state) {
  _ttsState = state
  const icon = document.getElementById('meshyTtsBtnIcon')
  const label = document.getElementById('meshyTtsBtnLabel')
  if (!icon || !label) return
  switch (state) {
    case 'loading': icon.textContent = '⏳'; label.textContent = ' 加载中...'; break
    case 'playing': icon.textContent = '⏸'; label.textContent = ' 暂停朗读'; break
    case 'paused': icon.textContent = '▶️'; label.textContent = ' 继续朗读'; break
    default: icon.textContent = '🔊'; label.textContent = ' 朗读介绍'
  }
}

function _enableTtsBtn() {
  const btn = document.getElementById('meshyTtsBtn')
  if (!btn) return
  btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer'
}

function _disableTtsBtn() {
  const btn = document.getElementById('meshyTtsBtn')
  if (!btn) return
  btn.disabled = true; btn.style.opacity = '0.4'; btn.style.cursor = 'not-allowed'
  _setTtsBtnUI('idle')
}

function _stopTtsOnModelChange() {
  if (_ttsState !== 'idle') { stop(); _setTtsBtnUI('idle') }
}

// 供预设切换时停止生成的模型朗读（原 window._meshyStopTts 全局）
export function meshyStopTts() { _stopTtsOnModelChange() }

function injectTtsButton() {
  if (document.getElementById('meshyTtsBtn')) return
  const card = document.querySelector('.model-info-card')
  if (!card) return
  const btn = document.createElement('button')
  btn.id = 'meshyTtsBtn'
  btn.disabled = true
  btn.innerHTML = `<span id="meshyTtsBtnIcon">🔊</span><span id="meshyTtsBtnLabel"> 朗读介绍</span>`
  btn.style.cssText = `
    margin-top:14px;padding:7px 20px;border:none;border-radius:20px;
    background:#c8a96e;color:#fff;font-size:14px;font-weight:500;
    cursor:not-allowed;display:inline-flex;align-items:center;gap:4px;
    transition:background 0.2s,opacity 0.2s,transform 0.1s;opacity:0.4;
  `
  btn.addEventListener('mouseenter', () => { if (!btn.disabled) btn.style.background = '#b8934e' })
  btn.addEventListener('mouseleave', () => { if (!btn.disabled) btn.style.background = '#c8a96e' })
  btn.addEventListener('mousedown', () => { if (!btn.disabled) btn.style.transform = 'scale(0.96)' })
  btn.addEventListener('mouseup', () => { btn.style.transform = 'scale(1)' })
  btn.addEventListener('click', _handleTtsBtnClick)
  card.appendChild(btn)
}

function _handleTtsBtnClick() {
  if (_ttsState === 'loading') return
  if (_ttsState === 'playing') { pause(); _setTtsBtnUI('paused'); return }
  if (_ttsState === 'paused') { resume(); _setTtsBtnUI('playing'); return }
  const text = document.getElementById('modelIntroText')?.textContent?.trim()
  if (!text || text === '✨ 正在生成展品介绍...') return
  _setTtsBtnUI('loading')
  speak(text, null, () => { _setTtsBtnUI('playing') }, () => { _setTtsBtnUI('idle') })
}

// ── AI 展品介绍 ───────────────────────────────────
async function generateIntro(prompt) {
  try {
    const res = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen-turbo',
        messages: [
          { role: 'system', content: '你是一位非物质文化遗产讲解员，语言亲切、生动。根据用户提供的展品名称或描述，用100-150字介绍该展品的历史背景、工艺特点和文化价值。只输出介绍正文，不要标题，不要多余内容。' },
          { role: 'user', content: `请介绍这个展品：${prompt}` }
        ]
      })
    })
    if (!res.ok) throw new Error(`AI 请求失败 ${res.status}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || null
  } catch (e) {
    console.error('[Meshy] AI 介绍生成失败:', e); return null
  }
}

// ── 注入 model-viewer ─────────────────────────────
function loadGeneratedModel(glbUrl, label, intro) {
  _stopTtsOnModelChange()

  const wrap = document.getElementById('modelViewerWrap') || document.getElementById('modelViewBox')
  if (!wrap) return

  wrap.querySelector('.model-empty-hint')?.remove()
  document.getElementById('mainModelViewer')?.remove()
  // 白模出现时移除 spinner，加上渲染角标
  hideLoader()

  const viewer = document.createElement('model-viewer')
  viewer.id = 'mainModelViewer'
  viewer.setAttribute('src', glbUrl)
  viewer.setAttribute('auto-rotate', '')
  viewer.setAttribute('camera-controls', '')
  viewer.setAttribute('shadow-intensity', '1')
  viewer.setAttribute('exposure', '1')
  viewer.style.cssText = 'width:100%;height:100%;background:transparent;display:block;'
  wrap.appendChild(viewer)
  // 生成模型体积大，挂加载进度遮罩
  attachViewerLoading(viewer)

  const nameEl = document.getElementById('modelInfoName')
  const introEl = document.getElementById('modelIntroText')
  if (nameEl) nameEl.textContent = label || 'AI 生成展品'
  if (introEl) introEl.textContent = intro || '✨ 正在生成展品介绍...'

  injectTtsButton()
  if (intro) _enableTtsBtn()
  else _disableTtsBtn()
}

async function afterModelLoaded(glbUrl, prompt) {
  const intro = await generateIntro(prompt)
  const finalIntro = intro || '由 Meshy AI 根据您的描述生成的 3D 展品模型。'
  const introEl = document.getElementById('modelIntroText')
  if (introEl) introEl.textContent = finalIntro
  if (_meshyResult) _meshyResult.intro = finalIntro
  // 回写生成记录的介绍（持久化，下次选中直接展示）
  setGeneratedIntro(glbUrl, finalIntro)
  _enableTtsBtn()
}

// ── 展示「我的生成」里的模型（下拉框选中时调用）──
export function showGeneratedModel(index) {
  const g = appState.generatedModels[index]
  if (!g) return

  stop(); _setTtsBtnUI('idle')
  loadGeneratedModel(g.glbUrl, g.name, g.intro)
  _meshyResult = { glbUrl: g.glbUrl, prompt: g.prompt, intro: g.intro }
  appState.meshyTask.status = 'success'
  appState.meshyTask.resultUrl = g.glbUrl
  appState.meshyTask.prompt = g.prompt
  if (!g.intro) afterModelLoaded(g.glbUrl, g.prompt)
}

// ── 状态提示对外（「我的生成」删除等场景复用）──
export function meshySetStatus(msg, isError = false, autoFade = false) {
  setStatus(msg, isError, autoFade)
}

// ── 清空当前展示的生成模型（删除「我的生成」条目时调用）──
export function clearGeneratedDisplay(glbUrl) {
  if (_meshyResult?.glbUrl === glbUrl) _meshyResult = null
  if (appState.meshyTask.status === 'success' && appState.meshyTask.resultUrl === glbUrl) {
    appState.meshyTask.status = 'idle'
    appState.meshyTask.resultUrl = null
    appState.meshyTask.prompt = ''
  }

  stop(); _setTtsBtnUI('idle')
  _disableTtsBtn()

  const wrap = document.getElementById('modelViewerWrap') || document.getElementById('modelViewBox')
  if (wrap) {
    document.getElementById('mainModelViewer')?.remove()
    document.getElementById('meshyLoader')?.remove()
    document.getElementById('meshyRenderingBadge')?.remove()
    wrap.innerHTML = `
      <div class="model-empty-hint">
        <div class="hint-icon">🧵</div>
        <div class="hint-text">请选择展品或描述生成</div>
      </div>`
  }
  const nameEl = document.getElementById('modelInfoName')
  if (nameEl) nameEl.textContent = ''
  const introEl = document.getElementById('modelIntroText')
  if (introEl) introEl.textContent = '暂无展品，请选择或生成内容。'
  const inp = document.getElementById('meshyPrompt')
  if (inp) inp.value = ''
}

function injectTtsForPreset() {
  const text = document.getElementById('modelIntroText')?.textContent?.trim()
  if (!text || text === '暂无展品，请选择或生成内容。') return
  injectTtsButton(); _enableTtsBtn(); _setTtsBtnUI('idle')
}

// ── 轮询 ─────────────────────────────────────────
async function pollTaskUntilDone(taskId) {
  const deadline = Date.now() + POLL_TIMEOUT
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL))
    const res = await fetch(`${MESHY_TASK_URL}/${taskId}`)
    if (!res.ok) throw new Error(`轮询失败 ${res.status}`)
    const task = await res.json()
    if (task.status === 'SUCCEEDED') return task
    if (task.status === 'FAILED') throw new Error(task.task_error?.message || '生成失败')
    if (task.status === 'EXPIRED') throw new Error('任务超时')
  }
  throw new Error('等待超时，请重试')
}

// ── 主入口 ────────────────────────────────────────
export async function meshyGenerate() {
  const input = document.getElementById('meshyPrompt')
  const prompt = input?.value?.trim()
  if (!prompt) { setStatus('请先输入描述内容', true, true); return }

  // 输入的是预设展品名 → 直接切换预设模型，不走文生 3D（避免误消耗配额）
  const presetIdx = MODELS.findIndex(m => m.name === prompt)
  if (presetIdx !== -1) {
    showPresetModel(presetIdx)
    setStatus(`已切换到预设展品「${prompt}」`, false, true)
    return
  }

  stop(); _setTtsBtnUI('idle')
  setBtnLoading(true); setTimeTag(true)

  // 第一阶段：显示旋转 spinner，清空旧模型
  const wrap = document.getElementById('modelViewerWrap') || document.getElementById('modelViewBox')
  if (wrap) {
    wrap.querySelector('.model-empty-hint')?.remove()
    document.getElementById('mainModelViewer')?.remove()
    hideRenderingBadge()
    showLoader()
  }

  try {
    setStatus('🚀 正在提交生成任务...')

    const previewRes = await fetch(MESHY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'preview', prompt,
        art_style: 'realistic', negative_prompt: 'low quality, blurry',
        topology: 'quad', target_polycount: 30000, should_remesh: true
      })
    })
    if (!previewRes.ok) {
      const err = await previewRes.json().catch(() => ({}))
      throw new Error(err.message || `创建失败 ${previewRes.status}`)
    }
    const { result: previewTaskId } = await previewRes.json()
    _meshyTask = { taskId: previewTaskId, prompt, startTime: Date.now() }
    appState.meshyTask.status = 'processing'
    appState.meshyTask.prompt = prompt

    setStatus('⚙️ 白模生成中...')
    const previewTask = await pollTaskUntilDone(previewTaskId)
    const previewGlb = previewTask.model_urls?.glb || previewTask.model_urls?.obj
    if (!previewGlb) throw new Error('未找到预览模型链接')

    // 白模就绪：hideLoader 在 loadGeneratedModel 内调用，同时显示渲染角标
    loadGeneratedModel(`${MESHY_GLB_PROXY}?url=${encodeURIComponent(previewGlb)}`, prompt.slice(0, 20), null)
    showRenderingBadge()
    setStatus('🎨 正在生成贴图...')

    const refineRes = await fetch(MESHY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'refine', preview_task_id: previewTaskId, texture_resolution: 1024 })
    })
    if (!refineRes.ok) {
      const err = await refineRes.json().catch(() => ({}))
      throw new Error(err.message || `贴图创建失败 ${refineRes.status}`)
    }
    const { result: refineTaskId } = await refineRes.json()
    const refineTask = await pollTaskUntilDone(refineTaskId)
    const finalGlb = refineTask.model_urls?.glb || refineTask.model_urls?.obj
    if (!finalGlb) throw new Error('未找到最终模型链接')

    const finalUrl = `${MESHY_GLB_PROXY}?url=${encodeURIComponent(finalGlb)}`
    _meshyResult = { glbUrl: finalUrl, prompt, intro: null }
    _meshyTask = null
    appState.meshyTask.status = 'success'
    appState.meshyTask.resultUrl = finalUrl
    appState.meshyTask.prompt = prompt

    // 加入「我的生成」预设列表（localStorage 持久化，刷新后仍在）
    upsertGeneratedModel({ name: prompt.slice(0, 20), glbUrl: finalUrl, prompt, intro: null })

    // 最终模型：覆盖白模，移除渲染角标
    loadGeneratedModel(finalUrl, prompt.slice(0, 20), null)
    hideRenderingBadge()
    afterModelLoaded(finalUrl, prompt)

    // 下拉框同步选中新生成的条目
    const genIdx = appState.generatedModels.findIndex(m => m.glbUrl === finalUrl)
    const sel = document.getElementById('modelDropdown')
    if (sel && genIdx !== -1) sel.value = `g${genIdx}`

    setStatus('✅ 生成完成！', false, true)
    setBtnLoading(false); setTimeTag(false)

  } catch (e) {
    console.error('[Meshy]', e)
    hideLoader(); hideRenderingBadge()
    setStatus(`❌ ${e.message}`, true, true)
    setBtnLoading(false); setTimeTag(false)
    _meshyTask = null
    appState.meshyTask.status = 'idle'
  }
}

// ── 恢复状态（Show3DPage 在 DOM 构建后调用）──
export function meshyRestoreState() {
  if (_meshyResult) {
    const { glbUrl, prompt, intro } = _meshyResult
    loadGeneratedModel(glbUrl, prompt.slice(0, 20), intro)
    if (!intro) afterModelLoaded(glbUrl, prompt)
    const inp = document.getElementById('meshyPrompt')
    if (inp) inp.value = prompt
    // 下拉框同步选中对应的「我的生成」条目
    const gi = appState.generatedModels.findIndex(m => m.glbUrl === glbUrl)
    const sel = document.getElementById('modelDropdown')
    if (sel) sel.value = gi !== -1 ? `g${gi}` : ''
    return
  }
  if (_meshyTask) {
    const { prompt, startTime } = _meshyTask
    if (Date.now() - startTime > POLL_TIMEOUT) {
      _meshyTask = null; appState.meshyTask.status = 'idle'; return
    }
    const inp = document.getElementById('meshyPrompt')
    if (inp) inp.value = prompt
    setBtnLoading(true); setTimeTag(true)
    showLoader()
    setStatus('⚙️ 生成任务进行中...')
    return
  }
  injectTtsForPreset()
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.activeElement?.id === 'meshyPrompt') meshyGenerate()
})
