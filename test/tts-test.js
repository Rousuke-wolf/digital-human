import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { speechState } from '../src/utils/speechState.js'

let frames = new Map()
let nextFrame = 0
let signalLevel = 0.05
const contexts = []
const spoken = []
globalThis.requestAnimationFrame = (fn) => { frames.set(++nextFrame, fn); return nextFrame }
globalThis.cancelAnimationFrame = (id) => frames.delete(id)
class FakeContext {
  state = 'running'
  constructor() { contexts.push(this) }
  resume() { this.state = 'running'; return Promise.resolve() }
  suspend() { this.state = 'suspended'; return Promise.resolve() }
  close() { this.state = 'closed'; return Promise.resolve() }
  decodeAudioData() { return Promise.resolve({ duration: 2.4 }) }
  createAnalyser() {
    return { fftSize: 512, connect() {}, getFloatTimeDomainData(samples) { samples.fill(signalLevel) } }
  }
  createBufferSource() {
    this.source = { connect() {}, disconnect() {}, start() {}, stop() {}, onended: null }
    return this.source
  }
}
globalThis.window = {
  AudioContext: FakeContext,
  SpeechSynthesisUtterance: class { constructor(text) { this.text = text } },
  speechSynthesis: { cancel() {}, pause() {}, resume() {}, speak(u) { spoken.push(u) } },
}
const { speak, pause, resume, stop, isPlaying, isPaused, setVoiceProfile } = await import('../src/tts.js')
const tick = () => new Promise((resolve) => setImmediate(resolve))
const success = () => Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
function runFrame() {
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach((fn) => fn())
}
afterEach(() => { stop(); frames.clear() })

test('音频真实振幅驱动口型；暂停、恢复、结束同步状态与回调', async () => {
  globalThis.fetch = success
  let starts = 0, ends = 0, duration = 0
  speak('刺绣介绍', (value) => { duration = value }, () => { starts++ }, () => { ends++ })
  assert.equal(speechState.active, false)
  await tick()
  assert.equal(starts, 1)
  assert.equal(duration, 2.4)
  assert.equal(speechState.active, true)
  assert.ok(speechState.amplitude > 0)
  pause()
  runFrame()
  assert.equal(isPlaying(), false)
  assert.equal(isPaused(), true)
  assert.equal(speechState.amplitude, 0)
  resume()
  runFrame()
  assert.equal(isPlaying(), true)
  assert.ok(speechState.amplitude > 0)
  signalLevel = 0
  runFrame()
  assert.equal(speechState.amplitude, 0)
  signalLevel = 0.05
  contexts.at(-1).source.onended()
  assert.equal(ends, 1)
  assert.equal(speechState.active, false)
  assert.equal(speechState.amplitude, 0)
  assert.equal(frames.size, 0)
})

test('停止等待中的合成请求不会发生延迟起播或降级幽灵播放', async () => {
  let oldStarts = 0, oldEnds = 0
  const oldSpoken = spoken.length
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  })
  speak('旧回答', null, () => { oldStarts++ }, () => { oldEnds++ })
  stop()
  await tick()
  assert.equal(oldStarts, 0)
  assert.equal(oldEnds, 0)
  assert.equal(spoken.length, oldSpoken)
  assert.equal(speechState.active, false)
})

test('音色与语言透传；替换播报后旧音频回调无效', async () => {
  const requests = []
  globalThis.fetch = (_url, opts) => { requests.push(JSON.parse(opts.body)); return success() }
  setVoiceProfile({ voice: 'demo-voice', language: 'ja', lang: 'ja-JP' })
  let oldEnds = 0
  speak('旧音频', null, null, () => { oldEnds++ })
  await tick()
  const oldFinish = contexts.at(-1).source.onended
  speak('新音频')
  await tick()
  oldFinish()
  assert.equal(oldEnds, 0)
  assert.equal(speechState.active, true)
  assert.equal(requests.at(-1).voice, 'demo-voice')
  assert.equal(requests.at(-1).language, 'ja')
})

test('服务未接入时浏览器兜底仍有近似口型，结束与停止会闭嘴', async () => {
  globalThis.fetch = () => Promise.resolve({ ok: false, status: 503 })
  let starts = 0, ends = 0
  speak('浏览器朗读', null, () => { starts++ }, () => { ends++ })
  await tick()
  const utterance = spoken.at(-1)
  assert.equal(starts, 0)
  utterance.onstart()
  assert.equal(starts, 1)
  assert.ok(speechState.amplitude > 0)
  pause()
  runFrame()
  assert.equal(speechState.amplitude, 0)
  resume()
  runFrame()
  assert.ok(speechState.amplitude > 0)
  utterance.onend()
  utterance.onerror()
  assert.equal(ends, 1)
  assert.equal(speechState.active, false)
  assert.equal(speechState.amplitude, 0)
})
