// newsFetcher.js — 非遗刺绣前沿资讯抓取器（首页右栏资讯数据源）
// TODO: 接入 DeepSeek Search API 或火山引擎联网搜索 API，每日定时抓取"非遗刺绣"相关资讯，写入 server/data/news.json
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = join(__dirname, '..', 'data', 'news.json')

// ── Mock 数据：跑通全链路（接口 → JSON → 前端渲染 → 点击跳转）──
// 接入真实搜索 API 后整体替换；url 暂用百度搜索直达链接，保证任何环境可点开
const MOCK_NEWS = [
  {
    id: 1,
    title: '苏绣国家级传承人新作亮相中国工艺美术馆',
    date: '2026-10-18',
    url: 'https://www.baidu.com/s?wd=%E8%8B%8F%E7%BB%A3%E5%9B%BD%E5%AE%B6%E7%BA%A7%E4%BC%A0%E6%89%BF%E4%BA%BA%E6%96%B0%E4%BD%9C',
  },
  {
    id: 2,
    title: '数字技术助力湘绣焕发新生：AI 辅助纹样设计走进课堂',
    date: '2026-10-12',
    url: 'https://www.baidu.com/s?wd=%E6%95%B0%E5%AD%97%E6%8A%80%E6%9C%AF%E5%8A%A9%E5%8A%9B%E6%B9%98%E7%BB%A3%E7%84%95%E5%8F%91%E6%96%B0%E7%94%9F',
  },
  {
    id: 3,
    title: '蜀绣双面异色绣《芙蓉锦鲤》获国际手工艺展金奖',
    date: '2026-10-05',
    url: 'https://www.baidu.com/s?wd=%E8%9C%80%E7%BB%A3%E5%8F%8C%E9%9D%A2%E5%BC%82%E8%89%B2%E7%BB%A3%E8%8A%99%E8%93%89%E9%94%A6%E9%B2%A4',
  },
  {
    id: 4,
    title: '粤绣龙凤褂登上巴黎高定秀场，岭南针法惊艳世界',
    date: '2026-09-28',
    url: 'https://www.baidu.com/s?wd=%E7%B2%A4%E7%BB%A3%E9%BE%99%E5%87%A4%E8%A4%82%E5%B7%B4%E9%BB%8E%E9%AB%98%E5%AE%9A%E7%A7%80%E5%9C%BA',
  },
  {
    id: 5,
    title: '苗绣纹样数字化工程启动：千年图腾进入元宇宙展厅',
    date: '2026-09-20',
    url: 'https://www.baidu.com/s?wd=%E8%8B%97%E7%BB%A3%E7%BA%B9%E6%A0%B7%E6%95%B0%E5%AD%97%E5%8C%96%E5%B7%A5%E7%A8%8B',
  },
]

/**
 * 抓取最新"非遗刺绣"资讯并写入 server/data/news.json
 * 当前为 Mock 实现；接入真实搜索 API 后替换 MOCK_NEWS 的生成逻辑即可
 * @returns {Promise<Array<{ id: number, title: string, date: string, url: string }>>}
 */
export async function fetchLatestNews() {
  // TODO: 真实实现示例：
  //   const res = await fetch('https://api.deepseek.com/search', { ... })
  //   或火山引擎联网搜索 API；将结果映射为 { id, title, date, url }
  const items = MOCK_NEWS

  await fs.mkdir(join(__dirname, '..', 'data'), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), 'utf8')
  return items
}
