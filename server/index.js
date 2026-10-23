import './env.js'
import express from 'express'
import cors from 'cors'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initDB } from './db.js'
import authRoutes from './routes/auth.js'
import ttsRoutes from './routes/tts.js'
import aiRoutes from './routes/ai.js'
import meshyRoutes from './routes/meshy.js'
import userRoutes from './routes/user.js'
import adminRoutes from './routes/admin.js'
import galleryRoutes from './routes/gallery.js'
import newsRoutes from './routes/news.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

// ── 中间件 ──────────────────────────────────────────
app.use(cors())
app.use(express.json({ limit: '1mb' }))

// ── API 路由 ────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/meshy', meshyRoutes)
app.use('/api/user', userRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/gallery', galleryRoutes)
app.use('/api/news', newsRoutes)
app.use('/tts', ttsRoutes)

// ── 图鉴上传文件静态托管（server/public/uploads/）──
app.use('/uploads', express.static(join(__dirname, 'public', 'uploads')))

// ── Meshy GLB 资源代理（生产环境；开发环境由 vite 代理处理）──
// 前端加载 AI 生成的 3D 模型时经此代理，避免跨域 + 隐藏直连地址
app.get('/meshy-glb', async (req, res) => {
  const target = req.query.url
  if (!target) {
    return res.status(400).json({ message: '缺少 url 参数' })
  }
  try {
    const u = new URL(String(target))
    // 只允许代理 Meshy 的静态资源域名
    if (u.hostname !== 'assets.meshy.ai') {
      return res.status(400).json({ message: '不允许的目标地址' })
    }
    const r = await fetch(u)
    if (!r.ok) {
      return res.status(r.status).json({ message: `资源获取失败 ${r.status}` })
    }
    const buf = Buffer.from(await r.arrayBuffer())
    res.set('Content-Type', r.headers.get('content-type') || 'model/gltf-binary')
    res.set('Cache-Control', 'public, max-age=86400')
    res.send(buf)
  } catch (err) {
    console.error('[proxy] GLB 代理失败:', err.message)
    res.status(502).json({ message: '资源代理失败' })
  }
})

// ── 健康检查 + SMTP 测试 ────────────────────────────
import { testSmtpConnection } from './utils/email.js'

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

app.get('/api/debug/smtp-test', async (req, res) => {
  const result = await testSmtpConnection()
  res.json({ ...result, devMode: process.env.DEV_MODE === 'true' })
})

// ── 数据备份（收口：补上管理员鉴权，历史遗留裸接口）──
import { manualBackup, listBackups } from './db.js'
import { requireAdmin } from './middleware/auth.js'

app.post('/api/admin/backup', requireAdmin, (req, res) => {
  const result = manualBackup()
  res.json(result)
})

app.get('/api/admin/backups', requireAdmin, (req, res) => {
  res.json({ backups: listBackups() })
})

// ── 生产环境：托管前端静态文件 ──────────────────────
const distPath = join(__dirname, '..', 'dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
  // SPA fallback：非 API 请求全部返回 index.html
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/tts') || req.path.startsWith('/uploads')) return next()
    res.sendFile(join(distPath, 'index.html'))
  })
}

// ── 404（仅开发模式走到这里）─────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: '接口不存在' })
})

// ── 全局错误处理 ────────────────────────────────────
// Express 靠 4 参数签名识别错误中间件，参数名不影响
app.use((err, req, res, _next) => {
  console.error('[server] 未捕获错误:', err)
  res.status(500).json({ message: '服务器内部错误' })
})

// ── 启动 ────────────────────────────────────────────
async function start() {
  try {
    await initDB()
    app.listen(PORT, () => {
      console.log(`✅ 后端服务已启动: http://localhost:${PORT}`)
      console.log(`   POST /api/auth/register — 注册`)
      console.log(`   POST /api/auth/login    — 登录`)
      console.log(`   GET  /api/auth/me       — 用户信息`)
      console.log(`   POST /tts               — TTS 语音`)

    })
  } catch (err) {
    console.error('❌ 服务启动失败:', err)
    process.exit(1)
  }
}

start()
