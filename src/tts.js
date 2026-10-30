// 保留 master 的流式 MP3 起播（首块 3072B，后续 4096B）与 AudioContext 连续排期。
// 口型按解码块的真实播放时间采样，不再等待整句下载，也不在块边界强制闭嘴。
import { speechState, setSpeechAmplitude, setSpeechSampler, readSpeechAmplitude } from './utils/speechState.js'
import { createAudibleClock } from './utils/lipSync.js'
import { createStreamingLipSync } from './utils/streamingLipSync.js'

const FIRST_CHUNK_SIZE = 3072
const NEXT_CHUNK_SIZE = 4096
let currentCtx = null
const currentSources = new Set()
let currentReader = null
let abortController = null
let requestTimer = null
let ampRaf = null
let amplitudeClock = null
let generation = 0
let pending = false
let pauseIntent = false
let fallback = false

function stopAmplitude() {
  if (ampRaf !== null) cancelAnimationFrame(ampRaf)
  ampRaf = null
  amplitudeClock = null
  setSpeechSampler(null)
  setSpeechAmplitude(0)
}

function release() {
  stopAmplitude()
  speechState.active = speechState.paused = false
  clearTimeout(requestTimer)
  requestTimer = null
  abortController?.abort()
  abortController = null
  currentReader?.cancel().catch(() => {})
  currentReader = null
  // 必须停掉全部已排队的块，不只是最后一个 source。
  for (const source of currentSources) {
    source.onended = null
    try { source.stop() } catch {}
    source.disconnect()
  }
  currentSources.clear()
  if (currentCtx) {
    currentCtx.close().catch(() => {})
    currentCtx = null
  }
  window.speechSynthesis?.cancel()
  fallback = false
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
  const armTimeout = () => {
    clearTimeout(requestTimer)
    requestTimer = setTimeout(() => controller.abort(), 30000)
  }
  armTimeout()

  let finished = false, started = false, networkDone = false
  let lastEnd = 0, totalDuration = 0
  const lips = createStreamingLipSync()
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
      if (myGeneration !== generation) return
      if (pauseIntent) window.speechSynthesis.pause()
      setSpeechSampler(() => {
        if (utterance.volume === 0) return 0
        const t = performance.now() / 1000
        return 0.22 + Math.sin(t * 12) * 0.12 + Math.sin(t * 4) * 0.04
      })
      const loop = () => {
        if (myGeneration !== generation || !speechState.active) return
        readSpeechAmplitude()
        ampRaf = requestAnimationFrame(loop)
      }
      loop()
    }
    utterance.onend = utterance.onerror = finish
    window.speechSynthesis.speak(utterance)
  }

  // 在用户点击的同步调用栈中解锁；fetch 返回后再创建可能被浏览器自动播放策略拦住。
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    currentCtx = new AudioContext()
    if (currentCtx.state === 'suspended') currentCtx.resume().catch(() => {})
  } catch { /* 不支持 Web Audio 时可用浏览器朗读。 */ }
  const ctx = currentCtx
  const startPlaybackLoop = () => {
    const clock = createAudibleClock(ctx)
    amplitudeClock = clock
    setSpeechSampler(() => ctx.state !== 'running' || Number(settings.volume) === 0 ? 0 : lips.sample(clock()))
    const loop = () => {
      if (myGeneration !== generation || !speechState.active) return
      // 网络 EOF + 全部块渲染完 + 输出尾音播完，三者都满足才算整句结束。
      if (networkDone && !currentSources.size && !speechState.paused && clock() >= lastEnd) {
        finish()
        return
      }
      readSpeechAmplitude()
      ampRaf = requestAnimationFrame(loop)
    }
    loop()
  }

  ;(async () => {
    let reader
    try {
      const res = await fetch('/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, volume: settings.volume ?? 50, rate: settings.rate ?? 1.2,
          voice: settings.voice, language: settings.language,
          // 空方言指令（普通话）不发送，避免被后端校验拒绝后降级浏览器系统音
          instruction: settings.instruction?.trim() || undefined,
        }),
        signal: controller.signal,
      })
      if (myGeneration !== generation) return
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail.message || `TTS 请求失败 ${res.status}`)
      }
      if (!ctx) throw new Error('浏览器不支持 Web Audio')
      let buffer = new Uint8Array(0), retryAt = FIRST_CHUNK_SIZE
      const flush = async (force = false) => {
        if (!buffer.length || (!force && buffer.length < retryAt)) return
        let decoded
        try {
          decoded = await ctx.decodeAudioData(buffer.slice().buffer)
        } catch (error) {
          // 网络边界不是 MP3 帧边界：数据不足时保留字节，等下一批再试，不能直接丢段。
          if (force) throw error
          retryAt = buffer.length + 1024
          return
        }
        if (myGeneration !== generation) return
        buffer = new Uint8Array(0)
        retryAt = NEXT_CHUNK_SIZE
        if (pauseIntent && ctx.state === 'running') await ctx.suspend()
        else if (!pauseIntent && ctx.state === 'suspended') await ctx.resume()
        if (myGeneration !== generation) return
        const startAt = Math.max(lastEnd, ctx.currentTime)
        const source = ctx.createBufferSource()
        source.buffer = decoded
        source.connect(ctx.destination)
        lastEnd = startAt + decoded.duration
        totalDuration += decoded.duration
        currentSources.add(source)
        source.onended = () => {
          if (myGeneration !== generation) return
          currentSources.delete(source)
          source.disconnect()
        }
        source.start(startAt)
        // 先排期音频，再分析 PCM；嘴型计算不能推迟首块起播或造成块间音频空隙。
        lips.append(decoded, startAt)
        if (!started) {
          started = true
          pending = false
          speechState.active = true
          speechState.paused = pauseIntent
          startPlaybackLoop()
          onStart?.()
        }
      }
      if (res.body?.getReader) {
        reader = res.body.getReader()
        currentReader = reader
        while (myGeneration === generation) {
          armTimeout()
          const { done, value } = await reader.read()
          if (myGeneration !== generation) return
          if (done) break
          const merged = new Uint8Array(buffer.length + value.length)
          merged.set(buffer)
          merged.set(value, buffer.length)
          buffer = merged
          await flush()
        }
      } else {
        // 仅对不支持 ReadableStream 的环境兼容整段响应；现代浏览器走上面的首块起播。
        buffer = new Uint8Array(await res.arrayBuffer())
      }
      if (myGeneration !== generation) return
      await flush(true)
      if (myGeneration !== generation) return
      if (!started) throw new Error('TTS 未返回可解码音频')
      clearTimeout(requestTimer)
      networkDone = true
      lips.end()
      onDuration?.(totalDuration)
    } catch (error) {
      if (myGeneration !== generation) return
      clearTimeout(requestTimer)
      controller.abort()
      if (started) {
        // 已经起播时禁止浏览器兜底重读全文；让已排队音频播完，再统一结束。
        console.warn('[TTS] 音频流中断:', error.message)
        networkDone = true
        lips.end()
        onDuration?.(totalDuration)
      } else {
        console.warn('[TTS] 降级到浏览器朗读:', error.message)
        release()
        browserFallback()
      }
    } finally {
      reader?.releaseLock()
      if (currentReader === reader) currentReader = null
    }
  })()
}

export function pause() {
  amplitudeClock?.reset()
  pauseIntent = true
  speechState.paused = true
  setSpeechAmplitude(0)
  if (currentCtx?.state === 'running') currentCtx.suspend().catch(() => {})
  if (fallback) window.speechSynthesis?.pause()
}

export function resume() {
  amplitudeClock?.reset()
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
