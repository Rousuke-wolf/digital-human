<template>
  <div class="app-wrapper page-graph">
    <Navbar />

    <main class="graph-main">
      <div class="graph-head">
        <div class="graph-head-left">
          <h2 class="graph-title">非遗知识图谱</h2>
          <p class="graph-sub">敦煌星图式布局 · 技艺 / 民族 / 图腾三大星座 —— 点击星点探索刺绣文化关联</p>
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
        <span v-else class="trail-empty">点击星点开始探索，串联你的知识路径</span>
        <span class="trail-progress">已探索 {{ exploredCount }} / {{ NODES.length }}</span>
      </div>

      <!-- 顶部图例（可点击聚焦分类） -->
      <div class="graph-legend-bar">
        <span class="lgbar-label">图例</span>
        <button
          v-for="c in CATEGORIES"
          :key="c.id"
          class="lgbar-item"
          :class="{ on: activeFilter === c.id }"
          @click="toggleFilter(c.id)"
        >
          <span class="lgbar-dot" :style="{ background: c.color }"></span>{{ c.name }}
        </button>
        <span class="lgbar-hint">拖拽平移 · 滚轮缩放 · 点击星点聚焦 · 悬停查看名称</span>
      </div>

      <!-- 图谱视图：宣纸星图，节点静止可点击 -->
      <div v-if="viewMode === 'graph'" ref="canvasWrapRef" class="graph-canvas-wrap">
        <!-- 缩放控制（右上角，含当前幅度） -->
        <div class="graph-controls">
          <button title="放大 20%" @click="zoomBy(1.2)">＋</button>
          <button title="缩小 20%" @click="zoomBy(1 / 1.2)">－</button>
          <button title="重置视图" @click="backToFull">⌂</button>
          <span class="zoom-pct">{{ Math.round((cam.k / DEFAULT_K) * 100) }}%</span>
        </div>

        <!-- 视口滚动条：左侧竖条 + 底部横条（拖动滑块/点击轨道/滚轮联动移动视口） -->
        <div
          class="graph-scrollbar vsbar"
          :class="{ locked: !vsScrollable }"
          @pointerdown="onTrackJump($event, 'y')"
          @wheel.prevent="onScrollWheel($event, 'y')"
        >
          <div class="scrollbar-thumb" :style="vsThumbStyle" @pointerdown.stop="onThumbDown($event, 'y')"></div>
        </div>
        <div
          class="graph-scrollbar hsbar"
          :class="{ locked: !hsScrollable }"
          @pointerdown="onTrackJump($event, 'x')"
          @wheel.prevent="onScrollWheel($event, 'x')"
        >
          <div class="scrollbar-thumb" :style="hsThumbStyle" @pointerdown.stop="onThumbDown($event, 'x')"></div>
        </div>

        <!-- 节点专属界面：介绍 + 关联（选中后浮现，按住标题栏可拖动） -->
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

        <!-- 助手面板（右上角控制钮下方，可收起）：推荐 + 展品 + 冷知识 -->
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

        <!-- 面板收起后的重开小胶囊 -->
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
          @click="onCanvasClick"
        >
          <defs>
            <radialGradient id="gg-core" cx="35%" cy="30%" r="85%">
              <stop offset="0%" stop-color="#c9984a" />
              <stop offset="100%" stop-color="#8b6240" />
            </radialGradient>
            <!-- 星点柔光：渐变光晕（替代 filter，性能友好） -->
            <radialGradient v-for="c in CATEGORIES" :id="`gh-${c.id}`" :key="c.id">
              <stop offset="0%" :stop-color="c.color" stop-opacity="0.45" />
              <stop offset="100%" :stop-color="c.color" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="gh-core">
              <stop offset="0%" stop-color="#c9984a" stop-opacity="0.55" />
              <stop offset="100%" stop-color="#c9984a" stop-opacity="0" />
            </radialGradient>
          </defs>

          <!-- 视口：d3-zoom 平移/缩放 -->
          <g :transform="camTransform">
            <!-- 宣纸上的暗金碎星（静态） -->
            <circle
              v-for="(s, i) in GOLD_STARS"
              :key="i"
              :cx="s.x"
              :cy="s.y"
              :r="s.r"
              class="gold-star"
              :style="{ opacity: s.o }"
            />

            <!-- 扇区边界：极淡的放射虚线（柔和、无实线框） -->
            <line
              v-for="(l, i) in SECTOR_LINES"
              :key="i"
              :x1="l.x1"
              :y1="l.y1"
              :x2="l.x2"
              :y2="l.y2"
              class="sector-line"
            />

            <!-- 星状连线：同星座淡色，跨星座金色微光 -->
            <g class="edges-in">
              <line
                v-for="e in EDGES"
                :key="`${e.a}-${e.b}`"
                :x1="POSITIONS[e.a].x"
                :y1="POSITIONS[e.a].y"
                :x2="POSITIONS[e.b].x"
                :y2="POSITIONS[e.b].y"
                class="graph-edge"
                :class="{
                  cross: isCrossEdge(e),
                  active: isEdgeActive(e),
                  dimmed: isEdgeDimmed(e),
                }"
                :style="{ stroke: edgeColor(e) }"
              />
            </g>

            <!-- 星点节点：外层 g 定位，内层 g 入场动画（不覆盖定位） -->
            <g
              v-for="n in renderNodes"
              :key="n.id"
              class="gnode"
              :class="{
                selected: selectedId === n.id,
                dimmed: isDimmed(n),
                explored: isExplored(n),
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
                  :r="nodeRadius(n) + 12"
                  class="gnode-halo"
                  :style="{ stroke: nodeColor(n) }"
                />

                <!-- 中心主星【绣】 -->
                <template v-if="n.cat === 'core'">
                  <g class="star-pulse" :style="pulseStyle(n)">
                    <circle :r="nodeRadius(n) + 12" fill="url(#gh-core)" class="star-halo" />
                    <circle :r="nodeRadius(n)" fill="url(#gg-core)" class="star-shape star-core" />
                    <text class="gnode-core-char" y="7" text-anchor="middle">绣</text>
                    <circle :r="nodeRadius(n) + 14" class="gnode-hit" />
                  </g>
                  <text class="gnode-label gnode-label-center" y="46" text-anchor="middle">非遗刺绣</text>
                </template>

                <!-- 锚星（带常驻名称） / 子星点（探索后浮现名称） -->
                <template v-else>
                  <g class="star-pulse" :style="pulseStyle(n)">
                    <circle
                      :r="nodeRadius(n) + 9"
                      :fill="`url(#gh-${n.cat})`"
                      class="star-halo"
                    />
                    <circle
                      :r="nodeRadius(n)"
                      class="star-shape"
                      :class="`star-${n.cat}`"
                    />
                    <circle :r="nodeRadius(n) + 10" class="gnode-hit" />
                  </g>
                  <text
                    v-if="n.isHub"
                    class="gnode-label"
                    :y="nodeRadius(n) + 22"
                    text-anchor="middle"
                  >{{ n.name }}</text>
                  <!-- 探索过的子星点：沿径向向外浮现名称（白描边防压线），节点转为静态 -->
                  <text
                    v-else-if="isExplored(n)"
                    class="gnode-explored-label"
                    :x="labelOff(n).x"
                    :y="labelOff(n).y"
                    text-anchor="middle"
                    dominant-baseline="middle"
                  >{{ n.name }}</text>
                </template>
              </g>
            </g>
          </g>
        </svg>

        <!-- 悬浮提示（星点名称） -->
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
// GraphPage.vue — 非遗知识图谱页（必做项 3，纯前端 + d3-zoom）
// 敦煌星图式星座布局：中心主星【绣】+ 三个扇形星座片区（种子散布、位置固定），
// 星点节点（大小按层级）、悬停浮出名称、点击聚焦关联；
// 平移/缩放由 d3-zoom 提供（覆盖率约束保证画面始终 ≥2/3 是图谱）
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { select, zoom, zoomIdentity } from 'd3'
import Navbar from '../components/Navbar.vue'
import {
  CATEGORIES, CENTER_NODE, NODES, EDGES, HUB_NODES, NODE_MAP,
  neighborsOf, POSITIONS, VIEWBOX, GOLD_STARS,
} from '../page/graph/graphData.js'
import { MODELS } from '../utils/models.js'
import { goToExhibit } from '../utils/navigation.js'
import '../page/graph/index.css'
// 成长体系：图谱探索任务上报（注意本页不得 import qwen.js，client/useAuth 安全）
import { userAPI } from '../api/client.js'
import { useAuth } from '../composables/useAuth.js'

const { isLoggedIn } = useAuth()

const viewMode = ref('graph')
const selectedId = ref(null)
const activeFilter = ref(null)
const tip = ref(null)
const canvasWrapRef = ref(null)
const svgRef = ref(null)
const sidePanelOpen = ref(true)

// 渲染顺序：叶子 → 锚星 → 中心（后者在上层）
const renderNodes = [...NODES, ...HUB_NODES, CENTER_NODE]

// 入场动画顺序：中心先亮 → 锚星 → 星点依次点亮
const animDelayMap = Object.fromEntries(
  [CENTER_NODE, ...HUB_NODES, ...NODES].map((n, i) => [n.id, i * 35]))
function animDelay(n) { return animDelayMap[n.id] ?? 0 }

// ── 星点尺寸：按层级 + 关联度 ────────────────────
function nodeRadius(n) {
  if (n.cat === 'core') return 26
  if (n.isHub) return 12
  const deg = neighborsOf(n.id).length
  return Math.min(9.5, Math.max(5.5, 5.5 + deg * 0.45))
}

function nodeColor(n) {
  if (n.cat === 'core') return '#c9984a'
  return CATEGORIES.find((c) => c.id === n.cat)?.color ?? '#8b6240'
}

// ── 星点微动：逐个错开的轻柔起伏（探索后转为静态）──
function pulseStyle(n) {
  const idx = renderNodes.indexOf(n)
  return {
    animationDelay: `${(idx * 137) % 4000}ms`,
    animationDuration: `${3.6 + (idx % 4) * 0.9}s`,
  }
}

// 是否已探索过（点选过的节点浮现名称并停止浮动）
function isExplored(n) {
  return !n.isHub && n.cat !== 'core' && visitedIds.value.includes(n.id)
}

// 探索标签位置：沿径向向外偏移（避开中心与连线密集区）
function labelOff(n) {
  const p = POSITIONS[n.id]
  const cx = VIEWBOX.w / 2
  const cy = VIEWBOX.h / 2
  const a = Math.atan2(p.y - cy, p.x - cx)
  const d = nodeRadius(n) + 13
  return { x: Math.cos(a) * d, y: Math.sin(a) * d }
}

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

// 当前聚焦（仅选中时高亮关联；悬停只放大自身，保证响应流畅）
const activeId = computed(() => selectedId.value)

function tagName(n) {
  if (n.cat === 'core') return '中心主星'
  if (n.isHub) return '星座锚星'
  return CATEGORIES.find((c) => c.id === n.cat)?.name ?? ''
}

function tagColor(n) {
  return n.cat === 'core' ? '#8b6240' : (CATEGORIES.find((c) => c.id === n.cat)?.color ?? '#8b6240')
}

// ── 连线：跨星座=金色重点关联，同星座=分类色淡线 ──
function isCrossEdge(e) {
  return NODE_MAP[e.a]?.cat !== NODE_MAP[e.b]?.cat
}

function edgeColor(e) {
  return isCrossEdge(e) ? '#c9984a' : nodeColor(NODE_MAP[e.a])
}

// ── 扇区边界虚线（三块 120° 扇区的分界角：15°/165°/255°，极淡）──
const SECTOR_LINES = [15, 165, 255].map((deg) => {
  const a = (deg * Math.PI) / 180
  const cx = VIEWBOX.w / 2
  const cy = VIEWBOX.h / 2
  return {
    x1: cx + 110 * Math.cos(a),
    y1: cy + 110 * Math.sin(a),
    x2: cx + 375 * Math.cos(a),
    y2: cy + 375 * Math.sin(a),
  }
})

// ── 相机：d3-zoom 平移/缩放 + 覆盖率约束 ──────────
// 默认视图 k=1.0：整张星图完整居中展示（显示为 100%），
// 只允许放大缩小 20%（80%~120%），平移范围受限（±150/±130）
const DEFAULT_K = 1.0
const cam = reactive({ x: 0, y: 0, k: DEFAULT_K })
const MIN_K = DEFAULT_K * 0.8
const MAX_K = DEFAULT_K * 1.2
const dragging = ref(false)

// 平移绝对值上限（星图在极端位置仍保持 2/3 以上可见）
const PAN_X_MAX = 260
const PAN_Y_MAX = 230

function clampK(k) { return Math.min(MAX_K, Math.max(MIN_K, k)) }

// 平移约束：纯对称的绝对上限，任何缩放级别下左右/上下可移动距离一致
function clampX(x) {
  return Math.min(PAN_X_MAX, Math.max(-PAN_X_MAX, x))
}
function clampY(y) {
  return Math.min(PAN_Y_MAX, Math.max(-PAN_Y_MAX, y))
}

const camTransform = computed(() =>
  `translate(${cam.x}, ${cam.y}) scale(${cam.k})`)

let zoomBehavior = null

// ── 镜头漫游缓动：渲染的相机平滑追逐 d3 给出的目标变换，
//    观感是"视口窗口在固定的星图上滑行"，而非拖动星图本身 ──
const camTarget = { x: 0, y: 0, k: DEFAULT_K }
let camRafId = null
let instantUntil = 0

const CAM_EASE = 0.3   // 每帧逼近系数（轻微缓动，不拖沓）

function stepCam() {
  cam.x += (camTarget.x - cam.x) * CAM_EASE
  cam.y += (camTarget.y - cam.y) * CAM_EASE
  cam.k += (camTarget.k - cam.k) * CAM_EASE
  const diff = Math.abs(camTarget.x - cam.x)
    + Math.abs(camTarget.y - cam.y)
    + Math.abs(camTarget.k - cam.k)
  if (diff > 0.08) {
    camRafId = requestAnimationFrame(stepCam)
  } else {
    cam.x = camTarget.x
    cam.y = camTarget.y
    cam.k = camTarget.k
    camRafId = null
  }
}

// d3 zoom 事件：更新目标；程序化过渡期间直接落位（避免双重缓动）
function onZoomEvent(ev) {
  camTarget.x = ev.transform.x
  camTarget.y = ev.transform.y
  camTarget.k = ev.transform.k
  if (Date.now() < instantUntil) {
    cam.x = camTarget.x
    cam.y = camTarget.y
    cam.k = camTarget.k
    return
  }
  if (camRafId == null) camRafId = requestAnimationFrame(stepCam)
}

function applyCam(x, y, k, animate = false) {
  if (!zoomBehavior || !svgRef.value) {
    cam.x = x; cam.y = y; cam.k = k
    camTarget.x = x; camTarget.y = y; camTarget.k = k
    return
  }
  // 程序化移动（按钮/聚焦/重置）使用 d3 过渡，期间直接落位不叠加缓动
  instantUntil = Date.now() + 400
  const target = zoomIdentity.translate(x, y).scale(k)
  const sel = select(svgRef.value)
  if (animate) sel.transition().duration(300).call(zoomBehavior.transform, target)
  else sel.call(zoomBehavior.transform, target)
}

// 以画布中心为锚点缩放（＋/－按钮）
function zoomBy(f) {
  const newK = clampK(cam.k * f)
  const cx = VIEWBOX.w / 2
  const cy = VIEWBOX.h / 2
  applyCam(
    clampX(cx - (newK / cam.k) * (cx - cam.x)),
    clampY(cy - (newK / cam.k) * (cy - cam.y)),
    newK,
    true,
  )
}

function backToFull() {
  clearSelect()
  overlayPos.x = null
  overlayPos.y = null
  applyCam(0, 0, DEFAULT_K, true)
}

// 相机聚焦某节点
function focusCamera(id) {
  const p = POSITIONS[id]
  if (!p) return
  const targetK = MAX_K
  const cx = VIEWBOX.w / 2
  const cy = VIEWBOX.h / 2
  applyCam(
    clampX(cx - targetK * p.x),
    clampY(cy - targetK * p.y),
    targetK,
    true,
  )
}

// ── 专属界面浮层：可拖动到画布任意位置 ─────────────
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
    oy: overlayPos.y ?? 64,
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
  overlayPos.y = Math.min(Math.max(60, ovDrag.oy + e.clientY - ovDrag.sy), h - 120)
}

function onOvUp() {
  ovDrag = null
  document.removeEventListener('pointermove', onOvMove)
  document.removeEventListener('pointerup', onOvUp)
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

// 点击画布空白：清除选中（d3 拖拽会 preventDefault，此处防御）
function onCanvasClick(e) {
  if (e.defaultPrevented) return
  if (e.target.closest('.gnode')) return
  clearSelect()
}

function hoverNode(n, e) {
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
  tip.value = null
}

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
  if (!visitedIds.value.includes(id)) {
    visitedIds.value.push(id)
    // 成长体系：探索新节点时上报任务事件（仅登录；fire-and-forget 不阻塞交互）
    if (isLoggedIn.value) userAPI.tasksEvent('graph').catch(() => {})
  }
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

// 滚轮区域限制：光标在星图区（move 状态）时只缩放星图、阻止页面滚动；
// 悬浮面板/控制按钮/滚动条等 UI 区域内滚轮行为不受影响
function onWrapWheel(e) {
  if (!e.target.closest('.node-overlay, .canvas-side-panel, .graph-controls, .csp-reopen, .graph-scrollbar')) {
    e.preventDefault()
  }
}

// ── 视口滚动条：指示/拖动视口位置 ────────────────
// 视口在星图上的合法平移范围（与 translateExtent 一致）
function panRange(k, axis) {
  const size = axis === 'x' ? VIEWBOX.w : VIEWBOX.h
  const max = axis === 'x' ? PAN_X_MAX : PAN_Y_MAX
  const lo = size - (size + max) * k
  const hi = max * k
  return { lo, hi, scrollable: hi > lo }
}

const vsScrollable = computed(() => panRange(cam.k, 'y').scrollable)
const hsScrollable = computed(() => panRange(cam.k, 'x').scrollable)

// 滑块长度：视口占可漫游世界的比例；滑块行程限制在轨道内部（不超限）
const vsThumbStyle = computed(() => {
  const world = VIEWBOX.h + PAN_Y_MAX * 2
  const len = Math.min(100, Math.max(10, (VIEWBOX.h / cam.k / world) * 100))
  const { lo, hi } = panRange(cam.k, 'y')
  const ratio = hi > lo ? (cam.y - lo) / (hi - lo) : 0.5
  return {
    top: `${(ratio * (100 - len)).toFixed(1)}%`,
    height: `${len.toFixed(1)}%`,
  }
})

const hsThumbStyle = computed(() => {
  const world = VIEWBOX.w + PAN_X_MAX * 2
  const len = Math.min(100, Math.max(10, (VIEWBOX.w / cam.k / world) * 100))
  const { lo, hi } = panRange(cam.k, 'x')
  const ratio = hi > lo ? (cam.x - lo) / (hi - lo) : 0.5
  return {
    left: `${(ratio * (100 - len)).toFixed(1)}%`,
    width: `${len.toFixed(1)}%`,
  }
})

let scrollDrag = null   // { axis, barRect }

function scrollValueFromEvent(e, axis) {
  if (!scrollDrag) return null
  const { barRect } = scrollDrag
  const pos = axis === 'y' ? e.clientY : e.clientX
  const origin = axis === 'y' ? barRect.top : barRect.left
  const size = axis === 'y' ? barRect.height : barRect.width
  if (size <= 0) return null
  const ratio = Math.min(1, Math.max(0, (pos - origin) / size))
  const range = axis === 'y' ? panRange(cam.k, 'y') : panRange(cam.k, 'x')
  return range.lo + ratio * (range.hi - range.lo)
}

function onThumbDown(e, axis) {
  const bar = e.currentTarget.parentElement
  scrollDrag = { axis, barRect: bar.getBoundingClientRect() }
  document.addEventListener('pointermove', onScrollDragMove)
  document.addEventListener('pointerup', onScrollDragUp)
}

function onScrollDragMove(e) {
  if (!scrollDrag) return
  const axis = scrollDrag.axis
  const val = scrollValueFromEvent(e, axis)
  if (val == null) return
  if (axis === 'y') applyCam(cam.x, val, cam.k)
  else applyCam(val, cam.y, cam.k)
}

function onScrollDragUp() {
  scrollDrag = null
  document.removeEventListener('pointermove', onScrollDragMove)
  document.removeEventListener('pointerup', onScrollDragUp)
}

// 点击轨道：视口直接跳到对应位置
function onTrackJump(e, axis) {
  scrollDrag = { axis, barRect: e.currentTarget.getBoundingClientRect() }
  const val = scrollValueFromEvent(e, axis)
  if (val == null) return
  if (axis === 'y') applyCam(cam.x, val, cam.k)
  else applyCam(val, cam.y, cam.k)
  scrollDrag = null
}

// 悬停在滚动条上滚轮：竖条控制上下、横条控制左右
function onScrollWheel(e, axis) {
  const range = axis === 'y' ? panRange(cam.k, 'y') : panRange(cam.k, 'x')
  if (!range.scrollable) return
  const cur = axis === 'y' ? cam.y : cam.x
  const step = e.deltaY * 0.6
  const val = Math.min(range.hi, Math.max(range.lo, cur + step))
  if (axis === 'y') applyCam(cam.x, val, cam.k)
  else applyCam(val, cam.y, cam.k)
}

onMounted(() => {
  factTimer = setInterval(() => {
    factIndex.value = (factIndex.value + 1) % FACTS.length
  }, 6000)

  canvasWrapRef.value?.addEventListener('wheel', onWrapWheel, { passive: false })

  // d3-zoom：拖拽平移 + 滚轮缩放；从星点上按下不启动拖拽；
  // constrain 施加覆盖率约束（画面始终 ≥2/3 是图谱）
  const svgEl = svgRef.value
  if (!svgEl) return
  zoomBehavior = zoom()
    .scaleExtent([MIN_K, MAX_K])
    // 边界约束：视口窗口不得把星图拖出可视范围（±150/±130 冗余区）
    .translateExtent([
      [-PAN_X_MAX, -PAN_Y_MAX],
      [VIEWBOX.w + PAN_X_MAX, VIEWBOX.h + PAN_Y_MAX],
    ])
    // 滚轮缩放灵敏度调低（每格约 ×1.09，幅度更细腻），以光标为锚点（d3 默认）
    .wheelDelta((ev) => -ev.deltaY * 0.0012)
    .filter((ev) => {
      // 滚轮事件一律放行：d3 会 preventDefault，避免在星点上方滚动时
      // 触发整个页面的上下滚动
      if (ev.type === 'wheel') return true
      // 只有落在空白背景上才允许开始拖拽平移；从节点上按下只做选中
      return !ev.target.closest('.gnode') && ev.type !== 'dblclick'
    })
    .on('start', () => { dragging.value = true })
    .on('end', () => { dragging.value = false })
    .on('zoom', onZoomEvent)
  select(svgEl).call(zoomBehavior).on('dblclick.zoom', null)
  // 初始视角：默认 100%（整图居中完整展示）
  applyCam(0, 0, DEFAULT_K)
})

onBeforeUnmount(() => {
  clearInterval(factTimer)
  canvasWrapRef.value?.removeEventListener('wheel', onWrapWheel)
  if (camRafId != null) cancelAnimationFrame(camRafId)
  if (scrollDrag) {
    document.removeEventListener('pointermove', onScrollDragMove)
    document.removeEventListener('pointerup', onScrollDragUp)
    scrollDrag = null
  }
  if (ovDrag) {
    document.removeEventListener('pointermove', onOvMove)
    document.removeEventListener('pointerup', onOvUp)
    ovDrag = null
  }
})
</script>
