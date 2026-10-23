// ═══════════════════════════════════════════════════════
// 国风色板（TS 侧单一来源，供 three.js 场景读取）
// 与 src/styles/variables.scss 同步维护；组件 CSS 只允许引用 SCSS 变量，
// 场景内（节点材质 / 连线 / 粒子）只允许引用本文件常量
// ═══════════════════════════════════════════════════════

export const PALETTE = {
  JADE_950: '#101f1b',
  JADE_900: '#1a2f2a',
  JADE_800: '#223c35',
  JADE_700: '#2e4d43',
  CINNABAR: '#a63a2b',
  AZURITE: '#33465f',
  GOLD: '#b98a2f',
  GOLD_PALE: '#d9b36a',
  IVORY: '#f2ead8',
} as const

// 节点分组色：全部取自 朱砂红 / 石青 / 鎏金 三传统色的低饱和变体
export const NODE_GROUP_COLORS: Record<string, string> = {
  四大名绣: '#9e4a3a', // 朱砂（低饱和）
  宫廷名绣: '#a8893e', // 鎏金（低饱和）
  地方名绣: '#4a5f78', // 石青（低饱和）
  民族刺绣: '#7c3a30', // 朱砂深（低饱和，与四大名绣区分）
}

// 合法节点色集合（驱动测试用）：禁止出现高饱和红黄蓝绿
export const NODE_COLOR_SET = ['#9e4a3a', '#a8893e', '#4a5f78', '#7c3a30']

// 连线色（鎏金细线 + 悬停提亮）
export const LINK_COLOR = 'rgba(185, 138, 47, 0.42)'
export const LINK_COLOR_HOT = 'rgba(217, 179, 106, 0.95)'
export const LINK_COLOR_DIM = 'rgba(185, 138, 47, 0.06)'

// 流光粒子色
export const LINK_PARTICLE_COLOR = 'rgba(217, 179, 106, 0.5)'
