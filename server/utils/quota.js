// quota.js — AI 额度体系（个人中心，必做项 4 + 成长体系扩展）
//
// 额度链（登录用户）：
//   每日可用 = 基础额度(env) × 会员倍数(VIP) + 当日任务加成
//   超出每日额度后消耗兑换额度包（quota_credits，source='credit'），无余额才 429
// 游客：仅对话试用额度（GUEST_QUOTA_CHAT）。
// 额度按「本地日期（中国时区）」每日重置，计数持久化在 usage_events 表。
// 策略：请求入口预留扣减（上游失败不退款，见 TEST_CHECKLIST 已知取舍）。
// 额度数值可用 server/.env 覆盖（QUOTA_* / VIP_MULTIPLIER），演示现场无需改代码。
import '../env.js'
import { query } from '../db.js'
import { optionalAuth } from '../middleware/auth.js'
import { todayKey, taskBonus } from './tasks.js'

export { todayKey }

// ── 功能定义：feature → 配置 ─────────────────────────
// guestEnv：游客试用额度环境变量名；没有则游客不可用（需登录）
const FEATURES = {
  chat:    { label: '数字人对话', quotaEnv: 'QUOTA_CHAT',    defaultLimit: 60, guestEnv: 'GUEST_QUOTA_CHAT', guestDefault: 5 },
  pattern: { label: '纹样生成',   quotaEnv: 'QUOTA_PATTERN', defaultLimit: 10 },
  model3d: { label: '3D 生成',    quotaEnv: 'QUOTA_MODEL3D', defaultLimit: 1 },
}

function envInt(name, def) {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : def
}

const VIP_MULT = envInt('VIP_MULTIPLIER', 2)

// 额度配置（读 env，未配置用默认值）
export function getQuotaConfig() {
  return {
    chat: envInt('QUOTA_CHAT', 60),
    pattern: envInt('QUOTA_PATTERN', 10),
    model3d: envInt('QUOTA_MODEL3D', 1),
    guestChat: envInt('GUEST_QUOTA_CHAT', 5),
    vipMultiplier: VIP_MULT,
  }
}

// ── 会员 ─────────────────────────────────────────────
export async function getVipStatus(userId) {
  const [rows] = await query(
    'SELECT level, expires_at FROM user_membership WHERE user_id = ?',
    [userId]
  )
  if (rows.length === 0) return { active: false, level: null, expiresAt: null }
  const expiresAt = rows[0].expires_at
  const nowUtc = new Date().toISOString().slice(0, 19).replace('T', ' ')
  // expires_at 与 nowUtc 同为 'YYYY-MM-DD HH:MM:SS'(UTC) 格式，字符串比较即可
  return { active: expiresAt > nowUtc, level: rows[0].level, expiresAt }
}

// ── 兑换额度包余额 ───────────────────────────────────
export async function getCreditsBalance(userId, feature) {
  const [grant] = await query(
    'SELECT COALESCE(SUM(amount), 0) as total FROM quota_credits WHERE user_id = ? AND feature = ?',
    [userId, feature]
  )
  const [used] = await query(
    'SELECT COUNT(*) as cnt FROM usage_events WHERE user_id = ? AND feature = ? AND source = ?',
    [userId, feature, 'credit']
  )
  return grant[0].total - used[0].cnt
}

// ── 登录用户每日可用额度（基础 × 会员倍数 + 任务加成）──
export async function getUserDailyLimit(userId, feature) {
  const base = envInt(FEATURES[feature].quotaEnv, FEATURES[feature].defaultLimit)
  const vip = await getVipStatus(userId)
  const bonus = await taskBonus(userId)
  const mult = vip.active ? VIP_MULT : 1
  const taskBonusAmt = bonus[feature] ?? 0
  return {
    base,
    vipActive: vip.active,
    taskBonus: taskBonusAmt,
    limit: base * mult + taskBonusAmt,
  }
}

// 记录一次用量（预留扣减：在调用上游前写入）
export async function recordUsage({ userId = null, guestId = null, feature, source = 'daily' }) {
  await query(
    'INSERT INTO usage_events (user_id, guest_id, feature, day, source) VALUES (?, ?, ?, ?, ?)',
    [userId, guestId, feature, todayKey(), source]
  )
}

// 统计某主体当日/累计用量（个人中心展示用）
export async function getUsageStats({ userId = null, guestId = null }) {
  const cond = userId != null ? 'user_id = ?' : 'guest_id = ?'
  const key = userId != null ? userId : guestId
  const [dayRows] = await query(
    `SELECT feature, COUNT(*) as cnt FROM usage_events WHERE ${cond} AND day = ? GROUP BY feature`,
    [key, todayKey()]
  )
  const [totalRows] = await query(
    `SELECT feature, COUNT(*) as cnt FROM usage_events WHERE ${cond} GROUP BY feature`,
    [key]
  )
  return {
    day: Object.fromEntries(dayRows.map((r) => [r.feature, r.cnt])),
    total: Object.fromEntries(totalRows.map((r) => [r.feature, r.cnt])),
  }
}

// ── 额度门禁中间件 ───────────────────────────────────
// 可选登录解析 → 登录用户按额度链；游客按试用额度（无试用额度的功能需登录）。
// options.loginRequired：游客直接 401 + code LOGIN_REQUIRED（前端据此弹登录引导）
export function quotaGate(feature, { loginRequired = false } = {}) {
  const conf = FEATURES[feature]
  if (!conf) {
    // 未知 feature：直接放行（不拦截）
    return (req, res, next) => next()
  }

  return (req, res, next) => {
    optionalAuth(req, res, async () => {
      try {
        // ── 登录用户：每日额度 → 兑换额度包 ──
        if (req.user) {
          const { limit } = await getUserDailyLimit(req.user.id, feature)
          const [rows] = await query(
            'SELECT COUNT(*) as cnt FROM usage_events WHERE user_id = ? AND feature = ? AND day = ? AND source = ?',
            [req.user.id, feature, todayKey(), 'daily']
          )
          const used = rows[0]?.cnt ?? 0
          if (used >= limit) {
            // 超出每日额度：消耗兑换额度包
            const credits = await getCreditsBalance(req.user.id, feature)
            if (credits > 0) {
              await recordUsage({ userId: req.user.id, feature, source: 'credit' })
              req.quota = { feature, used: used + 1, limit, source: 'credit' }
              return next()
            }
            return res.status(429).json({
              message: `${conf.label}今日额度已用完（${limit} 次/日）——完成任务、开通会员或兑换额度包可获得更多`,
              code: 'QUOTA_EXCEEDED',
              quota: { feature, used, limit },
            })
          }
          await recordUsage({ userId: req.user.id, feature, source: 'daily' })
          req.quota = { feature, used: used + 1, limit, source: 'daily' }
          return next()
        }

        // ── 游客 ──
        if (loginRequired || conf.guestEnv == null) {
          return res.status(401).json({
            message: `登录后即可完整体验${conf.label}`,
            code: 'LOGIN_REQUIRED',
          })
        }

        const guestId = String(req.headers['x-guest-id'] || req.ip || 'unknown')
        const limit = envInt(conf.guestEnv, conf.guestDefault)
        const [rows] = await query(
          'SELECT COUNT(*) as cnt FROM usage_events WHERE guest_id = ? AND feature = ? AND day = ?',
          [guestId, feature, todayKey()]
        )
        const used = rows[0]?.cnt ?? 0
        if (used >= limit) {
          return res.status(429).json({
            message: '今日试用次数已用完，登录后即可继续体验',
            code: 'GUEST_QUOTA_EXCEEDED',
            quota: { feature, used, limit },
          })
        }
        await recordUsage({ guestId, feature })
        req.quota = { feature, used: used + 1, limit }
        next()
      } catch (err) {
        console.error('[quota] 额度检查失败:', err.message)
        res.status(500).json({ message: '服务器内部错误' })
      }
    })
  }
}
