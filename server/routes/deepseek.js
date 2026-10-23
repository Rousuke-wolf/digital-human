// deepseek.js — DeepSeek 问答代理：POST /api/chat
// 前端（锦绣助手）不再直连 api.deepseek.com：
//   1. API Key 只存在于服务端环境变量，永不打包进前端产物；
//   2. 由后端拼接 Authorization 头转发，规避浏览器直连的跨域/预检 401。
import '../env.js'
import { Router } from 'express'

const router = Router()

// ── 密钥只读 server/.env（注意：绝不使用 VITE_ 前缀）─────
const API_KEY = process.env.DEEPSEEK_API_KEY
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

function notConfigured(res) {
  return res
    .status(503)
    .json({ message: 'AI 服务未配置，请在 server/.env 中设置 DEEPSEEK_API_KEY' })
}

// ── POST /api/chat ────────────────────────────────────
// 请求体：{ messages: [{ role, content }] }（前端已拼好 system prompt）
// 响应：SSE 流式透传 DeepSeek chat/completions 的增量
router.post('/', async (req, res) => {
  if (!API_KEY) return notConfigured(res)

  const { messages } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ message: 'messages 不能为空' })
  }
  // 限制总文本长度，防止滥用
  const total = messages.reduce((n, m) => n + String(m?.content ?? '').length, 0)
  if (total > 4000) {
    return res.status(400).json({ message: '消息内容过长' })
  }

  const upstream = new AbortController()
  // 客户端中途断开时同步取消上游请求，避免继续计费。
  // 注意：监听 res 而非 req——req 的 'close' 在请求体读完即触发，会误杀正常请求
  res.on('close', () => {
    if (!res.writableEnded) upstream.abort()
  })

  try {
    const r = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Bearer 后必须有空格；密钥只在服务端拼接，永不下发前端
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        temperature: 0.7,
        max_tokens: 1024,
        messages,
      }),
      signal: upstream.signal,
    })

    if (!r.ok) {
      // 上游 401：Key 无效/过期/余额不足，给出可操作的提示
      if (r.status === 401) {
        console.error('[deepseek] 上游返回 401，请检查 server/.env 中的 DEEPSEEK_API_KEY 是否有效')
        return res.status(502).json({
          message: 'DeepSeek API Key 无效或已过期，请检查 server/.env 中的 DEEPSEEK_API_KEY',
        })
      }
      const detail = await r.text().catch(() => '')
      console.error(`[deepseek] 上游错误 ${r.status}:`, detail.slice(0, 300))
      return res.status(502).json({ message: `DeepSeek 服务异常（${r.status}），请稍后重试` })
    }

    // SSE 流式透传：逐块写给浏览器
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()

    for await (const chunk of r.body) {
      if (res.writableEnded) break
      res.write(chunk)
    }
    res.end()
  } catch (err) {
    if (err?.name === 'AbortError') return // 客户端断开，静默结束
    console.error('[deepseek] 转发失败:', err.message)
    if (!res.headersSent) {
      res.status(502).json({ message: 'AI 服务异常，请稍后重试' })
    } else {
      res.end()
    }
  }
})

export default router
