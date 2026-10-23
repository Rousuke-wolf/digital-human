// gallery.js — 经典绣坊图鉴：绣品图片上传 + 图鉴列表（首页左栏轮播数据源）
// 图片经 multer 接收，保存到 server/public/uploads/（经 /uploads 静态托管）
// 元数据写入 server/data/gallery.json，最多保留 5 张；超出时覆盖（删除）最旧一张
// 校验：仅允许 jpg/png/webp，单张最大 5MB
import { Router } from 'express'
import multer from 'multer'
import { promises as fs, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOAD_DIR = join(__dirname, '..', 'public', 'uploads')
const DATA_FILE = join(__dirname, '..', 'data', 'gallery.json')
const MAX_COUNT = 5
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

// 目录不存在时直接创建（同步，模块加载期执行一次）
mkdirSync(UPLOAD_DIR, { recursive: true })

// ── 存储配置：时间戳文件名防冲突 ───────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (file.originalname.match(/\.[a-zA-Z0-9]+$/) || [''])[0].toLowerCase()
    cb(null, `gallery-${Date.now()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpe?g|png|webp)$/.test(file.mimetype)
    cb(ok ? null : new Error('仅支持 jpg/png/webp 图片'), ok)
  },
})

// ── 元数据读写（gallery.json）──────────────────────────
async function readGallery() {
  if (!existsSync(DATA_FILE)) return []
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, 'utf8'))
  } catch {
    return [] // 文件损坏时按空列表处理
  }
}

async function writeGallery(list) {
  await fs.writeFile(DATA_FILE, JSON.stringify(list, null, 2), 'utf8')
}

// ── GET /api/gallery ─────────────────────────────────
// 返回最多 5 条 { id, url, title }；url 为前端可直接加载的 /uploads/xxx 路径
const router = Router()

router.get('/', async (_req, res) => {
  try {
    res.json(await readGallery())
  } catch (err) {
    console.error('[gallery] 读取图鉴失败:', err.message)
    res.status(500).json({ message: '图鉴读取失败' })
  }
})

// ── POST /api/gallery/upload ─────────────────────────
// multipart/form-data：image（图片文件）+ title（可选标题）
// 超过 5 张时覆盖最旧的一张：删除最旧元数据并清理对应磁盘文件
router.post('/upload', (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: '图片不能超过 5MB' })
      }
      return res.status(400).json({ message: `上传失败：${err.message}` })
    }
    if (err) {
      return res.status(400).json({ message: err.message })
    }
    if (!req.file) {
      return res.status(400).json({ message: '请选择要上传的图片' })
    }

    try {
      const title = String(req.body?.title ?? '').trim().slice(0, 40) || '未命名绣品'
      const list = await readGallery()

      // 超出上限：按时间顺序删除最旧一条（连同磁盘文件）
      if (list.length >= MAX_COUNT) {
        const oldest = list.shift()
        const oldestPath = join(UPLOAD_DIR, String(oldest.url).split('/').pop() ?? '')
        try { unlinkSync(oldestPath) } catch { /* 文件已不存在则忽略 */ }
      }

      const item = {
        id: Date.now(),
        url: `/uploads/${req.file.filename}`,
        title,
        createdAt: new Date().toISOString(),
      }
      list.push(item)
      await writeGallery(list)

      res.status(201).json({ item, count: list.length, overwrote: list.length >= MAX_COUNT })
    } catch (writeErr) {
      console.error('[gallery] 写入图鉴失败:', writeErr.message)
      res.status(500).json({ message: '图鉴保存失败' })
    }
  })
})

export default router
