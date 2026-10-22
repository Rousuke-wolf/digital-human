// graphData.js — 非遗知识图谱数据与布局（必做项 3，纯前端无依赖）
// 三类节点：非遗技艺 / 民族文化 / 图腾纹样。
// 资料依据：中国非物质文化遗产网（ihchina.cn）及公开非遗名录——
// 苗绣/水族马尾绣/土族盘绣为第一批国家级非遗（2006），
// 羌绣/彝族刺绣为第二批（2008），花瑶挑花为瑶族支系非遗项目。
// 展品联动：node.exhibit 对应 src/utils/models.js 中 MODELS 数组下标。

// ── 分类（颜色 + 形状双编码，色盲安全）──
export const CATEGORIES = [
  { id: 'skill',  name: '非遗技艺', color: '#8b6240', desc: '刺绣绣种与核心针法' },
  { id: 'ethnic', name: '民族文化', color: '#2e7d7a', desc: '拥有刺绣传承的民族' },
  { id: 'totem',  name: '图腾纹样', color: '#9a5b8c', desc: '承载寓意的经典纹样' },
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

// 分类枢纽节点（渲染用，挂在各分类下）
export const HUB_NODES = CATEGORIES.map((c) => ({
  id: `hub-${c.id}`,
  name: c.name,
  cat: c.id,
  isHub: true,
  intro: `${c.name}：${c.desc}。点击周围节点可查看具体${c.id === 'skill' ? '绣种与针法' : c.id === 'ethnic' ? '民族刺绣文化' : '纹样寓意'}。`,
}))

// ── 节点索引表（含枢纽与中心，供页面查询）──
export const NODE_MAP = Object.fromEntries(
  [...NODES, ...HUB_NODES, CENTER_NODE].map((n) => [n.id, n]))

// 某节点的邻居 id 列表
export function neighborsOf(id) {
  return EDGES.filter((e) => e.a === id || e.b === id)
    .map((e) => (e.a === id ? e.b : e.a))
}

// ── 布局：中心枢纽 + 三类扇形放射（双环）──
// 中心「非遗刺绣」→ 三个分类枢纽 → 各分类叶子沿朝心弧排布（外环 + 内环）
// 节点整体外扩；簇环（r=288）完整框住每簇的所有节点与标签
// 所有名称统一放徽章下方：双环径向间距 70px 时，同侧标签在任意角度
// 都不会重叠（横向近则纵向必远），彻底杜绝文字碰撞
const VB_W = 1400
const VB_H = 1150
const CENTER = { x: VB_W / 2, y: VB_H / 2 + 85 }
// 枢纽半径必须 > 内环半径 + 中心印章半径 + 徽章半径，否则内环叶子会压住中心节点
// 主图标（枢纽徽章/中心大章）放大后取 360，叶子与簇环位置不受影响
const HUB_R = 360
const HUB_ANGLE = { skill: -90, ethnic: 30, totem: 150 }   // 度：上/右下/左下

// 双环：外环大半径宽弧（180°）放约 69% 节点，内环小半径窄弧（126°）
// 内环两端缩进外环内侧 22.5°，加上半节距错位，外内环边缘节点彻底错开
const RINGS = {
  outer: { r: 230, spread: Math.PI },
  inner: { r: 150, spread: Math.PI * 0.7 },
}

function computePositions() {
  const pos = { center: { x: CENTER.x, y: CENTER.y } }

  // 分类枢纽节点
  for (const cat of CATEGORIES) {
    const a = (HUB_ANGLE[cat.id] * Math.PI) / 180
    pos[`hub-${cat.id}`] = {
      x: CENTER.x + HUB_R * Math.cos(a),
      y: CENTER.y + HUB_R * Math.sin(a),
    }
  }

  // 叶子节点：约 57% 放外环、其余放内环；所有名称统一放徽章下方
  // 内环整体错开半个外环节距（stagger），内环节点落在两个外环节点之间，
  // 避免外内环对头时胶囊印章边缘碰撞
  for (const cat of CATEGORIES) {
    const leaves = NODES.filter((n) => n.cat === cat.id)
    const hub = pos[`hub-${cat.id}`]
    const hubA = (HUB_ANGLE[cat.id] * Math.PI) / 180
    const outerCount = Math.round(leaves.length * 0.69)
    const outerNodes = leaves.slice(0, outerCount)
    const innerNodes = leaves.slice(outerCount)
    const outerStep = outerNodes.length > 1
      ? RINGS.outer.spread / (outerNodes.length - 1)
      : 0

    outerNodes.forEach((n, i) => {
      const t = outerNodes.length === 1 ? 0.5 : i / (outerNodes.length - 1)
      const a = hubA + Math.PI - RINGS.outer.spread / 2 + t * RINGS.outer.spread
      pos[n.id] = {
        x: hub.x + RINGS.outer.r * Math.cos(a),
        y: hub.y + RINGS.outer.r * Math.sin(a),
      }
      n.labelAbove = false
    })

    innerNodes.forEach((n, i) => {
      const t = innerNodes.length === 1 ? 0.5 : i / (innerNodes.length - 1)
      const a = hubA + Math.PI - RINGS.inner.spread / 2 + t * RINGS.inner.spread + outerStep / 2
      pos[n.id] = {
        x: hub.x + RINGS.inner.r * Math.cos(a),
        y: hub.y + RINGS.inner.r * Math.sin(a),
      }
      n.labelAbove = false
    })
  }
  return pos
}

export const POSITIONS = computePositions()
export const VIEWBOX = { w: VB_W, h: VB_H }
