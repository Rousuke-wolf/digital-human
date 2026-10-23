// user.js — 个人中心数据路由（必做项 4）：额度查询 + 作品管理
// 成长体系扩展：任务（事件上报/签到/领取）、兑换码、模拟会员购买、头像上传
// 全部路由需要登录（requireAuth），数据按 user_id 隔离
import '../env.js'
import { Router } from 'express'
import { promises as fs, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { query } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import {
  getQuotaConfig,
  getUsageStats,
  getUserDailyLimit,
  getVipStatus,
  getCreditsBalance,
} from '../utils/quota.js'
import { taskList, todayKey, EVENT_TASKS } from '../utils/tasks.js'
import { REDEEM_PACKAGES, VIP_PLANS } from '../utils/packages.js'

const router = Router()
router.use(requireAuth)

// ── 头像上传：base64 dataURL → /uploads/avatars/（静态托管）──
// dataUrl 传 null 时清除头像（恢复默认首字头像）
const __dirname = dirname(fileURLToPath(import.meta.url))
const AVATAR_DIR = join(__dirname, '..', 'public', 'uploads', 'avatars')
const AVATAR_MAX_BYTES = 2 * 1024 * 1024   // 2MB

router.post('/avatar', async (req, res) => {
  try {
    const { dataUrl } = req.body || {}
    if (dataUrl == null) {
      await query('UPDATE users SET avatar = NULL WHERE id = ?', [req.user.id])
      return res.json({ avatarUrl: null })
    }
    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl))
    if (!m) return res.status(400).json({ message: '头像格式不正确（仅支持 PNG/JPG/WebP）' })
    const buf = Buffer.from(m[2], 'base64')
    if (buf.length > AVATAR_MAX_BYTES) {
      return res.status(400).json({ message: '头像文件过大（最大 2MB）' })
    }
    mkdirSync(AVATAR_DIR, { recursive: true })
    const filename = `avatar-${req.user.id}.${m[1]}`
    await fs.writeFile(join(AVATAR_DIR, filename), buf)
    const avatarUrl = `/uploads/avatars/${filename}?v=${Date.now()}`   // 时间戳防浏览器缓存旧头像
    await query('UPDATE users SET avatar = ? WHERE id = ?', [avatarUrl, req.user.id])
    res.json({ avatarUrl })
  } catch (err) {
    console.error('[avatar] 上传失败:', err)
    res.status(500).json({ message: '头像上传失败，请稍后再试' })
  }
})

// ── 会员开通/延长（模拟支付与兑换码共用）──
async function extendMembership(userId, days) {
  const nowUtc = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const [rows] = await query('SELECT expires_at FROM user_membership WHERE user_id = ?', [userId])
  // 未过期的会员续费/兑换：在原到期时间上顺延
  let base = nowUtc
  if (rows.length > 0 && rows[0].expires_at && rows[0].expires_at > nowUtc) base = rows[0].expires_at
  const exp = new Date(new Date(base.replace(' ', 'T') + 'Z').getTime() + days * 86400 * 1000)
    .toISOString().slice(0, 19).replace('T', ' ')
  if (rows.length > 0) {
    await query(
      "UPDATE user_membership SET level = 'vip', expires_at = ?, updated_at = datetime('now') WHERE user_id = ?",
      [exp, userId]
    )
  } else {
    await query(
      'INSERT INTO user_membership (user_id, level, expires_at) VALUES (?, ?, ?)',
      [userId, 'vip', exp]
    )
  }
  return exp
}

// ── GET /api/user/usage ──────────────────────────────
// 额度卡片 + 会员状态 + 每日任务 + 兑换额度包余额（个人中心一次拉取）
router.get('/usage', async (req, res) => {
  try {
    const stats = await getUsageStats({ userId: req.user.id })
    const today = stats.day
    const total = stats.total
    const quotas = []
    for (const [feature, label] of [['chat', '数字人对话'], ['pattern', '纹样生成'], ['model3d', '3D 生成']]) {
      const daily = await getUserDailyLimit(req.user.id, feature)
      quotas.push({
        feature,
        label,
        used: today[feature] ?? 0,
        limit: daily.limit,
        base: daily.base,
        vipActive: daily.vipActive,
        taskBonus: daily.taskBonus,
        total: total[feature] ?? 0,
      })
    }
    quotas.push({ feature: 'tts', label: '语音播报', used: 0, limit: null, total: null, unlimited: true })

    res.json({
      quotas,
      vip: await getVipStatus(req.user.id),
      tasks: await taskList(req.user.id),
      credits: {
        chat: await getCreditsBalance(req.user.id, 'chat'),
        pattern: await getCreditsBalance(req.user.id, 'pattern'),
      },
      config: { vipMultiplier: getQuotaConfig().vipMultiplier },
    })
  } catch (err) {
    console.error('[user] 查询额度失败:', err.message)
    res.status(500).json({ message: '服务器错误，请稍后重试' })
  }
})

// ── POST /api/user/tasks/event ───────────────────────
// 任务事件上报（白名单：graph 图谱探索 / share 分享作品）
router.post('/tasks/event', async (req, res) => {
  try {
    const task = String(req.body?.task ?? '')
    if (!EVENT_TASKS.includes(task)) {
      return res.status(400).json({ message: '任务类型无效' })
    }
    await query(
      'INSERT INTO user_task_events (user_id, task_key, day) VALUES (?, ?, ?)',
      [req.user.id, task, todayKey()]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[user] 任务事件上报失败:', err.message)
    res.status(500).json({ message: '服务器错误，请稍后重试' })
  }
})

// ── POST /api/user/tasks/checkin ─────────────────────
// 每日签到：点击即完成（写领取记录，当日生效；签到为单阶段任务）
router.post('/tasks/checkin', async (req, res) => {
  try {
    await query(
      'INSERT OR IGNORE INTO user_task_claims (user_id, task_key, day) VALUES (?, ?, ?)',
      [req.user.id, 'checkin-s0', todayKey()]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[user] 签到失败:', err.message)
    res.status(500).json({ message: '服务器错误，请稍后重试' })
  }
})

// ── POST /api/user/tasks/claim ───────────────────────
// 领取任务阶段奖励：{ task, stage }，stage 为阶段序号（0 起）；
// 该阶段进度达标才发放；已领取幂等返回成功
router.post('/tasks/claim', async (req, res) => {
  try {
    const task = String(req.body?.task ?? '')
    const stage = Number(req.body?.stage ?? 0)
    const list = await taskList(req.user.id)
    const t = list.find((x) => x.key === task)
    if (!t || t.key === 'checkin') return res.status(400).json({ message: '任务不存在' })
    const st = t.stages?.[stage]
    if (!st) return res.status(400).json({ message: '阶段不存在' })
    if (!st.done) return res.status(400).json({ message: '该阶段尚未完成，继续加油～' })
    await query(
      'INSERT OR IGNORE INTO user_task_claims (user_id, task_key, day) VALUES (?, ?, ?)',
      [req.user.id, `${task}-s${stage}`, todayKey()]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[user] 领取任务失败:', err.message)
    res.status(500).json({ message: '服务器错误，请稍后重试' })
  }
})

// ── POST /api/user/redeem ────────────────────────────
// 兑换码：会员天数（顺延）或额度包 credits；一次性使用
router.post('/redeem', async (req, res) => {
  try {
    const code = String(req.body?.code ?? '').trim().toUpperCase()
    if (!code) return res.status(400).json({ message: '请输入兑换码' })

    const [rows] = await query('SELECT * FROM redeem_codes WHERE code = ?', [code])
    if (rows.length === 0) return res.status(404).json({ message: '兑换码不存在' })
    const c = rows[0]
    if (c.revoked) return res.status(400).json({ message: '兑换码已作废' })
    if (c.used_by) return res.status(400).json({ message: '兑换码已被使用' })

    const pkg = REDEEM_PACKAGES[c.package]
    if (!pkg) return res.status(400).json({ message: '兑换码类型无效' })

    if (pkg.type === 'vip') {
      await extendMembership(req.user.id, pkg.days)
    } else {
      await query(
        'INSERT INTO quota_credits (user_id, feature, amount) VALUES (?, ?, ?)',
        [req.user.id, pkg.feature, pkg.amount]
      )
    }
    await query(
      "UPDATE redeem_codes SET used_by = ?, used_at = datetime('now') WHERE id = ?",
      [req.user.id, c.id]
    )
    res.json({ ok: true, package: pkg.label })
  } catch (err) {
    console.error('[user] 兑换失败:', err.message)
    res.status(500).json({ message: '服务器错误，请稍后重试' })
  }
})

// ── POST /api/user/vip/purchase ──────────────────────
// 模拟付费开通会员（演示环境，无真实支付；UI 已标注）
router.post('/vip/purchase', async (req, res) => {
  try {
    const plan = String(req.body?.plan ?? '')
    const p = VIP_PLANS[plan]
    if (!p) return res.status(400).json({ message: '套餐无效' })

    await query(
      'INSERT INTO user_orders (user_id, plan, amount) VALUES (?, ?, ?)',
      [req.user.id, plan, p.amount]
    )
    const expiresAt = await extendMembership(req.user.id, p.days)
    res.json({ ok: true, plan: p.label, days: p.days, expiresAt })
  } catch (err) {
    console.error('[user] 会员购买失败:', err.message)
    res.status(500).json({ message: '服务器错误，请稍后重试' })
  }
})

// ── GET /api/user/works ─────────────────────────────
router.get('/works', async (req, res) => {
  try {
    const [rows] = await query(
      'SELECT id, type, name, data, payload, created_at FROM user_works WHERE user_id = ? ORDER BY id DESC',
      [req.user.id]
    )
    // payload 存的是 JSON 字符串，还原成对象方便前端使用
    res.json({
      works: rows.map((w) => {
        let payload = {}
        try { payload = JSON.parse(w.payload || '{}') } catch { /* 脏数据兜底 */ }
        return { ...w, payload }
      }),
    })
  } catch (err) {
    console.error('[user] 查询作品失败:', err.message)
    res.status(500).json({ message: '服务器错误，请稍后重试' })
  }
})

// ── POST /api/user/works ────────────────────────────
// 新增单件作品 { type, name, data, payload }；同用户同 type+data 去重
router.post('/works', async (req, res) => {
  try {
    const { type, name = '', data, payload = {} } = req.body || {}
    if (!type || !data) return res.status(400).json({ message: '作品信息不完整' })
    if (!['pattern', 'model3d'].includes(type)) return res.status(400).json({ message: '作品类型不正确' })
    if (String(data).length > 2000) return res.status(400).json({ message: '作品数据过长' })

    const [existing] = await query(
      'SELECT id FROM user_works WHERE user_id = ? AND type = ? AND data = ?',
      [req.user.id, type, String(data)]
    )
    if (existing.length > 0) {
      return res.json({ work: { id: existing[0].id }, duplicated: true })
    }

    const [result] = await query(
      'INSERT INTO user_works (user_id, type, name, data, payload) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, type, String(name).slice(0, 100), String(data), JSON.stringify(payload ?? {})]
    )
    res.status(201).json({ work: { id: result.insertId }, duplicated: false })
  } catch (err) {
    console.error('[user] 保存作品失败:', err.message)
    res.status(500).json({ message: '服务器错误，请稍后重试' })
  }
})

// ── POST /api/user/works/merge ──────────────────────
// 批量合并游客本地作品（登录时一次性上云），服务端按 type+data 去重
router.post('/works/merge', async (req, res) => {
  try {
    const items = Array.isArray(req.body?.works) ? req.body.works.slice(0, 50) : []
    let added = 0
    for (const it of items) {
      if (!it?.type || !it?.data) continue
      if (!['pattern', 'model3d'].includes(it.type)) continue
      if (String(it.data).length > 2000) continue
      const [existing] = await query(
        'SELECT id FROM user_works WHERE user_id = ? AND type = ? AND data = ?',
        [req.user.id, it.type, String(it.data)]
      )
      if (existing.length > 0) continue
      await query(
        'INSERT INTO user_works (user_id, type, name, data, payload) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, it.type, String(it.name ?? '').slice(0, 100), String(it.data), JSON.stringify(it.payload ?? {})]
      )
      added++
    }
    res.json({ added })
  } catch (err) {
    console.error('[user] 合并作品失败:', err.message)
    res.status(500).json({ message: '服务器错误，请稍后重试' })
  }
})

// ── DELETE /api/user/works/:id ──────────────────────
router.delete('/works/:id', async (req, res) => {
  try {
    const [result] = await query(
      'DELETE FROM user_works WHERE id = ? AND user_id = ?',
      [Number(req.params.id), req.user.id]
    )
    if (result.changes === 0) return res.status(404).json({ message: '作品不存在' })
    res.json({ ok: true })
  } catch (err) {
    console.error('[user] 删除作品失败:', err.message)
    res.status(500).json({ message: '服务器错误，请稍后重试' })
  }
})

export default router
