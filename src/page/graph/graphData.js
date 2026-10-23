// graphData.js — 非遗知识图谱数据与布局（必做项 3，纯前端）
// 布局参考敦煌石刻星图的星座形式：中心主星【绣】+ 三个独立扇形星座片区
// （左上=非遗技艺 / 右下=民族文化 / 左下=图腾纹样），子节点作为星点
// 均匀散布在所属扇区内（种子随机、位置固定，不用力导向布局）
//
// 资料依据：中国非物质文化遗产网（ihchina.cn）及公开非遗名录——
// 苗绣/水族马尾绣/土族盘绣为第一批国家级非遗（2006），
// 羌绣/彝族刺绣为第二批（2008），花瑶挑花为瑶族支系非遗项目。
// 展品联动：node.exhibit 对应 src/utils/models.js 中 MODELS 数组下标。

// ── 分类（低饱和国风色：黛绿 / 石青 / 朱砂，2D/3D 共用）──
export const CATEGORIES = [
  { id: 'skill',  name: '非遗技艺', color: '#4a7a6b', desc: '刺绣绣种与核心针法' },
  { id: 'ethnic', name: '民族文化', color: '#5b7fa6', desc: '拥有刺绣传承的民族' },
  { id: 'totem',  name: '图腾纹样', color: '#a63a2b', desc: '承载寓意的经典纹样' },
]

export const CENTER_NODE = {
  id: 'center',
  name: '非遗刺绣',
  cat: 'core',
  intro: '刺绣是中国古老的手工技艺之一，四大名绣与各民族绣种共同构成绚丽多彩的刺绣文化版图。点击任意节点，探索技艺、民族与图腾之间的关联。',
}

// ── 节点 ──────────────────────────────────────────
// exhibit 字段：对应 3D 展厅展品（models.js 下标），无则省略
export const NODES = [
  // ── 非遗技艺 ──
  { id: 'su',       name: '苏绣',     cat: 'skill',  exhibit: 2,
    intro: '四大名绣之首，源于苏州。以丝线细密、色彩雅致、绣面平服著称，写实功力深厚，有"东方明珠"之誉，2006年列入国家级非遗。' },
  { id: 'miao',     name: '苗绣',     cat: 'skill',
    intro: '苗族的"无字史书"，用图腾纹样记录迁徙历史与创世神话。色彩浓烈、构图饱满，2006年列入第一批国家级非遗。' },
  { id: 'xiang',    name: '湘绣',     cat: 'skill',
    intro: '四大名绣之一，以长沙为中心。针法多变、色彩鲜明，狮虎题材闻名，素有"绣花花生香，绣鸟能听声"的美誉。' },
  { id: 'shu',      name: '蜀绣',     cat: 'skill',
    intro: '四大名绣之一，源于川西平原。针脚整齐、用色明快清丽，鲤鱼、芙蓉是经典题材，被誉为"蜀中之宝"。' },
  { id: 'yue',      name: '粤绣',     cat: 'skill',
    intro: '四大名绣之一，以金银线垫绣闻名，构图繁密热闹、富丽堂皇，孔雀、荔枝等题材极具岭南风情。' },
  { id: 'jing',     name: '京绣',     cat: 'skill',
    intro: '明清宫廷刺绣代表，金线盘绕、龙纹凤纹，专供皇家御用，尽显宫廷气派，是"燕京八绝"之一。' },
  { id: 'tupan',    name: '土族盘绣', cat: 'skill',
    intro: '青海土族独有，"一针两线"——一根线盘、一根线钉，起源可溯至吐谷浑时期，2006年列入第一批国家级非遗。' },
  { id: 'luanzhen', name: '乱针绣',   cat: 'skill',
    intro: '20世纪30年代杨守玉创立于常州。以交叉重叠的乱针表现光影与层次，近看针法纵横，远看形神兼备，被誉为"绣出来的油画"。' },
  { id: 'dazi',     name: '打籽绣',   cat: 'skill',
    intro: '每针盘绕成籽状小结，粒粒饱满如珠。常用来绣石榴籽、花蕊，寓意多子多福，是苏绣传统针法之一。' },
  { id: 'panjin',   name: '盘金绣',   cat: 'skill',
    intro: '以金线盘绕、丝线钉固，金光灿烂、富丽堂皇，多用于龙袍、吉服等宫廷绣品，是满族宫廷刺绣的代表工艺。' },
  { id: 'mawei',    name: '马尾绣',   cat: 'skill',
    intro: '水族独有，以马尾为芯缠丝盘绣，耐磨立体、古朴厚重，有"中国刺绣活化石"之称，2006年列入第一批国家级非遗。' },
  { id: 'qiang',    name: '羌绣',     cat: 'skill',
    intro: '羌族传统刺绣，以挑花为主，纹样多取自然物象，分布于四川汶川一带，2008年列入国家级非遗。' },
  { id: 'tiaohua',  name: '挑花',     cat: 'skill',
    intro: '按经纬纱线挑绣的技法，正反两面图案一致，多呈几何纹样。羌族、瑶族（花瑶挑花）等民族均有传承。' },

  // ── 民族文化 ──
  { id: 'miaoEthnic', name: '苗族', cat: 'ethnic',
    intro: '主要聚居黔湘滇，服饰刺绣华美，苗绣被称为"穿在身上的史书"，图案承载迁徙记忆与图腾崇拜。' },
  { id: 'shui',       name: '水族', cat: 'ethnic',
    intro: '聚居贵州三都，独创马尾绣，是水族妇女代代相传的技艺，与鱼图腾崇拜紧密相连。' },
  { id: 'qiangEthnic', name: '羌族', cat: 'ethnic',
    intro: '聚居四川岷江上游，羌绣以挑花见长，是羌族服饰文化的重要标识。' },
  { id: 'tu',         name: '土族', cat: 'ethnic',
    intro: '聚居青海互助，土族盘绣流传至今，是土族服饰与节庆的重要装饰。' },
  { id: 'man',        name: '满族', cat: 'ethnic',
    intro: '清代宫廷刺绣体系的主要推动者，盘金绣等华贵工艺盛行，龙纹凤纹成为皇权符号。' },
  { id: 'yi',         name: '彝族', cat: 'ethnic',
    intro: '凉山、石林等地彝族刺绣色彩浓烈，太阳纹、火纹体现太阳崇拜，2008年列入国家级非遗扩展项目。' },
  { id: 'yao',        name: '瑶族', cat: 'ethnic',
    intro: '湖南隆回花瑶挑花独具特色，图案古朴神秘，被列入国家级非遗。' },
  { id: 'han',        name: '汉族', cat: 'ethnic',
    intro: '四大名绣（苏、湘、蜀、粤）皆属汉族刺绣体系，兼收并蓄、体系完备，祥瑞纹样寄托生活祝愿。' },
  { id: 'zang',       name: '藏族', cat: 'ethnic',
    intro: '聚居青藏高原，藏绣多用于唐卡与服饰，云纹、八吉祥等纹样庄重华丽。' },
  { id: 'zhuang',     name: '壮族', cat: 'ethnic',
    intro: '聚居广西，铜鼓文化闻名，太阳纹是铜鼓与壮绣中最核心的纹样。' },

  // ── 图腾纹样 ──
  { id: 'hudie',    name: '蝴蝶妈妈', cat: 'totem',
    intro: '苗族创世神话中的万物之母，蝴蝶纹是苗绣中最崇高的图腾，象征生命起源与繁衍。' },
  { id: 'fenghuang', name: '凤凰',   cat: 'totem',
    intro: '百鸟之王，象征吉祥高贵。苗族视其为神鸟，汉族"龙凤呈祥"中寓意美满，是绣品中最常见的纹样之一。' },
  { id: 'longwen',  name: '龙纹',    cat: 'totem',
    intro: '皇权与祥瑞的象征，明清宫廷绣品中地位最高，常与云纹、海水江崖纹组合出现。' },
  { id: 'taiyang',  name: '太阳纹',  cat: 'totem',
    intro: '彝族太阳崇拜的符号，光芒放射状构图，寄托对光明与丰收的祈愿。' },
  { id: 'yuwen',    name: '鱼纹',    cat: 'totem',
    intro: '"年年有余"的谐音寄托，水族马尾绣中鱼纹灵动古朴，与鱼图腾崇拜相关。' },
  { id: 'shiliu',   name: '石榴纹',  cat: 'totem', exhibit: 2,
    intro: '石榴多籽，寓意多子多福、家族兴旺。打籽绣粒粒饱满正好绣石榴籽，是汉族传统吉祥纹样。' },
  { id: 'yunwen',   name: '云纹',    cat: 'totem', exhibit: 5,
    intro: '祥云缭绕、瑞气升腾，从宫廷到民间广泛使用，常与龙纹组合成"龙腾祥云"。' },
  { id: 'mudan',    name: '牡丹纹',  cat: 'totem',
    intro: '花中之王，寓意富贵吉祥，是苏绣最常见、最经典的题材之一。' },
  { id: 'bianfu',   name: '蝙蝠纹',  cat: 'totem',
    intro: '"蝠"谐音"福"，五蝠捧寿寓意多福多寿，是汉族传统吉祥纹样。' },
  { id: 'hulu',     name: '葫芦纹',  cat: 'totem',
    intro: '"葫芦"谐音"福禄"，藤蔓绵长、籽粒众多，寓意福禄双全、子孙万代。' },
]

// ── 关系边（无向）──
export const EDGES = [
  // 苏绣体系
  { a: 'su', b: 'han' }, { a: 'su', b: 'luanzhen' }, { a: 'su', b: 'dazi' },
  // 四大名绣与京绣
  { a: 'xiang', b: 'han' }, { a: 'shu', b: 'han' }, { a: 'yue', b: 'han' }, { a: 'jing', b: 'man' },
  // 苗绣与苗族图腾
  { a: 'miao', b: 'miaoEthnic' }, { a: 'miao', b: 'hudie' }, { a: 'miao', b: 'fenghuang' },
  { a: 'miaoEthnic', b: 'hudie' }, { a: 'miaoEthnic', b: 'fenghuang' },
  // 汉族与吉祥纹样
  { a: 'han', b: 'yunwen' }, { a: 'han', b: 'shiliu' }, { a: 'han', b: 'fenghuang' },
  // 满族宫廷体系
  { a: 'man', b: 'longwen' }, { a: 'man', b: 'panjin' }, { a: 'panjin', b: 'longwen' },
  // 水族马尾绣
  { a: 'shui', b: 'mawei' }, { a: 'shui', b: 'yuwen' }, { a: 'mawei', b: 'yuwen' },
  // 羌族 / 瑶族挑花
  { a: 'qiangEthnic', b: 'qiang' }, { a: 'qiangEthnic', b: 'tiaohua' }, { a: 'yao', b: 'tiaohua' },
  // 土族盘绣 / 彝族太阳纹 / 打籽绣石榴
  { a: 'tu', b: 'tupan' }, { a: 'yi', b: 'taiyang' }, { a: 'dazi', b: 'shiliu' },
  // 藏族云纹 / 壮族铜鼓太阳纹
  { a: 'zang', b: 'yunwen' }, { a: 'zhuang', b: 'taiyang' },
  // 汉族吉祥纹样扩展
  { a: 'mudan', b: 'su' }, { a: 'mudan', b: 'han' }, { a: 'bianfu', b: 'han' }, { a: 'hulu', b: 'han' },
]

// 分类枢纽节点（各扇区的锚星）
export const HUB_NODES = CATEGORIES.map((c) => ({
  id: `hub-${c.id}`,
  name: c.name,
  cat: c.id,
  isHub: true,
  intro: `${c.name}：${c.desc}。点击周围星点可查看具体${c.id === 'skill' ? '绣种与针法' : c.id === 'ethnic' ? '民族刺绣文化' : '纹样寓意'}。`,
}))

// ── 节点索引表（含枢纽与中心，供页面查询）──
export const NODE_MAP = Object.fromEntries(
  [...NODES, ...HUB_NODES, CENTER_NODE].map((n) => [n.id, n]))

// 某节点的邻居 id 列表
export function neighborsOf(id) {
  return EDGES.filter((e) => e.a === id || e.b === id)
    .map((e) => (e.a === id ? e.b : e.a))
}

// ── 共享视图函数（2D/3D 渲染层共用同一份逻辑，保证两种模式精确一致）──
export function nodeColorOf(n) {
  if (n.cat === 'core') return '#c9984a'
  return CATEGORIES.find((c) => c.id === n.cat)?.color ?? '#8b6240'
}

export function nodeRadiusOf(n) {
  if (n.cat === 'core') return 26
  if (n.isHub) return 12
  const deg = neighborsOf(n.id).length
  return Math.min(9.5, Math.max(5.5, 5.5 + deg * 0.45))
}

export function edgeIsCross(e) {
  return NODE_MAP[e.a]?.cat !== NODE_MAP[e.b]?.cat
}

// 连线统一为极细淡金/浅灰（去发光，信笺级克制）
export function edgeColorOf(e) {
  return edgeIsCross(e) ? '#c9984a' : '#b9a98c'
}

// ── 确定性伪随机（种子固定，星点位置每次一致）──
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── 星座扇区布局（敦煌星图式，非力导向）──
// 屏幕角度（y 向下）：三块 120° 扇区铺满全圆，天然中心对称（默认视图整体居中）
// 技艺=左上 [165°,285°]、民族=右下 [255°,375°]、图腾=左下 [15°,165°]
// 每个扇区一个锚星（枢纽，距中心 160），子星点在扇区内均匀散布（半径 220~360）
const VB_W = 1400
const VB_H = 800
const CENTER = { x: VB_W / 2, y: VB_H / 2 }

export const SECTORS = {
  skill:  { from: 165, to: 285, mid: 225, hubR: 160 },
  ethnic: { from: 255, to: 375, mid: 315, hubR: 160 },
  totem:  { from: 15,  to: 165, mid: 135, hubR: 160 },
}

const LEAF_R_MIN = 220
const LEAF_R_MAX = 360
const MIN_GAP_SAME = 64    // 同扇区星点最小间距
const MIN_GAP_CROSS = 54   // 跨扇区星点最小间距
const MIN_GAP_HUB = 74     // 星点离锚星最小间距

function degToRad(d) { return (d * Math.PI) / 180 }

function computePositions() {
  const pos = { center: { x: CENTER.x, y: CENTER.y } }
  const placed = []   // 已放置的叶子（含角度，供间距校验）

  // 锚星（各扇区枢纽）
  for (const cat of CATEGORIES) {
    const sec = SECTORS[cat.id]
    const a = degToRad(sec.mid)
    pos[`hub-${cat.id}`] = {
      x: CENTER.x + sec.hubR * Math.cos(a),
      y: CENTER.y + sec.hubR * Math.sin(a),
    }
  }

  // 子星点：扇区内均匀散布（拒绝采样保证最小间距）
  for (const cat of CATEGORIES) {
    const leaves = NODES.filter((n) => n.cat === cat.id)
    const sec = SECTORS[cat.id]
    const rnd = mulberry32(20261022 + CATEGORIES.findIndex((c) => c.id === cat.id))
    const hub = pos[`hub-${cat.id}`]

    leaves.forEach((n) => {
      let best = null
      for (let attempt = 0; attempt < 400 && !best; attempt++) {
        const a = degToRad(sec.from + rnd() * (sec.to - sec.from))
        const r = LEAF_R_MIN + rnd() * (LEAF_R_MAX - LEAF_R_MIN)
        const p = {
          x: CENTER.x + r * Math.cos(a),
          y: CENTER.y + r * Math.sin(a),
        }
        let okMin = true
        for (const q of placed) {
          const d = Math.hypot(p.x - q.x, p.y - q.y)
          const need = q.cat === cat.id ? MIN_GAP_SAME : MIN_GAP_CROSS
          if (d < need) { okMin = false; break }
        }
        if (okMin && Math.hypot(p.x - hub.x, p.y - hub.y) < MIN_GAP_HUB) okMin = false
        if (okMin) best = p
      }
      // 兜底：贴扇区中线分环摆放
      if (!best) {
        const i = leaves.indexOf(n)
        const a = degToRad(sec.mid + (i % 3 - 1) * 7)
        const r = LEAF_R_MIN + ((i * 97) % (LEAF_R_MAX - LEAF_R_MIN))
        best = { x: CENTER.x + r * Math.cos(a), y: CENTER.y + r * Math.sin(a) }
      }
      pos[n.id] = best
      placed.push({ x: best.x, y: best.y, cat: cat.id })
    })
  }
  return pos
}

export const POSITIONS = computePositions()
export const VIEWBOX = { w: VB_W, h: VB_H }

// ── 背景装饰：稀疏微弱暗金色静态星点（宣纸上的碎金星）──
export const GOLD_STARS = (() => {
  const rnd = mulberry32(20261022)
  return Array.from({ length: 90 }, () => ({
    x: rnd() * VB_W,
    y: rnd() * VB_H,
    r: 0.5 + rnd() * 0.9,
    o: 0.12 + rnd() * 0.22,
  }))
})()
