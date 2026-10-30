import '../env.js'
import { Router } from 'express'
import { WebSocket } from 'ws'
import { randomUUID } from 'crypto'

const WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference'

export function createTtsRouter({
  apiKey = process.env.DASHSCOPE_TTS_KEY,
  model = process.env.DASHSCOPE_TTS_MODEL || 'qwen-audio-3.1-tts-flash',
  defaultVoice = process.env.DASHSCOPE_TTS_VOICE || 'anruorou_v3.1',
  cloneVoice = process.env.DASHSCOPE_TTS_CLONE_VOICE || '',
  createSocket = (url, options) => new WebSocket(url, options),
  timeoutMs = 20000,
} = {}) {
  const router = Router()
  router.post('/', (req, res) => {
    const { text, volume = 50, rate = 1.2, voice, instruction } = req.body || {}
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: '文本不能为空' })
    }
    const useVolume = Number(volume), useRate = Number(rate)
    if (!Number.isFinite(useVolume) || useVolume < 0 || useVolume > 100
      || !Number.isFinite(useRate) || useRate < 0.5 || useRate > 2
      || (voice !== undefined && (typeof voice !== 'string' || !voice.trim()))
      || (instruction !== undefined && (typeof instruction !== 'string' || instruction.length > 100))) {
      return res.status(400).json({ message: '无效的音量、语速、音色或方言指令参数' })
    }
    if (!apiKey) {
      return res.status(503).json({ message: 'TTS 服务未配置，请在 server/.env 中设置 DASHSCOPE_TTS_KEY' })
    }

    // 方言模式（带 instruction）：优先使用复刻的绫韵声线（声线一致 + 方言指令），
    // 未配置复刻音色时退回显式 voice / 默认音色。无 instruction 时维持常规音色。
    const useVoice = instruction ? (cloneVoice || voice || defaultVoice) : (voice || defaultVoice)
    const taskId = randomUUID()
    const ws = createSocket(WS_URL, { headers: { Authorization: `bearer ${apiKey}` } })
    let size = 0, done = false, started = false, timer
    const cleanup = () => {
      clearTimeout(timer)
      if (ws.readyState !== WebSocket.CLOSED) ws.terminate()
    }
    const fail = (message, status = 502) => {
      if (done) return
      done = true
      console.warn('[TTS]', message)
      // 起播前保留可读错误；流式头已发出后中断连接，不能往 MP3 中混入 JSON。
      if (res.headersSent) res.destroy()
      else res.status(status).json({ message })
      cleanup()
    }
    const armTimeout = () => {
      clearTimeout(timer)
      timer = setTimeout(() => fail('TTS 合成超时，请稍后重试', 504), timeoutMs)
    }
    armTimeout()
    res.on('close', () => { done = true; cleanup() })
    res.on('drain', () => { if (!done) ws.resume?.() })
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
          ...(instruction ? { instruction } : {}),
        },
        input: {},
      })
    })
    ws.on('message', (data, isBinary) => {
      if (done) return
      armTimeout()
      if (isBinary) {
        size += data.length
        if (size > 20 * 1024 * 1024) { fail('TTS 音频过大，请缩短文本'); return }
        if (!data.length) return
        if (!res.headersSent) {
          res.set({
            'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store',
            'X-Accel-Buffering': 'no',
          })
        }
        // 保留 master 的低延迟链路：收到即写，不等待 task-finished/Buffer.concat。
        if (!res.write(data)) ws.pause?.()
        return
      }
      let msg
      try { msg = JSON.parse(data.toString()) } catch { fail('TTS 服务返回了无效数据'); return }
      switch (msg?.header?.event) {
        case 'task-started':
          if (started) return
          started = true
          send('continue-task', { input: { text } })
          send('finish-task', { input: {} })
          break
        case 'task-finished':
          if (!size) { fail('TTS 未返回音频，请检查模型与音色配置'); return }
          done = true
          // 主动收尾，不等上游自行断开；超时仍保留为兜底。
          res.end()
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
