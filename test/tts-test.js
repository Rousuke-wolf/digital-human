import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { speechState, readSpeechAmplitude } from '../src/utils/speechState.js'
import { makeAudioBuffer } from './helpers/audio.js'

let frames = new Map()
let nextFrame = 0
const contexts = []
const spoken = []
globalThis.requestAnimationFrame = (fn) => { frames.set(++nextFrame, fn); return nextFrame }
globalThis.cancelAnimationFrame = (id) => frames.delete(id)
class FakeContext {
  state = 'running'
  currentTime = 10
  baseLatency = 0.02
  outputLatency = 0.08
  constructor() { contexts.push(this) }
  resume() { this.state = 'running'; return Promise.resolve() }
  suspend() { this.state = 'suspended'; return Promise.resolve() }
  close() { this.state = 'closed'; return Promise.resolve() }
  decodeAudioData() { return Promise.resolve(makeAudioBuffer()) }
  createBufferSource() {
    this.source = {
      connect() {}, disconnect() {}, start(time) { this.startedAt = time }, stop() {}, onended: null,
    }
    return this.source
  }
}
globalThis.window = {
  AudioContext: FakeContext,
  SpeechSynthesisUtterance: class { constructor(text) { this.text = text } },
  speechSynthesis: { cancel() {}, pause() {}, resume() {}, speak(u) { spoken.push(u) } },
}
const { speak, pause, resume, stop, isPlaying, isPaused, setVoiceProfile } = await import('../src/tts.js')
const { teachSpeak } = await import('../src/tts-teach.js')
const tick = () => new Promise((resolve) => setImmediate(resolve))
const success = () => Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
function runFrame() {
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach((fn) => fn())
}
afterEach(() => { stop(); frames.clear(); window._ttsSettings = {} })

test('口型跟随扬声器时钟、停顿及暂停，尾音真正播完才触发结束', async () => {
  globalThis.fetch = success
  let starts = 0, ends = 0, duration = 0
  speak('刺绣介绍', (value) => { duration = value }, () => { starts++ }, () => { ends++ })
  assert.equal(speechState.active, false)
  await tick()
  const ctx = contexts.at(-1)
  assert.equal(starts, 1)
  assert.equal(duration, 2.4)
  assert.equal(ctx.source.startedAt, 10)
  assert.equal(speechState.active, true)
  assert.equal(speechState.amplitude, 0, '输出延迟期间闭嘴')
  ctx.currentTime = 10.15
  runFrame()
  assert.equal(speechState.amplitude, 0, '输出音频仍处于首部静音')
  ctx.currentTime = 10.3
  runFrame()
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
  ctx.currentTime = 10.7
  runFrame()
  assert.equal(speechState.amplitude, 0, '语句间停顿立即闭嘴')
  ctx.currentTime = 11.5
  runFrame()
  assert.ok(speechState.amplitude > 0, '掉帧后仍按音频进度取值')
  ctx.currentTime = 12.4
  ctx.source.onended()
  runFrame()
  assert.equal(ends, 0)
  assert.equal(ctx.state, 'running', '不能提前关闭 AudioContext 截断尾音')
  assert.ok(speechState.amplitude > 0)
  ctx.currentTime = 12.51
  runFrame()
  assert.equal(ends, 1)
  assert.equal(speechState.active, false)
  assert.equal(speechState.amplitude, 0)
  assert.equal(frames.size, 0)
})

test('模型绘制前可直接采样当前音频，不依赖播放器 RAF 是否已执行', async () => {
  globalThis.fetch = success
  speak('当前帧口型')
  await tick()
  const ctx = contexts.at(-1)
  assert.equal(speechState.amplitude, 0)
  ctx.currentTime = 10.3
  // 不执行 runFrame，模拟模型绘制先于播放器 RAF。
  assert.ok(readSpeechAmplitude() > 0)
  ctx.currentTime = 10.7
  assert.equal(readSpeechAmplitude(), 0)
  ctx.currentTime = 11.5
  assert.ok(readSpeechAmplitude() > 0)
  pause()
  assert.equal(readSpeechAmplitude(), 0)
  resume()
  assert.ok(readSpeechAmplitude() > 0)
  const oldFrames = [...frames.values()]
  stop()
  assert.equal(readSpeechAmplitude(), 0)
  oldFrames.forEach((fn) => fn())
  assert.equal(readSpeechAmplitude(), 0, '旧 RAF 不能恢复已释放的采样器')
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

test('等待合成时暂停，解码后仍不张嘴；恢复后跟随原音频时钟', async () => {
  globalThis.fetch = success
  speak('暂停中的回答')
  pause()
  await tick()
  const ctx = contexts.at(-1)
  assert.equal(ctx.state, 'suspended')
  assert.equal(isPaused(), true)
  runFrame()
  assert.equal(speechState.amplitude, 0)
  resume()
  ctx.currentTime = 10.3
  runFrame()
  assert.ok(speechState.amplitude > 0)
  stop()
  runFrame()
  assert.equal(speechState.amplitude, 0)
  assert.equal(frames.size, 0)
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
  runFrame()
  assert.equal(oldEnds, 0)
  assert.equal(speechState.active, true)
  assert.equal(requests.at(-1).voice, 'demo-voice')
  assert.equal(requests.at(-1).language, 'ja')
})

test('普通播报和教学页不再强制旧音色，静音设置不会驱动嘴型', async () => {
  const requests = []
  globalThis.fetch = (_url, opts) => { requests.push(JSON.parse(opts.body)); return success() }
  speak('普通播报', null, null, null, { volume: 0 })
  await tick()
  contexts.at(-1).currentTime = 10.3
  runFrame()
  assert.equal(speechState.amplitude, 0)
  teachSpeak('教学播报')
  await tick()
  assert.equal(requests.length, 2)
  assert.ok(requests.every((request) => !('voice' in request)))
})

test('服务未接入时浏览器兜底仍有近似口型，结束与停止会闭嘴', async () => {
  globalThis.fetch = () => Promise.resolve({ ok: false, status: 503, json: async () => ({ message: 'TTS 服务未配置' }) })
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
