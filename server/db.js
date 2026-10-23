import Database from 'better-sqlite3'
import { existsSync, mkdirSync, copyFileSync, readdirSync, unlinkSync, statSync, utimesSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── 数据目录：server/data/ ──────────────────────────
const dataDir = join(__dirname, 'data')
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

// ── 备份目录 ────────────────────────────────────────
const backupDir = join(dataDir, 'backups')
if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true })

// ── 数据库文件 ──────────────────────────────────────
const dbPath = join(dataDir, 'database.db')
const db = new Database(dbPath)

// 启用 WAL 模式
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── 备份：启动时自动备份 + 保留最近 7 天 ──
function autoBackup() {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
    const dest = join(backupDir, `database-${stamp}.db`)
    copyFileSync(dbPath, dest)
    // Windows 下 copyFileSync 会继承源文件 mtime；WAL 模式下 database.db 的 mtime
    // 是上次 checkpoint 时间（可能很旧），会被下方 7 天清理误删，这里显式刷新为当前时间
    const nowTime = Date.now() / 1000
    utimesSync(dest, nowTime, nowTime)
    console.log(`📦 数据库已备份: ${dest}`)

    // 清理 7 天前的旧备份
    const now = Date.now()
    const files = readdirSync(backupDir).filter(f => f.endsWith('.db'))
    for (const f of files) {
      const p = join(backupDir, f)
      if (now - statSync(p).mtimeMs > 7 * 24 * 60 * 60 * 1000) {
        unlinkSync(p)
        console.log(`🗑 已清理旧备份: ${f}`)
      }
    }
  } catch (err) {
    console.error('[db] 自动备份失败:', err.message)
  }
}

// ── 手动导出备份（供 API 调用）──
export function manualBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
  const dest = join(backupDir, `database-manual-${stamp}.db`)
  copyFileSync(dbPath, dest)
  return { ok: true, path: dest, stamp }
}

// ── 列出备份文件 ──
export function listBackups() {
  const files = readdirSync(backupDir).filter(f => f.endsWith('.db'))
  return files.map(f => {
    const p = join(backupDir, f)
    const s = statSync(p)
    return { name: f, size: s.size, time: s.mtime.toISOString() }
  }).sort((a, b) => b.time.localeCompare(a.time))
}

// ── 初始化表 ──
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT    NOT NULL UNIQUE,
      email       TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      avatar      TEXT    DEFAULT NULL,
      role        TEXT    DEFAULT 'user' CHECK(role IN ('user','admin')),
      created_at  TEXT    DEFAULT (datetime('now')),
      updated_at  TEXT    DEFAULT (datetime('now'))
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT    NOT NULL,
      code        TEXT    NOT NULL,
      used        INTEGER DEFAULT 0,
      expires_at  TEXT    NOT NULL,
      created_at  TEXT    DEFAULT (datetime('now'))
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_verifications_email_code ON email_verifications(email, code)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_verifications_expires ON email_verifications(expires_at)`)

  // ── 额度用量流水（个人中心，必做项 4）──
  // 每条 = 一次 AI 功能调用；day 为本地日期（中国时区），额度按日重置
  // source：'daily' 日常额度 / 'credit' 兑换额度包（成长体系）
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER DEFAULT NULL,
      guest_id    TEXT    DEFAULT NULL,
      feature     TEXT    NOT NULL,
      day         TEXT    NOT NULL,
      source      TEXT    DEFAULT 'daily',
      created_at  TEXT    DEFAULT (datetime('now'))
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_user_day ON usage_events(user_id, feature, day)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_guest_day ON usage_events(guest_id, feature, day)`)

  // 已有库补列：usage_events 建表时无 source 列（额度包机制后加）
  const usageCols = db.prepare('PRAGMA table_info(usage_events)').all()
  if (!usageCols.some((c) => c.name === 'source')) {
    db.exec(`ALTER TABLE usage_events ADD COLUMN source TEXT DEFAULT 'daily'`)
  }

  // ── 用户作品（个人中心，必做项 4）──
  // data：纹样=图片URL / 3D=glbUrl；payload：其余字段 JSON（theme/filters/analysis/prompt...）
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_works (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      type        TEXT    NOT NULL,
      name        TEXT    DEFAULT '',
      data        TEXT    NOT NULL,
      payload     TEXT    DEFAULT '{}',
      created_at  TEXT    DEFAULT (datetime('now'))
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_works_user ON user_works(user_id)`)

  // ── 成长体系（必做项 4 扩展：任务 / 会员 / 兑换码）──
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_task_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      task_key    TEXT    NOT NULL,
      day         TEXT    NOT NULL,
      created_at  TEXT    DEFAULT (datetime('now'))
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_task_events_user ON user_task_events(user_id, task_key, day)`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_task_claims (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      task_key    TEXT    NOT NULL,
      day         TEXT    NOT NULL,
      created_at  TEXT    DEFAULT (datetime('now')),
      UNIQUE(user_id, task_key, day)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_membership (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL UNIQUE,
      level       TEXT    DEFAULT 'vip',
      expires_at  TEXT    NOT NULL,
      created_at  TEXT    DEFAULT (datetime('now')),
      updated_at  TEXT    DEFAULT (datetime('now'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_orders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      plan        TEXT    NOT NULL,
      amount      REAL    DEFAULT 0,
      created_at  TEXT    DEFAULT (datetime('now'))
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_orders_user ON user_orders(user_id)`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS quota_credits (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL,
      feature     TEXT    NOT NULL,
      amount      INTEGER NOT NULL,
      created_at  TEXT    DEFAULT (datetime('now'))
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_credits_user ON quota_credits(user_id, feature)`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS redeem_codes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      code        TEXT    NOT NULL UNIQUE,
      package     TEXT    NOT NULL,
      amount      INTEGER DEFAULT 0,
      batch       TEXT    DEFAULT '',
      used_by     INTEGER DEFAULT NULL,
      used_at     TEXT    DEFAULT NULL,
      revoked     INTEGER DEFAULT 0,
      created_at  TEXT    DEFAULT (datetime('now'))
    )
  `)

  // 启动时自动备份（只有数据库已存在且有数据时才备份）
  const [row] = db.prepare("SELECT COUNT(*) as cnt FROM users").all()
  if (row.cnt > 0) {
    autoBackup()
  }

  console.log(`✅ 数据库就绪: ${dbPath}`)
}

// ── 查询（兼容 mysql2 接口）──
export function query(sql, params = []) {
  const converted = sql
    .replace(/NOW\(\)/gi, "datetime('now')")
    .replace(/DATE_ADD\(NOW\(\),\s*INTERVAL\s*(\d+)\s*MINUTE\)/gi,
      (_, min) => `datetime('now', '+${min} minutes')`)

  const isSelect = converted.trim().toUpperCase().startsWith('SELECT')
    || converted.trim().toUpperCase().startsWith('WITH')

  try {
    if (isSelect) {
      return [db.prepare(converted).all(...params)]
    } else {
      const result = db.prepare(converted).run(...params)
      return [{ insertId: result.lastInsertRowid, changes: result.changes }]
    }
  } catch (err) {
    console.error('[db] SQL 错误:', err.message)
    throw err
  }
}

export default db
