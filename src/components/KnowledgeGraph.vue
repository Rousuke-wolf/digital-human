<!-- ═══════════════════════════════════════════════════════
  KnowledgeGraph.vue — 3D 刺绣知识图谱（首页主视觉 / 叙事入口）
  能力清单：
    1. 琉璃质感节点（MeshPhysicalMaterial 透射 + 清漆高光 + 加法混合光晕），
       颜色全部取自 朱砂红/石青/鎏金 三传统色的低饱和变体；枢纽玉璧呼吸光环
    2. 淡金细连线 + 流光粒子（linkDirectionalParticles），悬停邻居连线提亮
    3. 镜头行为：禁用缩放 / 360° 拖拽旋转 / 闲置 autoRotate(0.8) 浮游感，
       拖拽时自动暂停、松手恢复；节点点击平滑聚焦
    4. 节点标签：CSS2D 纯文字（淡金 + 深底 text-shadow，投影仪可读），
       随全局语言切换同步翻译（useLocale）
    5. 紧凑球形分布：charge(-200) + 弱向心(0.05) + 径向围栏，
       节点云以画布中心为球心，永不飘出画布、不遮挡上方标题
    5. 工艺流程视角：focusStage('design' | 'color' | 'stitch' | 'product')
       切换镜头预设，供首页底部时间线调用
  props: data（图谱数据）/ open（详情抽屉开合，关闭时镜头复位全景）
  emits: node-click（点击节点，携带节点数据）
  expose: focusStage(key) / resetCamera()
═══════════════════════════════════════════════════════ -->
<template>
  <div ref="containerRef" class="graph-wrap">
    <!-- 图例（分组配色，深色玻璃） -->
    <div class="graph-legend">
      <div v-for="g in EMBROIDERY_GROUPS" :key="g.key" class="legend-item">
        <span class="legend-dot" :style="{ background: nodeGroupColor(g.key) }"></span>
        <span class="legend-label">{{ g.key }}</span>
        <span class="legend-desc">{{ g.desc }}</span>
      </div>
    </div>

    <!-- 操作提示 -->
    <div class="graph-hint">
      <span>拖拽 360° 旋转</span><span class="hint-dot">·</span><span>悬停查看</span><span class="hint-dot">·</span><span>点击节点进入绣法档案</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import ForceGraph3D from '3d-force-graph'
import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { forceCollide, forceCenter } from 'd3-force-3d'
import { EMBROIDERY_GROUPS } from '../data/embroideryData'
import { NODE_GROUP_COLORS, LINK_COLOR, LINK_COLOR_HOT, LINK_COLOR_DIM, LINK_PARTICLE_COLOR } from '../constants/palette'
import { useLocale } from '../composables/useLocale'

const props = defineProps({
  data: { type: Object, required: true },
  open: { type: Boolean, default: false }, // 详情抽屉开合状态：关闭时镜头复位全景
})

const emit = defineEmits(['node-click'])

const { locale, nodeName } = useLocale()

const containerRef = ref(null)

let graph = null
let css2d = null
let rafId = 0
let hoverNode = null
let focusing = false
let hubId = ''
let tooltipEl = null
let tooltipCard = null
let tooltipObj = null
let resumeTimer = null

/** 节点分组色：全部取自 朱砂红/石青/鎏金 三传统色的低饱和变体 */
function nodeGroupColor(group) {
  return NODE_GROUP_COLORS[group] || '#5f8474'
}

/* ════════ 自定义 d3 力：径向围栏（约束节点云不越出球壳） ════════ */

function containmentForce(centerY, radius) {
  let nodes = []
  function force(alpha) {
    for (const n of nodes) {
      const dx = n.x
      const dy = n.y - centerY
      const dz = n.z
      const d = Math.hypot(dx, dy, dz)
      if (d > radius) {
        const s = ((d - radius) / d) * alpha * 0.9
        n.vx -= dx * s
        n.vy -= dy * s
        n.vz -= dz * s
      }
    }
  }
  force.initialize = (ns) => {
    nodes = ns
  }
  return force
}

/* ════════ 节点构建（玉石琉璃球体 + 无底色 CSS2D 大字标签） ════════ */

// 球体半径按节点权重放大；枢纽节点再加大一档
function nodeRadius(node) {
  return 8 + node.val * 0.45 + (node.id === hubId ? 2.5 : 0)
}

// 当前语言下的节点标签文本（中文回退中文名）
function labelText(node) {
  return nodeName(node)
}

function buildNodeObject(node) {
  if (node.__obj) return node.__obj

  const color = nodeGroupColor(node.group)
  const radius = nodeRadius(node)

  const group = new THREE.Group()

  // 主体：琉璃质感 —— 透射(transmission) 模拟半透明折射 + 低粗糙度 + 清漆高光 + 同色微自发光
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 48),
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.3,
      metalness: 0,
      transmission: 0.35,
      thickness: 1.4,
      ior: 1.45,
      clearcoat: 0.9,
      clearcoatRoughness: 0.22,
      emissive: color,
      emissiveIntensity: 0.14,
      transparent: true,
      opacity: 0.92,
    })
  )
  group.add(sphere)

  // 光晕外壳（加法混合模拟琉璃透光，悬停时增强）
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.16, 32, 32),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  halo.renderOrder = 1
  group.add(halo)

  // 名称标签：CSS2D 纯文字，无任何底色，靠深底 text-shadow 保证投影仪可读
  const labelEl = document.createElement('div')
  labelEl.className = 'graph-node-label'
  labelEl.textContent = labelText(node)
  const label = new CSS2DObject(labelEl)
  label.position.y = radius + 2.4
  group.add(label)

  // 枢纽节点：玉璧光环（呼吸发光 + 缓慢旋转）
  let ring = null
  if (node.id === hubId) {
    ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.55, radius * 0.13, 20, 72),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      })
    )
    group.add(ring)
  }

  node.__obj = group
  node.__sphere = sphere
  node.__halo = halo
  node.__ring = ring
  node.__labelEl = labelEl
  node.__isHub = node.id === hubId
  node.__scale = 1
  node.__glow = 0

  return group
}

/* ════════ 悬停提示卡（CSS2D，跟随节点实时定位） ════════ */

function updateTooltip(node) {
  tooltipCard.innerHTML = ''
  if (!node) return

  const name = document.createElement('div')
  name.className = 'tip-name'
  name.textContent = labelText(node)

  const chip = document.createElement('span')
  chip.className = 'tip-chip'
  chip.style.background = nodeGroupColor(node.group)
  chip.textContent = node.group

  const slogan = document.createElement('div')
  slogan.className = 'tip-slogan'
  slogan.textContent = node.slogan

  tooltipCard.append(name, chip, slogan)
}

/* ════════ 语言切换：节点标签 + 悬停提示卡同步翻译 ════════ */

watch(locale, () => {
  if (!graph) return
  for (const n of graph.graphData().nodes) {
    if (n.__labelEl) n.__labelEl.textContent = labelText(n)
  }
  if (hoverNode) updateTooltip(hoverNode)
})

/* ════════ 交互 ════════ */

// 悬停：光标变手型、节点放大发光、提示卡出现、相邻连线变亮加粗
function handleNodeHover(node) {
  if (hoverNode === node) return
  hoverNode = node

  const el = containerRef.value
  if (el) el.style.cursor = node ? 'pointer' : 'grab'

  if (node) {
    updateTooltip(node)
    tooltipEl.classList.remove('is-hidden')
  } else {
    tooltipEl.classList.add('is-hidden')
  }

  // 连线：邻居淡金变亮加粗、其余淡出（accessor + refresh 触发重建）
  graph.linkWidth((l) => {
    if (!node) return 1.6
    return l.source === node || l.target === node ? 3.4 : 0.8
  })
  graph.linkColor((l) => {
    if (!node) return LINK_COLOR
    return l.source === node || l.target === node ? LINK_COLOR_HOT : LINK_COLOR_DIM
  })
  graph.refresh()
}

// 点击：相机平滑聚焦 → 通知父组件打开详情抽屉
function handleNodeClick(node) {
  if (focusing || !node) return
  focusing = true

  const distance = 150
  const dist = Math.hypot(node.x, node.y, node.z) || 1
  const distRatio = 1 + distance / dist
  graph.cameraPosition(
    { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
    node,
    900
  )

  setTimeout(() => {
    focusing = false
    emit('node-click', node)
  }, 950)
}

// 抽屉关闭 → 镜头平滑复位全景（配合 autoRotate，回归「大字在上、图谱偏下」构图）
watch(
  () => props.open,
  (open) => {
    if (!open && graph) {
      resetCamera(1500)
    }
  }
)

/* ════════ 工艺流程视角（供首页时间线调用） ════════ */

const STAGE_CAMERAS = {
  design: { from: { x: 0, y: 25, z: 360 }, to: { x: 0, y: 0, z: 0 } },      // 设计：全景总览
  color: { from: { x: 150, y: 18, z: 240 }, to: { x: 0, y: 0, z: 0 } },     // 配色：侧近景，看三色流派分布
  stitch: { from: { x: 0, y: -150, z: 200 }, to: { x: 0, y: 0, z: 0 } },    // 针法：仰角近景，看连线脉络
  product: { from: { x: 0, y: 170, z: 320 }, to: { x: 0, y: 0, z: 0 } },    // 成品：俯视巡礼
}

function focusStage(stageKey) {
  if (!graph) return
  const preset = STAGE_CAMERAS[stageKey]
  if (!preset) return
  graph.cameraPosition(preset.from, preset.to, 1600)
}

function resetCamera(duration = 1500) {
  if (!graph) return
  const preset = STAGE_CAMERAS.design
  graph.cameraPosition(preset.from, preset.to, duration)
}

defineExpose({ focusStage, resetCamera })

/* ════════ 每帧循环：矩阵刷新 + 悬停缓动 + 枢纽呼吸 + CSS2D 投影 ════════ */

function tick() {
  const now = performance.now()
  const scene = graph.scene()
  const camera = graph.camera()

  // 关键：每帧强制刷新相机矩阵。three 只在矩阵变更时求逆，
  // 相机静止后 matrixWorldInverse 会停留在旧姿态，导致库的射线检测整体偏移
  camera.updateMatrixWorld(true)
  scene.updateMatrixWorld(true)

  const nodes = graph.graphData().nodes
  for (const n of nodes) {
    const isHover = n === hoverNode
    const targetScale = isHover ? 1.14 : 1
    const targetGlow = isHover ? 1 : 0
    const s = n.__scale + (targetScale - n.__scale) * 0.16
    const g = n.__glow + (targetGlow - n.__glow) * 0.14
    n.__scale = s
    n.__glow = g

    if (n.__obj) {
      n.__obj.scale.setScalar(s)
      n.__sphere.material.emissiveIntensity = 0.18 + 0.4 * g
      n.__halo.material.opacity = 0.15 + 0.22 * g
    }

    // 枢纽玉璧：呼吸发光 + 光环旋转
    if (n.__isHub && n.__ring) {
      const breathe = 0.5 + 0.5 * Math.sin(now / 850)
      n.__sphere.material.emissiveIntensity = 0.22 + 0.24 * breathe + 0.4 * g
      n.__halo.material.opacity = 0.18 + 0.14 * breathe + 0.22 * g
      n.__ring.material.opacity = 0.32 + 0.22 * breathe
      n.__ring.rotation.y += 0.004
    }
  }

  if (hoverNode) {
    tooltipObj.position.set(
      hoverNode.x,
      hoverNode.y + nodeRadius(hoverNode) + 8.5,
      hoverNode.z
    )
  }

  css2d.render(scene, camera)
  rafId = requestAnimationFrame(tick)
}

// 窗口尺寸自适应（库自身不监听 resize）
function handleResize() {
  if (!graph || !containerRef.value) return
  const el = containerRef.value
  graph.width(el.clientWidth)
  graph.height(el.clientHeight)
  if (css2d) css2d.setSize(el.clientWidth, el.clientHeight)
}

/* ════════ 生命周期 ════════ */

onMounted(() => {
  const el = containerRef.value

  // 枢纽 = 连线最多的节点
  const degree = new Map()
  for (const l of props.data.links) {
    degree.set(l.source, (degree.get(l.source) || 0) + 1)
    degree.set(l.target, (degree.get(l.target) || 0) + 1)
  }
  hubId = [...degree.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ''

  // 深拷贝数据交给图谱引擎，避免污染共享数据源
  const data = JSON.parse(JSON.stringify(props.data))

  // 预置初始位置：黄金角球面均匀分布（球心在画布正中心）。大斥力若从随机点起步
  // 会剧烈膨胀过冲，先铺成紧凑球壳，力模拟只在局部微调，节点云稳定收拢
  const nCount = data.nodes.length
  data.nodes.forEach((n, i) => {
    const t = -1 + (2 * (i + 0.5)) / nCount
    const phi = Math.acos(t)
    const theta = i * 2.399963 // 黄金角
    const r = 55
    n.x = r * Math.sin(phi) * Math.cos(theta)
    n.z = r * Math.sin(phi) * Math.sin(theta)
    n.y = r * Math.cos(phi) // 标题在画布上方的独立区域，节点云以画布中心为球心即可
  })

  // controlType: 'orbit' 必须在构造时传入（Kapsule 初始化参数）：3d-force-graph 默认
  // 'trackball'，而 TrackballControls 没有 enableZoom/autoRotate 等 OrbitControls 配置项
  graph = new ForceGraph3D(el, { controlType: 'orbit' })
    .backgroundColor('rgba(0, 0, 0, 0)')
    .graphData(data)
    .nodeThreeObject(buildNodeObject)
    .linkWidth(1.6)
    .linkColor(() => LINK_COLOR)
    .linkDirectionalParticles(1) // 淡金流光沿连线游走：连线「微光」质感
    .linkDirectionalParticleWidth(1.2)
    .linkDirectionalParticleSpeed(0.006)
    .linkDirectionalParticleColor(() => LINK_PARTICLE_COLOR)
    .onNodeHover(handleNodeHover)
    .onNodeClick(handleNodeClick)

  /* ── OrbitControls 镜头行为精准控制 ── */
  const controls = graph.controls()
  controls.enableZoom = false // 禁止鼠标滚轮 / 触控板捏合缩放，视角距离恒定、构图平稳
  controls.enableRotate = true // 强制开启 360° 全方位拖拽旋转
  controls.autoRotate = true // 闲置时缓慢自动环绕，营造太空浮游感
  controls.autoRotateSpeed = 0.8 // 缓慢速度（答辩演示要求值）
  controls.enablePan = false // 顺手禁用平移，守住「标题在上、图谱居中」的固定构图

  // 浮游感与拖拽互不打架：按下（含节点拖拽）即暂停自动旋转，松手 400ms 后恢复
  const scheduleResume = () => {
    clearTimeout(resumeTimer)
    resumeTimer = setTimeout(() => {
      controls.autoRotate = true
    }, 400)
  }
  controls.addEventListener('start', () => {
    controls.autoRotate = false
  })
  controls.addEventListener('end', scheduleResume)
  graph.onNodeDrag(() => {
    controls.autoRotate = false
  })
  graph.onNodeDragEnd(scheduleResume)

  // 兼容修复：节点拖拽结束时 3d-force-graph 会向 document 派发一个合成的 pointerup
  // （无 pointerId、isTrusted=false），three r186 的 OrbitControls 处理它时会去读
  // 不存在的指针位置（_pointerPositions[id] 为 undefined）抛 TypeError。
  // 用包装函数过滤合成事件：真实 pointerup 随后照常到达，内部状态依然正常复位
  if (typeof controls._onPointerUp === 'function') {
    const origOnPointerUp = controls._onPointerUp.bind(controls)
    controls._onPointerUp = (event) => {
      if (event && !event.isTrusted) return
      origOnPointerUp(event)
    }
  }

  // 力参数必须单独调用：d3Force('link') 返回的是力对象而非图实例，不能链式接回
  graph.d3Force('link').distance(80)
  graph.d3Force('charge').strength(-200) // 柔和斥力：紧凑均匀球形分布（答辩演示要求值）
  graph.d3Force('center', forceCenter(0, 0, 0).strength(0.05)) // 弱向心：只兜底不拉扯，球形构图靠预置位 + 围栏成形（答辩演示要求值）
  graph.d3Force('collision', forceCollide().radius((n) => nodeRadius(n) + 6))
  // 径向围栏：把整团约束在以画布中心为球心、半径 120 的球壳内 ——
  // 节点永不飘出画布、永不遮挡上方标题区
  graph.d3Force('contain', containmentForce(0, 120))
  // 加速冷却：节点云快速收敛，演示时画面稳定不抖
  graph.d3AlphaDecay(0.06)
  graph.d3VelocityDecay(0.32)

  // 柔和光照（覆盖库默认的强环境光，深底上玉石高光更通透）
  const ambient = new THREE.AmbientLight(0xffffff, 1.5)
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4)
  keyLight.position.set(1, 2, 1)
  const rimLight = new THREE.DirectionalLight(0xffe6c0, 0.9) // 暖金轮廓光：深底勾勒琉璃边缘（克制用色）
  rimLight.position.set(-2, 0.6, -1)
  graph.lights([ambient, keyLight, rimLight])

  // 初始尺寸 + 自适应窗口
  graph.width(el.clientWidth || 800)
  graph.height(el.clientHeight || 500)
  window.addEventListener('resize', handleResize)

  /* ── CSS2D 渲染层（DOM 文字，不受缩放影响，永远清晰） ── */
  css2d = new CSS2DRenderer()
  const cssEl = css2d.domElement
  cssEl.className = 'graph-css2d'
  cssEl.style.zIndex = '3'
  cssEl.style.pointerEvents = 'none'
  el.appendChild(cssEl)
  css2d.setSize(el.clientWidth, el.clientHeight)

  /* ── 悬停提示卡 ── */
  tooltipEl = document.createElement('div')
  tooltipEl.className = 'graph-tooltip is-hidden'
  tooltipCard = document.createElement('div')
  tooltipCard.className = 'tooltip-card'
  tooltipEl.appendChild(tooltipCard)
  tooltipObj = new CSS2DObject(tooltipEl)
  graph.scene().add(tooltipObj)

  // 开场镜头：远景缓缓推近至全景（视线落在节点云中心，标题在其上方独立区域）
  graph.cameraPosition({ x: 0, y: 0, z: 620 }, { x: 0, y: 0, z: 0 }, 0)
  graph.cameraPosition({ x: 0, y: 25, z: 360 }, { x: 0, y: 0, z: 0 }, 2400)

  rafId = requestAnimationFrame(tick)

  // 开发环境调试句柄（生产构建会被剔除）
  if (import.meta.env.DEV) {
    window.__embroideryGraph = graph
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  cancelAnimationFrame(rafId)
  clearTimeout(resumeTimer)
  if (graph) {
    graph.pauseAnimation()
    graph._destructor()
  }
  graph = null
  css2d = null
  hoverNode = null
  const el = containerRef.value
  if (el) el.innerHTML = ''
})
</script>

<style scoped lang="scss">
@use '../styles/variables.scss' as *;

.graph-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: grab;
}

/* ── 图例（深色玻璃） ── */
.graph-legend {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 12px 16px;
  border-radius: 16px;
  background: $glass;
  border: 1px solid $glass-border;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: $shadow-deep;
  pointer-events: none;
  user-select: none;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
}

.legend-label {
  font-size: 13px;
  font-weight: 600;
  color: $ivory;
  white-space: nowrap;
}

.legend-desc {
  font-size: 11px;
  color: $muted;
  white-space: nowrap;
}

/* ── 操作提示 ── */
.graph-hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  border-radius: 40px;
  background: $glass;
  border: 1px solid $glass-border;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: $shadow-deep;
  font-size: 12px;
  color: $muted;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}

.hint-dot {
  color: $gold;
}

/* ── 移动端 ── */
@media (max-width: 640px) {
  .graph-legend {
    top: 10px;
    left: 10px;
    padding: 9px 12px;
    gap: 5px;
  }

  .legend-desc {
    display: none;
  }

  .graph-hint {
    bottom: 12px;
    padding: 6px 14px;
    font-size: 11px;
    gap: 6px;
  }
}
</style>

<!-- CSS2D 元素由 JS 动态创建，scoped 无法命中，必须全局样式 -->
<style lang="scss">
@use '../styles/variables.scss' as *;

.graph-css2d {
  position: absolute;
  top: 0;
  left: 0;
}

/* ── 节点名称标签：纯文字无底色，淡金 + 深墨绿 text-shadow（投影仪高可读） ── */
.graph-node-label {
  pointer-events: none;
  user-select: none;
  font-family: 'Noto Serif SC', 'Songti SC', 'SimSun', serif;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 2px;
  color: $gold-pale;
  white-space: nowrap;
  text-shadow:
    0 1px 2px rgba(16, 31, 27, 0.95),
    0 2px 8px rgba(16, 31, 27, 0.85),
    0 0 16px rgba(16, 31, 27, 0.7);
}

/* ── 悬停提示卡（深色玻璃） ── */
.graph-tooltip {
  pointer-events: none;
  user-select: none;
}

.graph-tooltip .tooltip-card {
  min-width: 190px;
  padding: 14px 18px;
  border-radius: 16px;
  background: rgba(16, 31, 27, 0.94);
  border: 1px solid $glass-border;
  box-shadow: $shadow-deep;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  text-align: center;
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.graph-tooltip.is-hidden .tooltip-card {
  opacity: 0;
  transform: translateY(8px) scale(0.92);
}

.graph-tooltip .tip-name {
  font-family: 'Ma Shan Zheng', 'STKaiti', 'KaiTi', serif;
  font-size: 24px;
  letter-spacing: 2px;
  color: $gold-pale;
}

.graph-tooltip .tip-chip {
  display: inline-block;
  margin-top: 6px;
  padding: 2px 12px;
  border-radius: 999px;
  color: #ffffff;
  font-size: 12px;
  letter-spacing: 2px;
}

.graph-tooltip .tip-slogan {
  margin-top: 8px;
  font-size: 13px;
  color: $muted;
  line-height: 1.6;
}

@media (max-width: 640px) {
  .graph-node-label {
    font-size: 16px;
    letter-spacing: 1px;
  }
}
</style>
