// env.js — 统一的环境变量加载入口
// 无论从哪个目录启动服务（npm run dev 在项目根目录），
// 都从 server/.env 读取配置，避免 dotenv 默认按 cwd 找文件的问题
import dotenv from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '.env') })
