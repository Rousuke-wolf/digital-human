// ASR 语音识别：POST /api/asr
// 链路：前端 MediaRecorder 录音（webm/opus）→ Base64 Data URI → 本路由 → DashScope qwen3-asr-flash → 识别文本
// 背景：Web Speech API 的识别依赖谷歌服务，国内网络不可用；本项目统一走 DashScope 代理（与 TTS 同构）
import '../env.js'
import express from 'express'

const router = express.Router()

const ASR_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const API_KEY = process.env.DASHSCOPE_API_KEY || process.env.DASHSCOPE_TTS_KEY
const MODEL = 'qwen3-asr-flash'
// 官方限制：音频 ≤10MB / ≤5 分钟；base64 膨胀约 1.37 倍，留出余量
const MAX_DATA_URI = 14 * 1024 * 1024

// 音频 base64 体积大，单独放大本路由的 JSON 上限（index.js 中先于全局 1mb 限制挂载）
router.post('/', express.json({ limit: '16mb' }), async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({ message: '语音识别未配置，请在 server/.env 中设置 DASHSCOPE_API_KEY' })
    }
    const { audio, language } = req.body || {}
    if (typeof audio !== 'string' || !audio.startsWith('data:audio/')) {
      return res.status(400).json({ message: '缺少音频数据（需 data:audio 前缀的 Base64 Data URI）' })
    }
    if (audio.length > MAX_DATA_URI) {
      return res.status(400).json({ message: '录音过长（限 5 分钟），请缩短后重试' })
    }
    const upstream = await fetch(ASR_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        input: {
          messages: [{ role: 'user', content: [{ audio }] }],
        },
        parameters: {
          asr_options: {
            enable_itn: true,
            ...(typeof language === 'string' && language ? { language } : {}),
          },
        },
      }),
      signal: AbortSignal.timeout(60000),
    })
    const data = await upstream.json().catch(() => ({}))
    if (!upstream.ok) {
      console.warn('[ASR] 识别失败:', JSON.stringify(data).slice(0, 300))
      return res.status(502).json({ message: '语音识别失败，请稍后重试' })
    }
    const content = data?.output?.choices?.[0]?.message?.content
    const text = Array.isArray(content)
      ? content.map((c) => (typeof c === 'string' ? c : (c?.text || ''))).join('')
      : (typeof content === 'string' ? content : '')
    if (!text.trim()) {
      console.warn('[ASR] 无识别结果', { size: audio.length, tokens: data?.usage?.audio_tokens })
      return res.status(422).json({ message: '没有听清，请再试一次' })
    }
    // 诊断日志：dataURI 大小 / 上游实际处理的音频 token 数，便于排查格式解码问题
    console.log('[ASR]', Math.round(audio.length / 1024) + 'KB', 'tokens=' + (data?.usage?.audio_tokens ?? '?'), '→', text.slice(0, 40))
    res.json({ text })
  } catch (error) {
    console.warn('[ASR]', error.message)
    res.status(502).json({ message: '语音识别服务异常，请稍后重试' })
  }
})

export default router
