// news.js — 非遗刺绣前沿资讯：GET /api/news 读取 server/data/news.json
// 数据文件不存在时自动调用 fetchLatestNews() 生成（Mock 兜底），
// 后续由 newsFetcher.js 接入真实搜索 API 定时刷新
import { Router } from 'express'
import { promises as fs, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { fetchLatestNews } from '../utils/newsFetcher.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = join(__dirname, '..', 'data', 'news.json')

const router = Router()

// ── GET /api/news ────────────────────────────────────
// 返回 [{ id, title, date, url }]，前端渲染标题 + 日期，整行点击跳转 url
router.get('/', async (_req, res) => {
  try {
    if (!existsSync(DATA_FILE)) {
      await fetchLatestNews() // 首次访问：生成数据文件
    }
    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'))
    res.json(Array.isArray(data) ? data : [])
  } catch (err) {
    console.error('[news] 读取资讯失败:', err.message)
    res.status(500).json({ message: '资讯读取失败' })
  }
})

export default router
