<template>
  <div class="app-wrapper page-graph">
    <Navbar />

    <main class="graph-main">
      <div class="graph-head">
        <div class="graph-head-left">
          <h2 class="graph-title">非遗知识图谱</h2>
          <p class="graph-sub">技艺 · 民族 · 图腾 —— 一图看懂刺绣文化的关联脉络</p>
        </div>
        <div class="view-switch">
          <button
            class="view-btn"
            :class="{ active: viewMode === 'graph' }"
            @click="viewMode = 'graph'"
          >🔗 图谱视图</button>
          <button
            class="view-btn"
            :class="{ active: viewMode === 'list' }"
            @click="viewMode = 'list'"
          >📋 列表视图</button>
        </div>
      </div>

      <!-- 探索轨迹 -->
      <div class="graph-trail">
        <span class="trail-label">🧭 探索轨迹</span>
        <template v-if="trailIds.length">
          <template v-for="(id, i) in trailIds" :key="id">
            <span v-if="i" class="trail-arrow">→</span>
            <button
              class="trail-chip"
              :class="{ current: id === selectedId }"
              @click="selectNode(NODE_MAP[id])"
            >{{ NODE_MAP[id]?.name }}</button>
          </template>
        </template>
        <span v-else class="trail-empty">点击节点开始探索，串联你的知识路径</span>
        <span class="trail-progress">已探索 {{ exploredCount }} / {{ NODES.length }}</span>
      </div>

      <!-- 图谱视图：全宽画布（与探索轨迹对齐），节点静止可点击，支持小幅缩放 -->
      <div v-if="viewMode === 'graph'" ref="canvasWrapRef" class="graph-canvas-wrap">
          <div class="graph-legend">
            <div class="lg-item"><span class="lg-mark lg-core"></span>非遗刺绣</div>
            <button
              v-for="c in CATEGORIES"
              :key="c.id"
              class="lg-item lg-btn"
              :class="{ on: activeFilter === c.id }"
              @click="toggleFilter(c.id)"
            >
              <span class="lg-mark" :class="`lg-${c.id}`" :style="{ background: c.color }"></span>{{ c.name }}
            </button>
            <div class="lg-hint">鼠标拖动移动视角 · 滚轮缩放 · 浮层可拖动 · 点击图例聚焦分类</div>
          </div>

          <!-- 缩放控制 -->
          <div class="graph-controls">
            <button title="放大" @click="zoomBy(1.12)">＋</button>
            <button title="缩小" @click="zoomBy(0.9)">－</button>
            <button title="回到全景" @click="backToFull">⌂</button>
          </div>

          <!-- 节点专属界面：介绍 + 关联（选中后浮现，按住标题栏可拖动到画布任意位置） -->
          <Transition name="overlay-in">
            <div v-if="selectedNode" class="node-overlay" :style="overlayStyle">
              <div class="ov-head" title="按住拖动浮层" @pointerdown="onOvDown">
                <span class="ov-tag" :style="{ background: tagColor(selectedNode) }">{{ tagName(selectedNode) }}</span>
                <button class="ov-close" title="返回全景" @pointerup.stop @click="backToFull">✕</button>
              </div>
              <h3 class="ov-name">{{ selectedNode.name }}</h3>
              <p class="ov-intro">{{ selectedNode.intro }}</p>

              <template v-if="relatedNodes.length">
                <div class="ov-sec">🔗 关联节点（{{ relatedNodes.length }}）</div>
                <div class="ov-chips">
                  <button
                    v-for="r in relatedNodes"
                    :key="r.id"
                    class="ov-chip"
                    @click="selectNode(r)"
                  >{{ r.name }}</button>
                </div>
              </template>

              <button v-if="nodeExhibit" class="ov-exhibit" @click="goToExhibit(nodeExhibit.index)">
                <span>🏛️ 3D 展厅 · {{ nodeExhibit.name }}</span>
                <span>去观看 →</span>
              </button>

              <button class="ov-back" @click="backToFull">🌌 返回全景</button>
            </div>
          </Transition>

          <!-- 助手面板（右上角固定，可收起）：推荐 + 展品 + 冷知识 -->
          <Transition name="overlay-in">
            <div v-if="!selectedNode && sidePanelOpen" class="canvas-side-panel">
              <div class="csp-head">
                <span>🎯 助手面板</span>
                <button class="csp-close" title="收起面板" @click="sidePanelOpen = false">
                  <span class="csp-close-line"></span>
                </button>
              </div>

              <div class="csp-sec">为你推荐</div>
              <p class="csp-based">{{ recBase ? `因为你探索过「${recBase.name}」` : '精选热门节点，点击开始探索' }}</p>
              <div class="csp-chips">
                <button v-for="r in recNodes" :key="r.id" class="csp-chip" @click="selectNode(r)">{{ r.name }}</button>
              </div>

              <div class="csp-sec">🏛️ 展品推荐</div>
              <button v-for="ex in recExhibits" :key="ex.index" class="csp-exhibit" @click="goToExhibit(ex.index)">
                <span>3D 展厅 · {{ ex.name }}</span>
                <span>去观看 →</span>
              </button>

              <div class="csp-facts">
                <div class="csp-sec">💡 刺绣冷知识</div>
                <p class="csp-fact-text">{{ FACTS[factIndex] }}</p>
                <div class="fact-dots">
                  <span
                    v-for="(f, i) in FACTS"
                    :key="i"
                    class="fact-dot"
                    :class="{ on: i === factIndex }"
                    :title="f"
                    @click="factIndex = i"
                  ></span>
                </div>
              </div>

              <p class="csp-hint">点击图谱节点可进入它的专属界面，探索记录会用于个性化推荐</p>
            </div>
          </Transition>

          <!-- 面板收起后的重开按钮（右上角小胶囊） -->
          <button
            v-if="!selectedNode && !sidePanelOpen"
            class="csp-reopen"
            title="展开助手面板"
            @click="sidePanelOpen = true"
          >🎯 助手面板</button>

          <svg
            ref="svgRef"
            :viewBox="`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`"
            class="graph-svg"
            :class="{ dragging }"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointerleave="onPointerUp"
            @click="onCanvasClick"
          >
            <defs>
              <radialGradient
                v-for="c in CATEGORIES"
                :id="`gg-${c.id}`"
                :key="c.id"
                cx="35%"
                cy="30%"
                r="85%"
              >
                <stop offset="0%" :stop-color="gradLight(c.id)" />
                <stop offset="100%" :stop-color="c.color" />
              </radialGradient>
              <radialGradient id="gg-core" cx="35%" cy="30%" r="85%">
                <stop offset="0%" stop-color="#c9984a" />
                <stop offset="100%" stop-color="#8b6240" />
              </radialGradient>
            </defs>

            <!-- 视口：仅小幅缩放，无拖拽 -->
            <g :style="camStyle">
              <!-- 簇环：带分类色的柔光圈，完整框住每簇的节点与标签 -->
              <circle
                v-for="c in CATEGORIES"
                :key="`ring-${c.id}`"
                :cx="POSITIONS[`hub-${c.id}`].x"
                :cy="POSITIONS[`hub-${c.id}`].y"
                r="288"
                class="cluster-ring"
                :style="{ fill: c.color, stroke: c.color }"
              />

              <!-- 关系边 -->
              <g class="edges-in">
                <line
                  v-for="e in EDGES"
                  :key="`${e.a}-${e.b}`"
                  :x1="POSITIONS[e.a].x"
                  :y1="POSITIONS[e.a].y"
                  :x2="POSITIONS[e.b].x"
                  :y2="POSITIONS[e.b].y"
                  class="graph-edge"
                  :class="{ active: isEdgeActive(e), dimmed: isEdgeDimmed(e) }"
                />
              </g>

              <!-- 节点：外层 g 承载定位（translate 属性），内层 g 只做入场动画，
                   避免 CSS 动画的 transform 覆盖外层定位属性导致节点堆叠 -->
              <g
                v-for="n in renderNodes"
                :key="n.id"
                class="gnode"
                :class="{
                  selected: selectedId === n.id,
                  dimmed: isDimmed(n),
                  'is-hub': n.isHub,
                  'is-core': n.cat === 'core',
                }"
                :transform="`translate(${POSITIONS[n.id].x}, ${POSITIONS[n.id].y})`"
                @click.stop="selectNode(n)"
                @mouseenter="hoverNode(n, $event)"
                @mouseleave="leaveNode"
              >
                <g class="gnode-in" :style="{ animationDelay: `${animDelay(n)}ms` }">
                  <!-- 选中涟漪 -->
                  <circle
                    v-if="selectedId === n.id"
                    :r="haloR(n)"
                    class="gnode-halo"
                    :style="{ stroke: nodeCanvasColor(n) }"
                  />

                  <!-- 中心大圆章：文字入章 -->
                  <template v-if="n.cat === 'core'">
                    <circle r="58" fill="url(#gg-core)" class="gnode-core" />
                    <circle r="50" class="gnode-core-ring" />
                    <text
                      class="gnode-name-in"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      :style="{ fontSize: '19px' }"
                    >非遗刺绣</text>
                  </template>

                  <!-- 胶囊印章：名称直接写在章内 -->
                  <template v-else>
                    <rect
                      :x="-badgeSize(n).w / 2"
                      :y="-badgeSize(n).h / 2"
                      :width="badgeSize(n).w"
                      :height="badgeSize(n).h"
                      :rx="badgeSize(n).h / 2"
                      class="gnode-fill"
                      :style="{ fill: `url(#gg-${n.cat})` }"
                    />
                    <text
                      class="gnode-name-in"
                      text-anchor="middle"
                      dominant-baseline="middle"
                      :style="{ fontSize: `${badgeSize(n).fs}px` }"
                    >{{ n.name }}</text>
                  </template>
                </g>
              </g>
            </g>
          </svg>

          <!-- 悬浮提示 -->
          <div v-if="tip" class="graph-tip" :style="{ left: tip.x + 'px', top: tip.y + 'px' }">
            <div class="tip-name">{{ tip.name }}</div>
            <div class="tip-cat">{{ tip.catName }}</div>
          </div>
        </div>

        <!-- 列表视图 -->
        <div v-else class="graph-list">
          <div v-for="c in CATEGORIES" :key="c.id" class="list-group">
            <div class="list-group-head">
              <span class="lg-mark" :class="`lg-${c.id}`" :style="{ background: c.color }"></span>
              <span class="list-group-name">{{ c.name }}</span>
              <span class="list-group-count">{{ nodesOfCat(c.id).length }} 项</span>
            </div>
            <button v-for="n in nodesOfCat(c.id)" :key="n.id" class="list-row" @click="selectFromList(n)">
              <span class="list-row-name">{{ n.name }}</span>
              <span class="list-row-intro">{{ n.intro }}</span>
              <span class="list-row-rel">{{ neighborsOf(n.id).length }} 个关联 →</span>
            </button>
          </div>
        </div>

    </main>
  </div>
</template>

<script setup>
// GraphPage.vue — 非遗知识图谱页（必做项 3，纯前端）
// 节点全部静止、只可点击；仅支持小幅缩放（滚轮/按钮，画布中心为锚点）。
// 点击节点 → 相机聚焦 + 专属界面浮层（介绍与关联）；推荐基于 localStorage 探索历史
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import Navbar from '../components/Navbar.vue'
import {
  CATEGORIES, CENTER_NODE, NODES, EDGES, HUB_NODES, NODE_MAP,
  neighborsOf, POSITIONS, VIEWBOX,
} from '../page/graph/graphData.js'
import { MODELS } from '../utils/models.js'
import { goToExhibit } from '../utils/navigation.js'
import '../page/graph/index.css'

const viewMode = ref('graph')
const selectedId = ref(null)
const hoverId = ref(null)
const activeFilter = ref(null)
const tip = ref(null)
const canvasWrapRef = ref(null)
const svgRef = ref(null)
const sidePanelOpen = ref(true)   // 画布右上角助手面板（可收起）

// 渲染顺序：叶子 → 枢纽 → 中心（后者在上层）
const renderNodes = [...NODES, ...HUB_NODES, CENTER_NODE]

// 入场动画顺序：中心先亮 → 枢纽 → 叶子依次点亮
const animDelayMap = Object.fromEntries(
  [CENTER_NODE, ...HUB_NODES, ...NODES].map((n, i) => [n.id, i * 40]))
function animDelay(n) { return animDelayMap[n.id] ?? 0 }

const selectedNode = computed(() => (selectedId.value ? NODE_MAP[selectedId.value] : null))
const relatedNodes = computed(() => {
  if (!selectedId.value) return []
  return neighborsOf(selectedId.value).map((id) => NODE_MAP[id]).filter(Boolean)
})
const nodeExhibit = computed(() => {
  const ex = selectedNode.value?.exhibit
  if (ex == null || !MODELS[ex]) return null
  return { index: ex, name: MODELS[ex].name }
})

// 当前聚焦（选中优先于悬浮）
const activeId = computed(() => selectedId.value || hoverId.value)

function nodeCanvasColor(n) {
  if (n.cat === 'core') return '#8b6240'
  return CATEGORIES.find((c) => c.id === n.cat)?.color ?? '#8b6240'
}

// 渐变亮端色（与分类色同色系的高光端）
const GRAD_LIGHT = { skill: '#b98a5c', ethnic: '#4a9a95', totem: '#b17ba6' }
function gradLight(catId) {
  return GRAD_LIGHT[catId] ?? '#b98a5c'
}

// 胶囊印章尺寸：宽度按字数自适应（含 1px 字距），章内留白舒适、章间不挤
function badgeSize(n) {
  const len = n.name.length
  const fs = n.isHub ? 15 : 13.5
  const pad = n.isHub ? 28 : 20
  return {
    w: len * fs + (len - 1) + pad,
    h: n.isHub ? 46 : 38,
    fs,
  }
}

// 选中涟漪半径：按徽章外接圆 + 余量
function haloR(n) {
  if (n.cat === 'core') return 74
  const b = badgeSize(n)
  return Math.ceil(Math.hypot(b.w / 2, b.h / 2)) + 7
}

function tagName(n) {
  if (n.cat === 'core') return '中心主题'
  if (n.isHub) return '分类'
  return CATEGORIES.find((c) => c.id === n.cat)?.name ?? ''
}

function tagColor(n) {
  return n.cat === 'core' ? '#8b6240' : (CATEGORIES.find((c) => c.id === n.cat)?.color ?? '#8b6240')
}

// ── 专属界面浮层：可拖动到画布任意位置（按住标题栏拖动）──
const OVERLAY_W = 310
const overlayPos = reactive({ x: null, y: null })

const overlayStyle = computed(() => {
  if (overlayPos.x == null) return {}
  return { left: `${overlayPos.x}px`, top: `${overlayPos.y}px`, right: 'auto' }
})

let ovDrag = null

function onOvDown(e) {
  const rect = canvasWrapRef.value?.getBoundingClientRect()
  if (!rect) return
  ovDrag = {
    sx: e.clientX,
    sy: e.clientY,
    ox: overlayPos.x ?? rect.width - OVERLAY_W - 14,
    oy: overlayPos.y ?? 14,
    rect,
  }
  document.addEventListener('pointermove', onOvMove)
  document.addEventListener('pointerup', onOvUp)
}

function onOvMove(e) {
  if (!ovDrag) return
  const w = ovDrag.rect.width
  const h = ovDrag.rect.height
  overlayPos.x = Math.min(Math.max(8, ovDrag.ox + e.clientX - ovDrag.sx), w - OVERLAY_W - 8)
  overlayPos.y = Math.min(Math.max(8, ovDrag.oy + e.clientY - ovDrag.sy), h - 120)
}

function onOvUp() {
  ovDrag = null
  document.removeEventListener('pointermove', onOvMove)
  document.removeEventListener('pointerup', onOvUp)
}

// ── 相机：鼠标拖动平移 + 小幅缩放（节点在图中静止，移动的是视角） ──
const cam = reactive({ x: 0, y: 0, k: 1 })
const MIN_K = 0.85
const MAX_K = 1.55
const dragging = ref(false)
let dragStart = null
let dragMovedPx = 0

// 平移边界按「图谱覆盖率」动态计算：任何缩放级别下每轴覆盖 ≥85%
// （面积 ≥72% > 2/3），保证无论怎么拖，画面上始终有至少三分之二是图谱
const COVER = 0.85

function clampK(k) { return Math.min(MAX_K, Math.max(MIN_K, k)) }

function clampX(x, k) {
  const lo = Math.min(0, (COVER - k) * VIEWBOX.w)
  const hi = (1 - COVER) * VIEWBOX.w
  return Math.min(hi, Math.max(lo, x))
}

function clampY(y, k) {
  const lo = Math.min(0, (COVER - k) * VIEWBOX.h)
  const hi = (1 - COVER) * VIEWBOX.h
  return Math.min(hi, Math.max(lo, y))
}

const camStyle = computed(() => ({
  transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})`,
  transition: dragging.value ? 'none' : 'transform 0.28s ease',
}))

// 拖动平移：从节点上按下不启动（节点保持静止可点击）
function onPointerDown(e) {
  if (e.target.closest('.gnode')) return
  dragging.value = true
  dragMovedPx = 0
  dragStart = { px: e.clientX, py: e.clientY, cx: cam.x, cy: cam.y }
  svgRef.value?.setPointerCapture?.(e.pointerId)
}

function onPointerMove(e) {
  if (!dragging.value || !dragStart) return
  const rect = svgRef.value?.getBoundingClientRect()
  if (!rect) return
  const s = VIEWBOX.w / rect.width
  const dx = (e.clientX - dragStart.px) * s
  const dy = (e.clientY - dragStart.py) * s
  cam.x = clampX(dragStart.cx + dx, cam.k)
  cam.y = clampY(dragStart.cy + dy, cam.k)
  dragMovedPx = Math.max(dragMovedPx, Math.abs(dx) + Math.abs(dy))
}

function onPointerUp() {
  dragging.value = false
  dragStart = null
}

// 以画布中心为锚点缩放（＋/－按钮）
function zoomBy(f) {
  const newK = clampK(cam.k * f)
  cam.x = clampX(VIEWBOX.w / 2 - (newK / cam.k) * (VIEWBOX.w / 2 - cam.x), newK)
  cam.y = clampY(VIEWBOX.h / 2 - (newK / cam.k) * (VIEWBOX.h / 2 - cam.y), newK)
  cam.k = newK
}

// 滚轮缩放：以鼠标位置为锚点
function onWheel(e) {
  e.preventDefault()
  const rect = svgRef.value?.getBoundingClientRect()
  if (!rect) return
  const s = VIEWBOX.w / rect.width
  const mx = (e.clientX - rect.left) * s
  const my = (e.clientY - rect.top) * s
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
  const newK = clampK(cam.k * factor)
  cam.x = clampX(mx - (newK / cam.k) * (mx - cam.x), newK)
  cam.y = clampY(my - (newK / cam.k) * (my - cam.y), newK)
  cam.k = newK
}

// 相机聚焦某节点（配合 CSS transition 平滑移动）
function focusCamera(id) {
  const p = POSITIONS[id]
  if (!p) return
  const targetK = 1.3
  cam.k = targetK
  cam.x = clampX(VIEWBOX.w / 2 - targetK * p.x, targetK)
  cam.y = clampY(VIEWBOX.h / 2 - targetK * p.y, targetK)
}

function backToFull() {
  clearSelect()
  overlayPos.x = null
  overlayPos.y = null
  cam.k = 1
  cam.x = 0
  cam.y = 0
}

// ── 选中与高亮 ────────────────────────────────────
function selectNode(n) {
  selectedId.value = n.id
  focusCamera(n.id)
  pushHistory(n.id)
  pushTrail(n.id)
  pushVisited(n.id)
}

function selectFromList(n) {
  selectNode(n)
  viewMode.value = 'graph'
}

function clearSelect() {
  selectedId.value = null
}

// 点击画布空白：清除选中（拖动位移超过阈值视为移动视角，不算点击）
function onCanvasClick(e) {
  if (e.target.closest('.gnode')) return
  if (dragMovedPx > 6) return
  clearSelect()
}

function hoverNode(n, e) {
  hoverId.value = n.id
  const rect = canvasWrapRef.value?.getBoundingClientRect()
  if (!rect) return
  tip.value = {
    x: e.clientX - rect.left + 16,
    y: e.clientY - rect.top - 12,
    name: n.name,
    catName: tagName(n),
  }
}

function leaveNode() {
  hoverId.value = null
  tip.value = null
}

// 变暗规则：聚焦（选中/悬浮）优先，其次分类筛选
function isDimmed(n) {
  if (activeId.value) {
    return n.id !== activeId.value && !neighborsOf(activeId.value).includes(n.id)
  }
  if (activeFilter.value) {
    return n.cat !== activeFilter.value && n.cat !== 'core'
  }
  return false
}

function isEdgeActive(e) {
  return !!activeId.value && (e.a === activeId.value || e.b === activeId.value)
}

function isEdgeDimmed(e) {
  if (!activeFilter.value) return false
  if (isEdgeActive(e)) return false
  const a = NODE_MAP[e.a]
  const b = NODE_MAP[e.b]
  return a?.cat !== activeFilter.value && b?.cat !== activeFilter.value
}

function toggleFilter(catId) {
  activeFilter.value = activeFilter.value === catId ? null : catId
}

// ── 探索轨迹（本次会话内）──
const trailIds = ref([])
const visitedIds = ref([])
const exploredCount = computed(() => visitedIds.value.length)

function pushTrail(id) {
  if (id === 'center' || id.startsWith('hub-')) return
  const list = trailIds.value.filter((x) => x !== id)
  list.push(id)
  trailIds.value = list.slice(-8)
}

function pushVisited(id) {
  if (id === 'center' || id.startsWith('hub-')) return
  if (!visitedIds.value.includes(id)) visitedIds.value.push(id)
}

// ── 兴趣推荐（基于点选历史）──
const HISTORY_KEY = 'zhichuan-graph-history'
const FEATURED_IDS = ['miao', 'su', 'hudie', 'mawei']

function loadHistory() {
  try {
    const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

const historyIds = ref(loadHistory())

function pushHistory(id) {
  if (id === 'center' || id.startsWith('hub-')) return
  const list = historyIds.value.filter((x) => x !== id)
  list.unshift(id)
  historyIds.value = list.slice(0, 20)
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(historyIds.value)) } catch {}
}

const recBase = computed(() => {
  for (const id of historyIds.value) {
    const n = NODE_MAP[id]
    if (n && !n.isHub) return n
  }
  return null
})

const recNodes = computed(() => {
  const ids = recBase.value ? neighborsOf(recBase.value.id).slice(0, 5) : FEATURED_IDS
  return ids.map((id) => NODE_MAP[id]).filter(Boolean)
})

const recExhibits = [2, 5].map((i) => ({ index: i, name: MODELS[i]?.name ?? '' }))

function nodesOfCat(catId) {
  return NODES.filter((n) => n.cat === catId)
}

// ── 刺绣冷知识轮播 ────────────────────────────────
const FACTS = [
  '马尾绣以马尾毛为芯、缠丝线盘绣，耐磨百年不坏，被称为"中国刺绣活化石"。',
  '土族盘绣用"一针两线"：一根线盘、一根线钉，起源可追溯到吐谷浑时期。',
  '苗族没有通行文字，苗绣靠图腾纹样记录迁徙历史，被称为"穿在身上的史书"。',
  '乱针绣由杨守玉于20世纪30年代创立，近看针法纵横，远看形神兼备，被誉为"绣出来的油画"。',
  '苏绣讲究"劈丝"：一根蚕丝可以劈成 1/48 甚至 1/64，细过发丝。',
  '打籽绣每针绕线结籽，古人用它绣石榴籽，寄托多子多福的愿望。',
]

const factIndex = ref(0)
let factTimer = null

onMounted(() => {
  factTimer = setInterval(() => {
    factIndex.value = (factIndex.value + 1) % FACTS.length
  }, 6000)
  // 滚轮缩放需要 preventDefault 阻止页面滚动
  svgRef.value?.addEventListener('wheel', onWheel, { passive: false })
})

onBeforeUnmount(() => {
  clearInterval(factTimer)
  svgRef.value?.removeEventListener('wheel', onWheel)
  if (ovDrag) {
    document.removeEventListener('pointermove', onOvMove)
    document.removeEventListener('pointerup', onOvUp)
    ovDrag = null
  }
})
</script>
