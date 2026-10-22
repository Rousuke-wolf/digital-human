import '../env.js'
import { Router } from 'express'
import { quotaGate } from '../utils/quota.js'

const router = Router()

// ── Meshy 文生 3D：密钥只存在于服务端 ────────────────
const API_KEY = process.env.MESHY_API_KEY
const BASE_URL = 'https://api.meshy.ai/openapi/v2'

function meshyNotConfigured(res) {
  return res
    .status(503)
    .json({ message: 'Meshy 服务未配置，请在 server/.env 中设置 MESHY_API_KEY' })
}

// Meshy 是海外服务，国内网络可能不通：加超时避免请求长时间挂起
const FETCH_TIMEOUT = 15000

function meshyFetch(path, options = {}) {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${API_KEY}`, ...options.headers },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  })
}

// ── POST /api/meshy/text-to-3d ───────────────────────
// 创建文生 3D 任务（preview / refine 均走此接口）
// Meshy 成本最高，需登录（游客 401 + code LOGIN_REQUIRED）；一次生成只扣一次额度
router.post('/text-to-3d', quotaGate('model3d', { loginRequired: true }), async (req, res) => {
  if (!API_KEY) return meshyNotConfigured(res)
  try {
    const r = await meshyFetch('/text-to-3d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })
    const json = await r.json().catch(() => ({}))
    if (!r.ok) {
      return res.status(r.status).json({ message: json.message || `Meshy 请求失败 ${r.status}` })
    }
    res.json(json)
  } catch (err) {
    console.error('[meshy] 提交任务失败:', err.message)
    res.status(502).json({ message: 'Meshy 服务异常，请稍后重试' })
  }
})

// ── GET /api/meshy/task/:id ──────────────────────────
// 查询任务进度（前端轮询用）
router.get('/task/:id', async (req, res) => {
  if (!API_KEY) return meshyNotConfigured(res)
  try {
    const r = await meshyFetch(`/text-to-3d/${req.params.id}`)
    res.status(r.status).json(await r.json().catch(() => ({})))
  } catch (err) {
    console.error('[meshy] 查询任务失败:', err.message)
    res.status(502).json({ message: 'Meshy 服务异常，请稍后重试' })
  }
})

export default router
