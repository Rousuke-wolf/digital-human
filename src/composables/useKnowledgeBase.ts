// ═══════════════════════════════════════════════════════
// useKnowledgeBase.ts — 刺绣知识库检索增强（RAG）接口（答辩技术亮点 ②）
// 现状：本地知识库（embroideryData.js + embroideryWorks.js）构建语料块，
//       召回打分 = 关键词命中 + 字符二元组重叠 + 字段权重 —— 完全离线、答辩稳定
// 升级路径：searchVector() 预留向量检索接口，接入 Embedding 服务后
//       （通义千问 text-embedding + 向量库）替换 retrieve() 的内部实现即可，
//       上层调用方（DigitalHumanPanel）零改动
// ═══════════════════════════════════════════════════════
import { embroideryData } from '../data/embroideryData'
import { EMBROIDERY_WORKS } from '../data/embroideryWorks'

export interface KnowledgeChunk {
  id: string            // 唯一标识
  embroideryId: string  // 所属流派节点 id
  embroideryName: string
  field: string         // 语料字段名（name/slogan/history/features/figures/tech/works）
  text: string
  keywords: string[]    // 预切分词（字符二元组），用于召回打分
}

// 字段权重：越接近「考点」的字段权重越高（名称 > 定位 > 特点/作品 > 人物/技术 > 沿革）
const FIELD_WEIGHT: Record<string, number> = {
  name: 5,
  slogan: 4,
  features: 3,
  works: 3,
  figures: 2,
  tech: 2,
  history: 1,
}

/** 中文无分词器可用时的轻量切词：2~3 字滑窗二元组（答辩演示足够） */
function tokenize(text: string): string[] {
  const t = text.replace(/[^一-龥a-zA-Z0-9]+/g, '')
  if (t.length <= 2) return t ? [t] : []
  const tokens = new Set<string>()
  for (let i = 0; i < t.length - 1; i++) tokens.add(t.slice(i, i + 2))
  return [...tokens]
}

let chunkCache: KnowledgeChunk[] | null = null

/** 构建语料块（惰性缓存）：每个节点按字段切块，附带流派名便于跨节点召回 */
function buildChunks(): KnowledgeChunk[] {
  if (chunkCache) return chunkCache
  const chunks: KnowledgeChunk[] = []

  for (const node of embroideryData.nodes) {
    const works = EMBROIDERY_WORKS[node.id] || []
    const sources: [string, string][] = [
      ['name', node.name],
      ['slogan', node.slogan || ''],
      ['features', (node.features || []).join('；')],
      ['works', works.map((w) => `${w.name}：${w.desc}`).join('；')],
      ['figures', (node.figures || []).map((f) => `${f.name}（${f.title}）`).join('；')],
      ['tech', (node.tech || []).join('；')],
      ['history', (node.history || '').split('\n')[0]], // 首段即可覆盖「起源」类提问
    ]

    for (const [field, text] of sources) {
      if (!text || !text.trim()) continue
      chunks.push({
        id: `${node.id}:${field}`,
        embroideryId: node.id,
        embroideryName: node.name,
        field,
        text,
        keywords: tokenize(text),
      })
    }
  }

  chunkCache = chunks
  return chunks
}

/**
 * 关键词召回：返回按相关度排序的 topK 语料块
 * 打分 = 名称直接命中(6) + 提问词命中(2×字段权重) + 二元组重叠比例(×字段权重)
 */
export function retrieve(query: string, topK = 3): KnowledgeChunk[] {
  const q = query.trim()
  if (!q) return []
  const qTokens = tokenize(q)

  const scored = buildChunks()
    .map((chunk) => {
      let score = 0
      // 提问直接包含流派名（如「苏绣的针法」）—— 该流派所有块加权
      if (q.includes(chunk.embroideryName)) score += 6
      // 完整词命中：提问二元组出现在语料文本中
      const hits = qTokens.filter((t) => chunk.text.includes(t)).length
      score += hits * 2 * (FIELD_WEIGHT[chunk.field] || 1)
      // 关键词集合重叠比例（对短语料更公平）
      const overlap = qTokens.filter((t) => chunk.keywords.includes(t)).length
      score += (overlap / Math.max(1, chunk.keywords.length)) * 3 * (FIELD_WEIGHT[chunk.field] || 1)
      return { chunk, score }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  return scored.map((s) => s.chunk)
}

/** 将召回块拼成大模型上下文（按字段标号，控制总长防止超限） */
export function buildContext(chunks: KnowledgeChunk[], maxLength = 800): string {
  let out = ''
  for (const c of chunks) {
    const line = `【${c.embroideryName}·${c.field}】${c.text}\n`
    if (out.length + line.length > maxLength) break
    out += line
  }
  return out.trim()
}

// ── 向量检索预留接口 ─────────────────────────────────
// 接入方案：后端新增 POST /api/kb/search（Embedding → 向量库 topK），
// 前端在 retrieve() 内改为优先调此接口、失败回退本地打分；
// 或直接返回 Embedding 供对话接口做混合召回
export async function searchVector(_query: string, _topK = 3): Promise<KnowledgeChunk[]> {
  return Promise.reject(new Error('[useKnowledgeBase] 向量检索为预留接口，待后端接入'))
}
