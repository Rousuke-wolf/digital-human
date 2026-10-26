// 完整解码连续 MP3 后播放：网络分块不等于音频帧，不能逐块 decodeAudioData。
// 共用播放状态驱动所有页面的 Live2D 口型；暂停、停止、结束时清零振幅。
import { speechState, setSpeechAmplitude } from './utils/speechState.js'

let currentCtx = null
let currentSource = null
let abortController = null
let ampRaf = null
let generation = 0
let pending = false
let pauseIntent = false
let fallback = false

function stopAmplitude() {
  if (ampRaf !== null) cancelAnimationFrame(ampRaf)
  ampRaf = null
  setSpeechAmplitude(0)
}

function release() {
  stopAmplitude()
  speechState.active = speechState.paused = false
  abortController?.abort()
  abortController = null
  if (currentSource) {
    currentSource.onended = null
    try { currentSource.stop() } catch {}
    currentSource.disconnect()
    currentSource = null
  }
  if (currentCtx) {
    currentCtx.close().catch(() => {})
    currentCtx = null
  }
  window.speechSynthesis?.cancel()
  fallback = false
}

function startAmplitude(analyser, myGeneration) {
  const samples = new Float32Array(analyser.fftSize)
  const loop = () => {
    if (generation !== myGeneration || !speechState.active) return
    if (speechState.paused) setSpeechAmplitude(0)
    else {
      analyser.getFloatTimeDomainData(samples)
      let energy = 0
      for (const sample of samples) energy += sample * sample
      const rms = Math.sqrt(energy / samples.length)
      setSpeechAmplitude(rms < 0.008 ? 0 : rms * 7)
    }
    ampRaf = requestAnimationFrame(loop)
  }
  loop()
}

export function setVoiceProfile(profile) {
  window._ttsSettings = { ...window._ttsSettings, ...profile }
}

export function speak(text, onDuration, onStart, onEnd, opts = {}) {
  if (!text?.trim()) return
  const myGeneration = ++generation
  release()
  pending = true
  pauseIntent = false
  const settings = { ...window._ttsSettings, ...opts }
  const controller = new AbortController()
  abortController = controller
  const timeout = setTimeout(() => controller.abort(), 30000)

  let finished = false
  const finish = () => {
    if (myGeneration !== generation || finished) return
    finished = true
    pending = false
    pauseIntent = false
    release()
    onEnd?.()
  }
  const browserFallback = () => {
    if (myGeneration !== generation) return
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { finish(); return }
    fallback = true
    const utterance = new window.SpeechSynthesisUtterance(text)
    utterance.lang = settings.lang || 'zh-CN'
    utterance.volume = Math.max(0, Math.min(1, (settings.volume ?? 50) / 100))
    utterance.rate = settings.rate ?? 1.2
    utterance.onstart = () => {
      if (myGeneration !== generation) return
      pending = false
      speechState.active = true
      speechState.paused = pauseIntent
      onStart?.()
      if (pauseIntent) window.speechSynthesis.pause()
      // speechSynthesis 无法读取真实波形：用节奏近似口型，不冒充音量分析。
      const loop = () => {
        if (myGeneration !== generation || !speechState.active) return
        const t = performance.now() / 1000
        const amplitude = 0.12 + Math.max(0, Math.sin(t * 19)) * 0.38 + Math.max(0, Math.sin(t * 7)) * 0.15
        setSpeechAmplitude(speechState.paused || utterance.volume === 0 ? 0 : amplitude)
        ampRaf = requestAnimationFrame(loop)
      }
      loop()
    }
    utterance.onend = utterance.onerror = finish
    window.speechSynthesis.speak(utterance)
  }

  // 尽量在用户点击的同步调用栈里解锁 AudioContext。
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    currentCtx = new AudioContext()
    if (currentCtx.state === 'suspended') currentCtx.resume().catch(() => {})
  } catch { /* 不支持 Web Audio 时仍可用浏览器朗读。 */ }
  const ctx = currentCtx

  ;(async () => {
    try {
      const res = await fetch('/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, volume: settings.volume ?? 50, rate: settings.rate ?? 1.2,
          voice: settings.voice || 'longling_v2', language: settings.language,
        }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`TTS 请求失败 ${res.status}`)
      const audio = await res.arrayBuffer()
      clearTimeout(timeout)
      if (myGeneration !== generation) return
      if (!ctx) throw new Error('浏览器不支持 Web Audio')
      const decoded = await ctx.decodeAudioData(audio)
      if (myGeneration !== generation) return
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.3
      analyser.connect(ctx.destination)
      const source = ctx.createBufferSource()
      source.buffer = decoded
      source.connect(analyser)
      currentSource = source
      source.onended = finish
      if (pauseIntent) await ctx.suspend()
      else if (ctx.state === 'suspended') await ctx.resume()
      if (myGeneration !== generation) return
      source.start()
      pending = false
      speechState.active = true
      speechState.paused = pauseIntent
      startAmplitude(analyser, myGeneration)
      onDuration?.(decoded.duration)
      onStart?.()
    } catch (error) {
      clearTimeout(timeout)
      if (myGeneration !== generation) return
      console.warn('[TTS] 降级到浏览器朗读:', error.message)
      // 释放本次 Web Audio，但不 cancel 新建的 utterance。
      if (currentCtx) { currentCtx.close().catch(() => {}); currentCtx = null }
      stopAmplitude()
      browserFallback()
    }
  })()
}

export function pause() {
  pauseIntent = true
  speechState.paused = true
  setSpeechAmplitude(0)
  if (currentCtx?.state === 'running') currentCtx.suspend().catch(() => {})
  if (fallback) window.speechSynthesis?.pause()
}

export function resume() {
  pauseIntent = false
  speechState.paused = false
  if (currentCtx?.state === 'suspended') currentCtx.resume().catch(() => {})
  if (fallback) window.speechSynthesis?.resume()
}

export function stop() {
  generation++
  pending = pauseIntent = false
  release()
}

export function isPlaying() {
  return (pending || speechState.active) && !speechState.paused
}

export function isPaused() {
  return (pending || speechState.active) && speechState.paused
}
