import '../env.js'
import { Router } from 'express'
import { WebSocket } from 'ws'
import { randomUUID } from 'crypto'

const router = Router()

const WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference'
const API_KEY = process.env.DASHSCOPE_TTS_KEY
const DEFAULT_VOICE = 'longling_v2'
const MODEL = 'cosyvoice-v2'

router.post('/', (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({ message: 'TTS 服务未配置，请在 server/.env 中设置 DASHSCOPE_TTS_KEY' })
  }

  const { text, volume, rate, voice } = req.body

  if (!text?.trim()) {
    return res.status(400).json({ message: '文本不能为空' })
  }

  const useVolume = (volume !== undefined) ? Number(volume) : 50
  const useRate = (rate !== undefined) ? Number(rate) : 1.2
  const useVoice = (voice !== undefined) ? String(voice) : DEFAULT_VOICE
  const taskId = randomUUID()

  const ws = new WebSocket(WS_URL, {
    headers: { Authorization: `bearer ${API_KEY}` }
  })

  ws.on('open', () => {
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    })

    // 先只发 run-task；Qwen-Audio 系列要求收到 task-started 后才能继续
    ws.send(JSON.stringify({
      header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
      payload: {
        task_group: 'audio',
        task: 'tts',
        function: 'SpeechSynthesizer',
        model: MODEL,
        parameters: {
          voice: useVoice,
          format: 'mp3',
          sample_rate: 22050,
          volume: useVolume,
          rate: useRate,
        },
        input: {}
      }
    }))
  })

  let taskStarted = false
  ws.on('message', (data, isBinary) => {
    if (isBinary) {
      res.write(data)
    } else {
      try {
        const msg = JSON.parse(data.toString())
        const event = msg.header?.event
        if (event === 'task-started' && !taskStarted) {
          taskStarted = true
          ws.send(JSON.stringify({
            header: { action: 'continue-task', task_id: taskId },
            payload: { input: { text } }
          }))
          ws.send(JSON.stringify({
            header: { action: 'finish-task', task_id: taskId },
            payload: { input: {} }
          }))
        } else if (event === 'task-finished') {
          // 音频已全部下发：主动关闭 WebSocket，让 chunked 响应正常收尾
          // （否则浏览器端 res.arrayBuffer() 永远等不到流结束，前端会降级系统语音）
          ws.close()
        } else if (event === 'task-failed') {
          console.error('[TTS] 失败:', msg.header.error_code, msg.header.error_message)
          ws.close()
        }
      } catch { /* ignore parse errors */ }
    }
  })

  ws.on('close', () => res.end())
  // 兜底：无论如何 20 秒内结束响应，避免异常情况下流挂死
  setTimeout(() => {
    if (!res.writableEnded) res.end()
  }, 20000)
  ws.on('error', (err) => {
    console.error('[TTS] WebSocket 错误:', err.message)
    if (!res.headersSent) res.status(500).json({ message: 'TTS 服务异常' })
    else res.end()
  })
})

export default router
