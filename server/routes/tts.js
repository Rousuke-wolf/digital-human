import '../env.js'
import { Router } from 'express'
import { WebSocket } from 'ws'
import { randomUUID } from 'crypto'

const WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference'

// 默认音色集中在后端，普通播报、多语言和教学页都遵循同一配置。
// model/voice 必须是账号支持的配对；可在 server/.env 中调整，不再锁死 v2。
export function createTtsRouter({
  apiKey = process.env.DASHSCOPE_TTS_KEY,
  model = process.env.DASHSCOPE_TTS_MODEL || 'cosyvoice-v3-flash',
  defaultVoice = process.env.DASHSCOPE_TTS_VOICE || 'guxiaoran_v3.1',
  createSocket = (url, options) => new WebSocket(url, options),
  timeoutMs = 30000,
} = {}) {
  const router = Router()
  router.post('/', (req, res) => {
    const { text, volume = 50, rate = 1.2, voice } = req.body || {}
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: '文本不能为空' })
    }
    const useVolume = Number(volume)
    const useRate = Number(rate)
    if (!Number.isFinite(useVolume) || useVolume < 0 || useVolume > 100
      || !Number.isFinite(useRate) || useRate < 0.5 || useRate > 2
      || (voice !== undefined && (typeof voice !== 'string' || !voice.trim()))) {
      return res.status(400).json({ message: '无效的音量、语速或音色参数' })
    }
    if (!apiKey) {
      return res.status(503).json({ message: 'TTS 服务未配置，请在 server/.env 中设置 DASHSCOPE_TTS_KEY' })
    }

    const taskId = randomUUID()
    const useVoice = voice || defaultVoice
    const ws = createSocket(WS_URL, { headers: { Authorization: `bearer ${apiKey}` } })
    const chunks = []
    let size = 0, done = false, started = false
    const cleanup = () => {
      clearTimeout(timer)
      if (ws.readyState !== WebSocket.CLOSED) ws.terminate()
    }
    const fail = (message, status = 502) => {
      if (done) return
      done = true
      console.warn('[TTS]', message)
      res.status(status).json({ message })
      cleanup()
    }
    const timer = setTimeout(() => fail('TTS 合成超时，请稍后重试', 504), timeoutMs)
    res.on('close', () => { done = true; cleanup() })
    const send = (action, payload) => ws.send(JSON.stringify({
      header: { action, task_id: taskId, streaming: 'duplex' }, payload,
    }))

    ws.on('open', () => {
      if (done) return
      send('run-task', {
        task_group: 'audio', task: 'tts', function: 'SpeechSynthesizer', model,
        parameters: {
          voice: useVoice, format: 'mp3', sample_rate: 22050,
          volume: useVolume, rate: useRate, pitch: 1.0,
        },
        input: {},
      })
    })
    ws.on('message', (data, isBinary) => {
      if (done) return
      if (isBinary) {
        size += data.length
        if (size > 20 * 1024 * 1024) { fail('TTS 音频过大，请缩短文本'); return }
        chunks.push(Buffer.from(data))
        return
      }
      let msg
      try { msg = JSON.parse(data.toString()) } catch { fail('TTS 服务返回了无效数据'); return }
      switch (msg?.header?.event) {
        case 'task-started':
          if (started) return
          started = true
          // 必须等待 task-started，不能在 WebSocket open 时抢先发送文本。
          send('continue-task', { input: { text } })
          send('finish-task', { input: {} })
          break
        case 'task-finished':
          if (!size) { fail('TTS 未返回音频，请检查模型与音色配置'); return }
          done = true
          // 前端需要完整 MP3 才能解码。确认任务成功后再返回，避免把失败/残缺音频报成 200。
          res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' }).send(Buffer.concat(chunks))
          cleanup()
          break
        case 'task-failed':
          fail(`TTS 合成失败（${model} / ${useVoice}）：${msg.header.error_message || msg.header.error_code || '请检查音色权限与配置'}`)
          break
      }
    })
    ws.on('close', () => { if (!done) fail('TTS 连接提前关闭，未收到完整音频') })
    ws.on('error', (error) => {
      fail(error.message.includes('401')
        ? 'TTS 鉴权失败（401），请检查 server/.env 中的 DASHSCOPE_TTS_KEY 及所属地域'
        : 'TTS 服务连接失败，请检查网络与服务配置')
    })
  })
  return router
}

export default createTtsRouter()
