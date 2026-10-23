// infoTts.js — 展品介绍卡「朗读介绍」按钮（预设展品与 AI 生成模型共用）
// 按钮本体常驻在 Show3DPage 的 v-once 模板中（#meshyTtsBtn），
// 本模块只负责状态机与播放控制；切换展品/删除/生成时由调用方复位
import { speak, pause, resume, stop } from '../../tts.js'

let _state = 'idle'   // idle | loading | playing | paused

function setUI(state) {
  _state = state
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

// 停止当前朗读并复位按钮（切换展品/开始生成/删除时调用）
export function infoTtsReset() {
  if (_state !== 'idle') stop()
  setUI('idle')
}

// 介绍文本就绪 → 按钮可用
export function infoTtsEnable() {
  const btn = document.getElementById('meshyTtsBtn')
  if (!btn) return
  btn.disabled = false
  setUI('idle')
}

// 介绍文本缺失（生成中/空态）→ 按钮禁用
export function infoTtsDisable() {
  const btn = document.getElementById('meshyTtsBtn')
  if (!btn) return
  btn.disabled = true
  setUI('idle')
}

// 按钮点击（模板 @click 直接绑定）：
// 朗读介绍 → 加载 → 播放中（点击暂停/继续）
export function handleInfoTtsClick() {
  if (_state === 'loading') return
  if (_state === 'playing') { pause(); setUI('paused'); return }
  if (_state === 'paused') { resume(); setUI('playing'); return }
  const text = document.getElementById('modelIntroText')?.textContent?.trim()
  if (!text || text === '✨ 正在生成展品介绍...' || text === '暂无展品，请选择或生成内容。') return
  setUI('loading')
  speak(text, null, () => setUI('playing'), () => setUI('idle'))
}
