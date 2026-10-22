import '../env.js'
import { Router } from 'express'
import OpenAI from 'openai'

const router = Router()

// ── 密钥只存在于服务端环境变量，前端不再持有 ──────────
const API_KEY = process.env.DASHSCOPE_API_KEY
const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const IMAGE_API = 'https://dashscope.aliyuncs.com/api/v1'

const openai = API_KEY ? new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL }) : null

function aiNotConfigured(res) {
  return res
    .status(503)
    .json({ message: 'AI 服务未配置，请在 server/.env 中设置 DASHSCOPE_API_KEY' })
}

// ── POST /api/ai/chat ────────────────────────────────
// 通义千问对话代理：前端传 messages / model / response_format，
// 由服务端转发到 DashScope，返回 OpenAI 兼容的 completion
router.post('/chat', async (req, res) => {
  if (!openai) return aiNotConfigured(res)

  const { messages, model = 'qwen3.8-flash', response_format } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ message: 'messages 不能为空' })
  }
  // 限制总文本长度，防止滥用
  const total = messages.reduce((n, m) => n + String(m?.content ?? '').length, 0)
  if (total > 4000) {
    return res.status(400).json({ message: '消息内容过长' })
  }

  try {
    const body = {
      model,
      messages,
      stream: false,
      ...(response_format ? { response_format } : {}),
    }
    // qwen3.8 系列默认开启思考模式（实测 5s+），绫韵是短问答场景需要快响应。
    // 注意：必须作为顶层参数透传（openai-node 会丢弃 extra_body，实测无效）
    if (String(model).includes('qwen3.8')) body.enable_thinking = false

    const completion = await openai.chat.completions.create(body)
    res.json(completion)
  } catch (err) {
    console.error('[ai] 对话失败:', err.message)
    res.status(502).json({ message: 'AI 服务异常，请稍后重试' })
  }
})

// ── POST /api/ai/image ───────────────────────────────
// 通义万相图片生成：提交任务 → 服务端轮询 → 返回 { url }
router.post('/image', async (req, res) => {
  if (!API_KEY) return aiNotConfigured(res)

  const prompt = String(req.body?.prompt ?? '').trim()
  if (!prompt) return res.status(400).json({ message: 'prompt 不能为空' })
  if (prompt.length > 200) return res.status(400).json({ message: 'prompt 过长' })

  try {
    const submitRes = await fetch(`${IMAGE_API}/services/aigc/multimodal-generation/generation`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen-image-2.0-pro',
        input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
        parameters: { size: '1024*1024', watermark: false },
      }),
    })
    const json = await submitRes.json()

    // 同步返回图片 URL 的情况
    const url = json?.output?.choices?.[0]?.message?.content?.[0]?.image
    if (url) return res.json({ url })

    // 异步任务：轮询直到完成（最多 20 次 × 3s）
    const taskId = json?.output?.task_id
    if (!taskId) {
      console.error('[ai] 图片生成响应异常:', JSON.stringify(json).slice(0, 300))
      return res.status(502).json({ message: '图片生成失败，请稍后重试' })
    }

    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      const pollRes = await fetch(`${IMAGE_API}/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      })
      const pollJson = await pollRes.json()
      const status = pollJson?.output?.task_status
      if (status === 'SUCCEEDED') {
        const resultUrl = pollJson?.output?.results?.[0]?.url
        if (!resultUrl) break
        return res.json({ url: resultUrl })
      }
      if (status === 'FAILED') break
    }
    res.status(502).json({ message: '图片生成失败，请稍后重试' })
  } catch (err) {
    console.error('[ai] 图片生成失败:', err.message)
    res.status(502).json({ message: '图片生成失败，请稍后重试' })
  }
})

export default router
