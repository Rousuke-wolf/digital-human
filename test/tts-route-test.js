import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { request } from 'node:http'
import express from 'express'
import { createTtsRouter } from '../server/routes/tts.js'

class FakeSocket extends EventEmitter {
  readyState = 0
  sent = []
  send(data) { this.sent.push(JSON.parse(data)) }
  terminate() {
    this.readyState = 3
    queueMicrotask(() => this.emit('close'))
  }
  event(event, extra = {}) {
    this.emit('message', Buffer.from(JSON.stringify({ header: { event, ...extra } })), false)
  }
  audio(data = 'fake-mp3-data') { this.emit('message', Buffer.from(data), true) }
}

async function setup(t, options = {}) {
  let resolveSocket
  const socketReady = new Promise((resolve) => { resolveSocket = resolve })
  const app = express()
  app.use(express.json())
  app.use('/tts', createTtsRouter({
    apiKey: 'test-key',
    createSocket() {
      const socket = new FakeSocket()
      setImmediate(() => {
        socket.readyState = 1
        socket.emit('open')
        resolveSocket(socket)
      })
      return socket
    },
    ...options,
  }))
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve) }))
  const url = `http://127.0.0.1:${server.address().port}/tts`
  const post = (body = { text: '你好' }) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return { socketReady, post, url }
}

test('等待 task-started 后发送文本，task-finished 之前已能读取首块 MP3', { timeout: 2000 }, async (t) => {
  const { post, socketReady } = await setup(t)
  const response = post()
  const socket = await socketReady
  assert.equal(socket.sent.length, 1)
  const run = socket.sent[0]
  assert.equal(run.header.action, 'run-task')
  assert.equal(run.payload.model, process.env.DASHSCOPE_TTS_MODEL || 'qwen-audio-3.1-tts-flash')
  assert.equal(run.payload.parameters.voice, process.env.DASHSCOPE_TTS_VOICE || 'anruorou_v3.1')
  socket.event('task-started')
  socket.event('task-started')
  assert.deepEqual(socket.sent.map((m) => m.header.action), ['run-task', 'continue-task', 'finish-task'])
  assert.ok(socket.sent.every((m) => m.header.task_id === run.header.task_id))
  assert.equal(socket.sent[1].payload.input.text, '你好')
  socket.audio('part1')
  const res = await response
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /audio\/mpeg/)
  assert.equal(res.headers.get('x-accel-buffering'), 'no')
  const reader = res.body.getReader()
  const first = await reader.read()
  assert.equal(Buffer.from(first.value).toString(), 'part1', '首包不能等合成全部结束')
  socket.audio('part2')
  socket.event('task-finished')
  const remaining = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    remaining.push(Buffer.from(value))
  }
  assert.equal(Buffer.concat(remaining).toString(), 'part2')
  assert.equal(socket.readyState, 3)
})

test('引擎与音色可配置，调用方仍可覆盖音色/音量/语速', async (t) => {
  const { post, socketReady } = await setup(t, { model: 'custom-engine', defaultVoice: 'configured-voice' })
  const response = post({ text: '试听', voice: 'custom-voice', volume: 30, rate: 0.8 })
  const socket = await socketReady
  assert.equal(socket.sent[0].payload.model, 'custom-engine')
  assert.deepEqual(socket.sent[0].payload.parameters, {
    voice: 'custom-voice', volume: 30, rate: 0.8, format: 'mp3', sample_rate: 22050, pitch: 1,
  })
  socket.audio()
  socket.event('task-finished')
  assert.equal((await response).status, 200)
})

test('起播前音色不支持时返回明确 JSON 错误', async (t) => {
  const { post, socketReady } = await setup(t)
  const response = post()
  const socket = await socketReady
  socket.event('task-failed', { error_code: 'InvalidParameter', error_message: 'voice not supported' })
  const res = await response
  assert.equal(res.status, 502)
  assert.match((await res.json()).message, /voice not supported/)
  assert.equal(socket.readyState, 3)
})

test('首块已发送后上游失败会中断流，不把 JSON 混入 MP3 或伪装为正常 EOF', { timeout: 2000 }, async (t) => {
  const { post, socketReady } = await setup(t)
  const response = post()
  const socket = await socketReady
  socket.audio('first-audio')
  const res = await response
  const reader = res.body.getReader()
  assert.equal(Buffer.from((await reader.read()).value).toString(), 'first-audio')
  const reading = reader.read()
  socket.event('task-failed', { error_message: 'stream failed' })
  await assert.rejects(reading)
  assert.equal(socket.readyState, 3)
})

test('上游鉴权 401 提示修复密钥，不返回 200 空音频', async (t) => {
  const { post, socketReady } = await setup(t)
  const response = post()
  const socket = await socketReady
  socket.emit('error', new Error('Unexpected server response: 401'))
  const res = await response
  assert.equal(res.status, 502)
  assert.match((await res.json()).message, /401.*DASHSCOPE_TTS_KEY/)
})

for (const scenario of ['empty', 'early-close', 'timeout']) {
  test(`异常收尾 ${scenario} 不播放残缺音频并释放连接`, async (t) => {
    const { post, socketReady } = await setup(t, { timeoutMs: scenario === 'timeout' ? 30 : 30000 })
    const response = post()
    const socket = await socketReady
    if (scenario === 'empty') socket.event('task-finished')
    if (scenario === 'early-close') socket.terminate()
    const res = await response
    assert.equal(res.status, scenario === 'timeout' ? 504 : 502)
    assert.match(res.headers.get('content-type'), /json/)
    assert.equal(socket.readyState, 3)
  })
}

test('客户端取消时终止上游合成', async (t) => {
  const { url, socketReady } = await setup(t)
  const req = request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
  req.on('error', () => {})
  req.end(JSON.stringify({ text: '取消这次合成' }))
  const socket = await socketReady
  const closed = new Promise((resolve) => socket.once('close', resolve))
  req.destroy()
  await closed
  assert.equal(socket.readyState, 3)
})

test('空文本、非法参数及缺失密钥都有非 200 响应', async (t) => {
  const { post } = await setup(t, { apiKey: '' })
  for (const body of [{ text: '' }, { text: 123 }, { text: '你好', volume: 'bad' }, { text: '你好', rate: 8 }]) {
    assert.equal((await post(body)).status, 400)
  }
  assert.equal((await post()).status, 503)
})
