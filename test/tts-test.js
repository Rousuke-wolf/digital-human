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
  sources = []
  decodeSizes = []
  failDecodes = 0
  constructor() { contexts.push(this) }
  resume() { this.state = 'running'; return Promise.resolve() }
  suspend() { this.state = 'suspended'; return Promise.resolve() }
  close() { this.state = 'closed'; return Promise.resolve() }
  decodeAudioData(data) {
    this.decodeSizes.push(data.byteLength)
    if (this.failDecodes-- > 0) return Promise.reject(new Error('incomplete MP3 frame'))
    return Promise.resolve(makeAudioBuffer())
  }
  createBufferSource() {
    this.source = {
      connect() {}, disconnect() {}, start(time) { this.startedAt = time },
      stop() { this.stopped = true }, onended: null,
    }
    this.sources.push(this.source)
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
function streamingResponse() {
  let controller
  const body = new ReadableStream({ start(value) { controller = value } })
  globalThis.fetch = async () => ({
    ok: true, body, arrayBuffer() { throw new Error('流式响应不能等待整段 arrayBuffer') },
  })
  return {
    push(size) { controller.enqueue(new Uint8Array(size)) },
    end() { controller.close() },
    fail() { controller.error(new Error('network stream failed')) },
  }
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

test('首块 3072B 在 EOF 前起播，后续 4096B 连续排期，只在整句结束后回调', async () => {
  const stream = streamingResponse()
  let starts = 0, ends = 0, duration = 0
  speak('流式回答', (value) => { duration = value }, () => { starts++ }, () => { ends++ })
  stream.push(3071)
  await tick()
  const ctx = contexts.at(-1)
  assert.equal(ctx.sources.length, 0)
  stream.push(1)
  await tick()
  assert.equal(starts, 1, '未结束下载即可起播')
  assert.deepEqual(ctx.decodeSizes, [3072])
  assert.equal(ctx.sources[0].startedAt, 10)
  stream.push(4095)
  await tick()
  assert.equal(ctx.sources.length, 1)
  stream.push(1)
  await tick()
  assert.deepEqual(ctx.decodeSizes, [3072, 4096])
  assert.equal(ctx.sources[1].startedAt, 12.4)
  assert.equal(starts, 1)
  ctx.currentTime = 12.4
  ctx.sources[0].onended()
  runFrame()
  assert.equal(ends, 0)
  stream.end()
  await tick()
  assert.equal(duration, 4.8)
  assert.equal(ends, 0, 'EOF 不等于扬声器已经播完')
  ctx.currentTime = 14.8
  ctx.sources[1].onended()
  runFrame()
  assert.equal(ends, 0)
  ctx.currentTime = 14.91
  runFrame()
  assert.equal(ends, 1)
})

test('音频在 PCM 口型分析之前已排期，不增加首块起播等待', async () => {
  const stream = streamingResponse()
  speak('先播音频再算口型')
  const ctx = contexts.at(-1)
  const pcmReads = []
  ctx.decodeAudioData = async () => {
    const buffer = makeAudioBuffer()
    const getChannelData = buffer.getChannelData
    buffer.getChannelData = (channel) => {
      pcmReads.push(ctx.sources.at(-1)?.startedAt)
      return getChannelData(channel)
    }
    return buffer
  }
  stream.push(3072)
  await tick()
  assert.ok(pcmReads.length > 0)
  assert.ok(pcmReads.every((time) => time === 10))
  assert.equal(speechState.active, true)
  stream.end()
  await tick()
})

test('短句不足首块阈值时在 EOF 解码起播，不遗漏末块', async () => {
  const stream = streamingResponse()
  let starts = 0
  speak('短句', null, () => { starts++ })
  stream.push(1024)
  await tick()
  const ctx = contexts.at(-1)
  assert.equal(starts, 0)
  stream.end()
  await tick()
  assert.equal(starts, 1)
  assert.deepEqual(ctx.decodeSizes, [1024])
})

test('停止时尚未完成的分块解码不能启动旧音频，也不能干扰新播报', async () => {
  const stream = streamingResponse()
  let oldStarts = 0, oldEnds = 0, finishDecode
  speak('旧回答', null, () => { oldStarts++ }, () => { oldEnds++ })
  const oldCtx = contexts.at(-1)
  oldCtx.decodeAudioData = () => new Promise((resolve) => { finishDecode = resolve })
  stream.push(3072)
  await tick()
  assert.equal(typeof finishDecode, 'function')
  globalThis.fetch = success
  speak('新回答')
  await tick()
  finishDecode(makeAudioBuffer())
  await tick()
  assert.equal(oldCtx.state, 'closed')
  assert.equal(oldCtx.sources.length, 0)
  assert.equal(oldStarts, 0)
  assert.equal(oldEnds, 0)
  assert.equal(contexts.at(-1).sources.length, 1)
  assert.equal(speechState.active, true)
})

test('流式欠载不会提前结束或触发点头；下一块到达可继续播放', async () => {
  const stream = streamingResponse()
  let ends = 0
  speak('网络慢的回答', null, null, () => { ends++ })
  stream.push(3072)
  await tick()
  const ctx = contexts.at(-1)
  ctx.currentTime = 12.7
  ctx.sources[0].onended()
  runFrame()
  assert.equal(ends, 0)
  assert.equal(speechState.active, true)
  assert.equal(readSpeechAmplitude(), 0, '没有排队音频时不能空动嘴')
  stream.push(4096)
  await tick()
  assert.equal(ctx.sources[1].startedAt, 12.7)
  ctx.currentTime = 13
  assert.ok(readSpeechAmplitude() > 0)
  stream.end()
  await tick()
})

test('流式暂停覆盖后续排队块，停止会释放全部 source 而非只停最后一块', async () => {
  const stream = streamingResponse()
  speak('排队的回答')
  stream.push(3072)
  await tick()
  const ctx = contexts.at(-1)
  pause()
  stream.push(4096)
  await tick()
  assert.equal(ctx.sources.length, 2)
  assert.equal(ctx.state, 'suspended')
  assert.equal(readSpeechAmplitude(), 0)
  resume()
  assert.equal(ctx.state, 'running')
  stop()
  assert.ok(ctx.sources.every((source) => source.stopped && source.onended === null))
  assert.equal(readSpeechAmplitude(), 0)
  await tick()
})

test('解码失败时保留不完整字节等待下一块，不直接丢弃音频', async () => {
  const stream = streamingResponse()
  speak('跨网络块的 MP3')
  const ctx = contexts.at(-1)
  ctx.failDecodes = 1
  stream.push(3072)
  await tick()
  assert.equal(ctx.sources.length, 0)
  stream.push(1024)
  await tick()
  assert.deepEqual(ctx.decodeSizes, [3072, 4096])
  assert.equal(ctx.sources.length, 1)
  stream.end()
  await tick()
})

test('起播后网络断开不会兜底重读全文，已排队音频播完后正常清理', async () => {
  const stream = streamingResponse()
  const spokenBefore = spoken.length
  let ends = 0
  speak('中断的回答', null, null, () => { ends++ })
  stream.push(3072)
  await tick()
  const ctx = contexts.at(-1)
  stream.fail()
  await tick()
  assert.equal(spoken.length, spokenBefore)
  assert.equal(speechState.active, true)
  ctx.currentTime = 12.51
  ctx.sources[0].onended()
  runFrame()
  assert.equal(ends, 1)
  assert.equal(speechState.active, false)
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
