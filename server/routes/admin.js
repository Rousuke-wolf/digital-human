// admin.js — 管理后台路由（成长体系，必做项 4 扩展）
// 全部接口需要 admin 角色：运营统计 + 兑换码管理
// 管理员开通方式见 CLAUDE.md（node 一行命令提升 role）
import '../env.js'
import crypto from 'crypto'
import { Router } from 'express'
import { query } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'
import { REDEEM_PACKAGES } from '../utils/packages.js'
import { todayKey } from '../utils/tasks.js'

const router = Router()
router.use(requireAdmin)

// 兑换码格式：ZCF-XXXX-XXXX-XXXX（无易混淆字符 I/O/0/1）
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const seg = () => Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join('')
  return `ZCF-${seg()}-${seg()}-${seg()}`
}

// ── GET /api/admin/stats ─────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [todayCalls] = await query('SELECT COUNT(*) as cnt FROM usage_events WHERE day = ?', [todayKey()])
    const [userCount] = await query('SELECT COUNT(*) as cnt FROM users')
    const [vipCount] = await query("SELECT COUNT(*) as cnt FROM user_membership WHERE expires_at > datetime('now')")
    const [codeTotal] = await query('SELECT COUNT(*) as cnt FROM redeem_codes')
    const [codeUsed] = await query('SELECT COUNT(*) as cnt FROM redeem_codes WHERE used_by IS NOT NULL')
    const [todayWork] = await query('SELECT COUNT(*) as cnt FROM user_works WHERE created_at >= date(\'now\')')
    res.json({
      todayCalls: todayCalls[0]?.cnt ?? 0,
      userCount: userCount[0]?.cnt ?? 0,
      vipCount: vipCount[0]?.cnt ?? 0,
      codeTotal: codeTotal[0]?.cnt ?? 0,
      codeUsed: codeUsed[0]?.cnt ?? 0,
      todayWorks: todayWork[0]?.cnt ?? 0,
    })
  } catch (err) {
    console.error('[admin] 统计失败:', err.message)
    res.status(500).json({ message: '服务器错误' })
  }
})

// ── POST /api/admin/codes ────────────────────────────
// 批量生成兑换码 { package, count, batch }
router.post('/codes', async (req, res) => {
  try {
    const pkg = String(req.body?.package ?? '').toUpperCase()
    const count = Math.min(Math.max(Number(req.body?.count) || 1, 1), 100)
    const batch = String(req.body?.batch ?? '').trim().slice(0, 50) || `批次-${todayKey()}`
    if (!REDEEM_PACKAGES[pkg]) return res.status(400).json({ message: '包类型无效' })

    const codes = []
    for (let i = 0; i < count; i++) {
      const code = genCode()
      await query(
        'INSERT INTO redeem_codes (code, package, batch) VALUES (?, ?, ?)',
        [code, pkg, batch]
      )
      codes.push(code)
    }
    res.json({ codes, package: pkg, batch })
  } catch (err) {
    console.error('[admin] 生成兑换码失败:', err.message)
    res.status(500).json({ message: '服务器错误' })
  }
})

// ── GET /api/admin/codes ─────────────────────────────
router.get('/codes', async (req, res) => {
  try {
    const [rows] = await query(
      `SELECT c.id, c.code, c.package, c.batch, c.used_by, c.used_at, c.revoked, c.created_at, u.username
       FROM redeem_codes c LEFT JOIN users u ON u.id = c.used_by
       ORDER BY c.id DESC LIMIT 200`
    )
    res.json({ codes: rows })
  } catch (err) {
    console.error('[admin] 查询兑换码失败:', err.message)
    res.status(500).json({ message: '服务器错误' })
  }
})

// ── POST /api/admin/codes/:id/revoke ─────────────────
// 作废未使用的兑换码
router.post('/codes/:id/revoke', async (req, res) => {
  try {
    const [rows] = await query('SELECT id, used_by, revoked FROM redeem_codes WHERE id = ?', [Number(req.params.id)])
    if (rows.length === 0) return res.status(404).json({ message: '兑换码不存在' })
    if (rows[0].used_by) return res.status(400).json({ message: '已使用的兑换码不能作废' })
    await query('UPDATE redeem_codes SET revoked = 1 WHERE id = ?', [rows[0].id])
    res.json({ ok: true })
  } catch (err) {
    console.error('[admin] 作废兑换码失败:', err.message)
    res.status(500).json({ message: '服务器错误' })
  }
})

export default router
