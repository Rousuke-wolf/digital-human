// scene3d.js — 知识图谱 3D 渲染引擎（必做项 3 扩展：2D/3D 双模式）
// 基于 three.js：深空星空背景 + 星体节点 + 星座连线 + CSS2D 中文标签。
// 职责边界：只负责 3D 渲染与拾取；选中/探索/滤镜等状态由 GraphPage 下发
// （setSelected/setVisited/setFilter），用户操作通过回调上报
// （onSelect/onHover/onLeave/onClear），由 GraphPage 走统一的探索管线。
// 精确性：节点位置由 POSITIONS 逐点映射（平面关系与 2D 完全一致），
// 颜色/半径/连线配色共用 graphData.js 的共享函数。
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import {
  NODES, EDGES, HUB_NODES, CENTER_NODE, NODE_MAP, POSITIONS, VIEWBOX,
  nodeColorOf, nodeRadiusOf, edgeIsCross, edgeColorOf, neighborsOf,
} from './graphData.js'

// ══ 可调参数（观感微调都在这里）════════════════════
// 初始视角（默认平视：相机几乎与盘面同高，从盘沿望向中心）
//   CAM_INIT.y 决定俯仰：0 = 完全平视，越大越俯视（如 480 = 高俯视）
//   CAM_INIT.z 决定远近：越小星图越大、越撑满屏幕（当前 ≈ 撑满 93% 屏宽）
//   CAM_TARGET 决定注视点（默认看向星图中心偏上一点）
const CAM_INIT = { x: 0, y: -20, z: 380 }
const CAM_TARGET = { x: 0, y: 25, z: 0 }
// 节点错落程度：
//   WAVE_AMP 涟漪波幅度（调大 = 整体起伏更剧烈）
//   JITTER_AMP 每节点确定性抖动（调大 = 错落更随机）
//   WAVE_FREQ 涟漪波频率（调大 = 波动更密集）
const WAVE_AMP = 65
const WAVE_FREQ = 0.016
const JITTER_AMP = 30
// 自转速度（0 = 关闭自转）
const AUTO_ROTATE_SPEED = 0.35
// 聚焦节点时的自转速度（缓转，便于端详；0 = 聚焦时完全停转）
const FOCUS_ROTATE_SPEED = 0.08
// 行星环透明度（0 = 隐藏光环）
const RING_OPACITY = 0.3
// ══════════════════════════════════════════════

// ── 布局映射：2D 视图盒坐标 → 3D 平面（x/z 逐点对应 2D，精确不变）──
const SCALE = 0.5          // 平面比例（1400×800 → 700×400 世界单位）
const Y_CENTER = 90        // 中心主星高度（众星拱卫的层次感）
const Y_HUB = 45           // 锚星高度

const yJitterRnd = mulberry32(987654321)
const yJitterMap = new Map()

function leafYOf(id) {
  const p = POSITIONS[id]
  const r = Math.hypot(p.x - VIEWBOX.w / 2, p.y - VIEWBOX.h / 2)
  const wave = WAVE_AMP * Math.sin(r * WAVE_FREQ + 0.8)
  if (!yJitterMap.has(id)) {
    yJitterMap.set(id, (yJitterRnd() - 0.5) * 2 * JITTER_AMP)
  }
  return wave + yJitterMap.get(id)
}

function elevationOf(n) {
  if (n.cat === 'core') return Y_CENTER
  if (n.isHub) return Y_HUB
  return leafYOf(n.id)
}

function pos3Of(id) {
  const p = POSITIONS[id]
  const n = NODE_MAP[id]
  return new THREE.Vector3(
    (p.x - VIEWBOX.w / 2) * SCALE,
    elevationOf(n),
    (p.y - VIEWBOX.h / 2) * SCALE,
  )
}

// 确定性伪随机（星空粒子用，与 graphData.js 同款）
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Canvas 纹理工厂 ────────────────────────────────
// 径向柔光（节点光晕精灵）
function makeGlowTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.28)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

// 中心主星「绣」字贴图（与 2D 印章呼应）
function makeCoreTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(96, 86, 16, 128, 128, 128)
  g.addColorStop(0, '#e8c37a')
  g.addColorStop(0.55, '#c9984a')
  g.addColorStop(1, '#8b6240')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = '#3d1f0a'
  ctx.font = 'bold 108px "KaiTi", "STKaiti", "Microsoft YaHei", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('绣', 128, 134)
  return new THREE.CanvasTexture(c)
}

// ── 星球表面纹理（灰度基底，material.color 着色为分类色）──
// 三种风格按节点 id 哈希确定性分配：条纹气态巨行星 / 岩石行星 / 柔雾行星
function hashOf(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

// 条纹气态行星：横向色带 + 细腻噪点
function makeBandedTexture(seed) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const ctx = c.getContext('2d')
  const rnd = mulberry32(seed)
  let y = 0
  while (y < 128) {
    const h = 6 + rnd() * 18
    const shade = 172 + Math.floor(rnd() * 64)
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`
    ctx.fillRect(0, y, 256, h)
    y += h
  }
  for (let k = 0; k < 900; k++) {
    const g = 140 + Math.floor(rnd() * 90)
    ctx.fillStyle = `rgba(${g},${g},${g},${0.06 + rnd() * 0.12})`
    ctx.fillRect(rnd() * 256, rnd() * 128, 1.4, 1.4)
  }
  return new THREE.CanvasTexture(c)
}

// 岩石行星：底色 + 深浅斑块
function makeRockyTexture(seed) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const ctx = c.getContext('2d')
  const rnd = mulberry32(seed)
  ctx.fillStyle = 'rgb(190,190,190)'
  ctx.fillRect(0, 0, 256, 128)
  for (let k = 0; k < 260; k++) {
    const r = 2 + rnd() * 9
    const g = 130 + Math.floor(rnd() * 105)
    ctx.fillStyle = `rgba(${g},${g},${g},0.16)`
    ctx.beginPath()
    ctx.arc(rnd() * 256, rnd() * 128, r, 0, Math.PI * 2)
    ctx.fill()
  }
  return new THREE.CanvasTexture(c)
}

// 柔雾行星：大半径柔和渐变斑
function makeMottledTexture(seed) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 128
  const ctx = c.getContext('2d')
  const rnd = mulberry32(seed)
  ctx.fillStyle = 'rgb(196,196,196)'
  ctx.fillRect(0, 0, 256, 128)
  for (let k = 0; k < 40; k++) {
    const x = rnd() * 256
    const y = rnd() * 128
    const r = 10 + rnd() * 30
    const g = 150 + Math.floor(rnd() * 86)
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, `rgba(${g},${g},${g},0.20)`)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 128)
  }
  return new THREE.CanvasTexture(c)
}

// 按节点 id 确定性选一种星球纹理
function planetTextureFor(id) {
  const h = hashOf(id)
  const kind = h % 3
  if (kind === 0) return makeBandedTexture(h)
  if (kind === 1) return makeRockyTexture(h + 7)
  return makeMottledTexture(h + 13)
}

// ── 初始化 ─────────────────────────────────────────
export function initGraph3D(container, { onSelect, onHover, onLeave, onClear }) {
  // WebGL 能力探测：不可用时抛出，由调用方回退 2D 并提示
  const probeCanvas = document.createElement('canvas')
  const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl')
  if (!gl) {
    throw new Error('当前浏览器无法创建 WebGL 上下文（可能未开启硬件加速），3D 星图不可用')
  }

  const allNodes = [...NODES, ...HUB_NODES, CENTER_NODE]
  const disposeList = []   // 几何体/材质/纹理，dispose 时统一释放

  // ── 场景 / 相机 / 渲染器 ──
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#0d1228')
  // 轻微雾效：远处星点淡出，增强纵深感
  scene.fog = new THREE.FogExp2('#0d1228', 0.00045)

  const camera = new THREE.PerspectiveCamera(45, 1, 1, 4000)
  // 初始视角见文件顶部 CAM_INIT / CAM_TARGET（默认平视、撑满屏宽）
  camera.position.set(CAM_INIT.x, CAM_INIT.y, CAM_INIT.z)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  // 上下文丢失（GPU 进程崩溃/驱动重置）：提示并停止渲染，避免黑屏循环
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    console.error('[graph3d] WebGL 上下文丢失，3D 渲染已停止')
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;'
  container.appendChild(renderer.domElement)
  disposeList.push(() => renderer.dispose())

  // ── CSS2D 标签层（中文清晰，不参与拾取）──
  const labelRenderer = new CSS2DRenderer()
  labelRenderer.domElement.style.cssText = 'position:absolute;inset:0;pointer-events:none;'
  container.appendChild(labelRenderer.domElement)

  // ── 轨道相机：阻尼 + 缓慢自转（用户交互即接管）──
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(CAM_TARGET.x, CAM_TARGET.y, CAM_TARGET.z)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = 260
  controls.maxDistance = 1800
  // 可绕到盘面下方、从下往上仰视星图（仰角），也可回到正俯视
  controls.minPolarAngle = 0.01
  controls.maxPolarAngle = 2.7
  controls.autoRotate = true
  controls.autoRotateSpeed = AUTO_ROTATE_SPEED
  controls.update()

  // ── 星空粒子背景（确定性散布在远处球壳上）──
  const starCount = 1500
  const starPos = new Float32Array(starCount * 3)
  const starCol = new Float32Array(starCount * 3)
  const rnd = mulberry32(20261022)
  const starColorA = new THREE.Color('#cfe0ff')
  const starColorB = new THREE.Color('#ffd9a0')
  for (let i = 0; i < starCount; i++) {
    const r = 950 + rnd() * 650
    const theta = rnd() * Math.PI * 2
    const phi = Math.acos(2 * rnd() - 1)
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    starPos[i * 3 + 1] = r * Math.cos(phi) * 0.7
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    const tint = Math.random() < 0.22 ? starColorB : starColorA
    starCol[i * 3] = tint.r
    starCol[i * 3 + 1] = tint.g
    starCol[i * 3 + 2] = tint.b
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3))
  const starMat = new THREE.PointsMaterial({
    size: 1.9,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const starfield = new THREE.Points(starGeo, starMat)
  scene.add(starfield)
  disposeList.push(() => { starGeo.dispose(); starMat.dispose() })

  // ── 星球光照：冷色环境光 + 暖色主光（左上），球体有明暗面才像星球 ──
  // 环境光调高让背光面不至于全黑，保持「星球在星空中仍清晰可见」
  scene.add(new THREE.AmbientLight('#9fb4e8', 0.9))
  const sunLight = new THREE.DirectionalLight('#ffe9c9', 1.3)
  sunLight.position.set(320, 460, 260)
  scene.add(sunLight)

  // 选中节点的「星灯」：点光源平滑追随选中星球，物理照亮其周边
  //（渐亮渐灭，配合光晕/连线高亮共同构成点击高亮的光渲染）
  const selectLight = new THREE.PointLight('#ffd98a', 0, 240, 0)
  scene.add(selectLight)
  let selectLightOn = false
  const selectLightPos = new THREE.Vector3()

  // ── 连线（星座连线，与 2D 同色系）──
  const glowTex = makeGlowTexture()

  const edgeLines = EDGES.map((e) => {
    const geo = new THREE.BufferGeometry().setFromPoints([pos3Of(e.a), pos3Of(e.b)])
    const mat = new THREE.LineBasicMaterial({
      color: edgeColorOf(e),
      transparent: true,
      opacity: edgeIsCross(e) ? 0.5 : 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const line = new THREE.Line(geo, mat)
    scene.add(line)
    disposeList.push(() => { geo.dispose(); mat.dispose() })
    return { e, line, mat }
  })

  // ── 节点 ─────────────────────────────────────────
  const nodeMap = new Map()   // id → { n, mesh, halo, ring, label, phase }
  const pickMeshes = []

  for (const n of allNodes) {
    const r = nodeRadiusOf(n) * SCALE
    const color = nodeColorOf(n)

    // 星体：光照材质 + 程序化星球表面（纹理灰度、材质着色为分类色）
    // emissive 轻微自发光：背光面也保留分类色相，不会暗成一团
    const geo = new THREE.SphereGeometry(r, 24, 16)
    const mat = new THREE.MeshStandardMaterial({
      map: planetTextureFor(n.id),
      color,
      emissive: color,
      emissiveIntensity: 0.22,
      roughness: 0.82,
      metalness: 0.06,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(pos3Of(n.id))
    mesh.userData.nodeId = n.id
    scene.add(mesh)
    pickMeshes.push(mesh)
    disposeList.push(() => { geo.dispose(); mat.dispose(); mat.map?.dispose() })

    // 行星环：中心主星与三颗锚星带平面光环（土星式扁环，非管状）
    let planetRing = null
    if (n.cat === 'core' || n.isHub) {
      const ringGeo = new THREE.RingGeometry(r * 1.7, r * 2.6, 48)
      const ringMat = new THREE.MeshBasicMaterial({
        color: n.cat === 'core' ? '#e8c188' : '#c9984a',
        transparent: true,
        opacity: RING_OPACITY,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      planetRing = new THREE.Mesh(ringGeo, ringMat)
      planetRing.rotation.x = -Math.PI / 2   // 平躺为行星赤道面
      planetRing.rotation.z = 0.18           // 轻微倾斜，更有真实感
      mesh.add(planetRing)
      disposeList.push(() => { ringGeo.dispose(); ringMat.dispose() })
    }

    // 光晕精灵（加色混合，呼吸动画在渲染循环里做）
    const haloMat = new THREE.SpriteMaterial({
      map: glowTex,
      color,
      transparent: true,
      opacity: n.cat === 'core' ? 0.9 : 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const halo = new THREE.Sprite(haloMat)
    halo.position.copy(mesh.position)
    halo.scale.setScalar(Math.max(14, r * 6.5))
    scene.add(halo)
    disposeList.push(() => { haloMat.dispose(); halo.map.dispose() })

    // CSS2D 标签（锚星/中心常驻；子星点探索后浮现——与 2D 规则一致）
    const labelEl = document.createElement('div')
    const label = new CSS2DObject(labelEl)
    label.position.copy(mesh.position)
    label.position.y += r + 10
    labelEl.textContent = n.name
    labelEl.className = 'g3d-label'
    if (n.cat === 'core') labelEl.className += ' g3d-label-center'
    else if (n.isHub) labelEl.className += ' g3d-label-hub'
    else {
      labelEl.className += ' g3d-label-leaf'
      labelEl.style.display = 'none'
    }
    scene.add(label)

    nodeMap.set(n.id, {
      n, mesh, halo, label, labelEl, planetRing,
      baseScale: halo.scale.x,
      haloColor: color,
      phase: (nodeMap.size * 137) % 4000 / 1000,
      dimmed: false,
      explored: false,
      // 自转：速度/方向按 id 确定性各异（星球缓转）
      spin: 0.06 + (hashOf(n.id) % 100) / 100 * 0.35,
      spinDir: hashOf(n.id + 'd') % 2 ? 1 : -1,
    })
  }

  // 中心主星贴「绣」字（覆盖为光照材质，与 2D 印章呼应）
  const coreEntry = nodeMap.get(CENTER_NODE.id)
  const coreTex = makeCoreTexture()
  coreEntry.mesh.material = new THREE.MeshStandardMaterial({
    map: coreTex,
    roughness: 0.6,
    metalness: 0.05,
  })
  coreEntry.mesh.rotation.z = Math.PI / 2
  disposeList.push(() => { coreEntry.mesh.material.map.dispose() })

  // ── 状态应用 ──────────────────────────────────────
  let selectedId = null
  let filterCat = null
  const exploredIds = new Set()

  // 与 2D isDimmed 相同语义：有选中时只亮选中+邻居；否则按滤镜暗化
  function isDimmed(id) {
    if (selectedId) {
      return id !== selectedId && !neighborsOf(selectedId).includes(id)
    }
    if (filterCat) {
      const n = NODE_MAP[id]
      return n.cat !== filterCat && n.cat !== 'core'
    }
    return false
  }

  function applyStates() {
    for (const [id, entry] of nodeMap) {
      const dim = isDimmed(id)
      entry.dimmed = dim
      entry.mesh.material.opacity = dim ? 0.12 : 1
      entry.mesh.material.transparent = true
      // 光晕强度：暗化最弱；选中节点最亮；选中时邻居被「星灯」照亮的次亮
      let haloOp
      if (dim) haloOp = 0.08
      else if (id === selectedId) haloOp = 0.85
      else if (selectedId) haloOp = 0.62
      else haloOp = entry.n.cat === 'core' ? 0.9 : 0.55
      entry.halo.material.opacity = haloOp
      // 选中节点：光晕转为暖金色（柔和的暖光发散，不夸张）
      entry.halo.material.color.set(id === selectedId ? '#ffd9a0' : entry.haloColor)
      // 行星环随暗化联动
      if (entry.planetRing) {
        entry.planetRing.material.opacity = dim ? 0.06 : RING_OPACITY
      }

      // 标签显隐：中心/锚星常驻；子星点仅已探索
      if (entry.n.cat !== 'core' && !entry.n.isHub) {
        entry.labelEl.style.display = entry.explored ? 'block' : 'none'
      }
    }
    // 连线亮度：选中时邻居连线点亮、其余暗化；滤镜时同理
    for (const { e, mat } of edgeLines) {
      let op
      if (selectedId) {
        const hot = e.a === selectedId || e.b === selectedId
        op = hot ? (edgeIsCross(e) ? 0.95 : 0.75) : 0.05
      } else if (filterCat) {
        const a = NODE_MAP[e.a]?.cat
        const b = NODE_MAP[e.b]?.cat
        op = (a === filterCat || b === filterCat) ? (edgeIsCross(e) ? 0.5 : 0.3) : 0.05
      } else {
        op = edgeIsCross(e) ? 0.5 : 0.3
      }
      mat.opacity = op
    }
  }

  // ── 拾取与交互 ────────────────────────────────────
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let hoveredId = null
  let downPos = null
  let downTime = 0
  let rafPending = false

  function updatePointer(e) {
    const rect = renderer.domElement.getBoundingClientRect()
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }

  function pickNode(e) {
    updatePointer(e)
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(pickMeshes, false)
    return hits.length ? NODE_MAP[hits[0].object.userData.nodeId] : null
  }

  function onPointerMove(e) {
    if (rafPending) return
    rafPending = true
    requestAnimationFrame(() => {
      rafPending = false
      const n = pickNode(e)
      if (n && n.id !== hoveredId) {
        hoveredId = n.id
        renderer.domElement.style.cursor = 'pointer'
        if (onHover) onHover(n, e)
      } else if (!n && hoveredId) {
        hoveredId = null
        renderer.domElement.style.cursor = 'grab'
        if (onLeave) onLeave()
      }
    })
  }

  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('pointerdown', (e) => {
    downPos = { x: e.clientX, y: e.clientY }
    downTime = Date.now()
  })
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downPos || Date.now() - downTime > 500) return
    const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y)
    downPos = null
    if (dist > 5) return   // 拖拽旋转不算点击
    const n = pickNode(e)
    if (n && onSelect) onSelect(n)
    else if (onClear) onClear()
  })

  // ── 渲染循环（呼吸动画 + 阻尼 + 自转）──
  let rafId = null
  let paused = false
  const clock = new THREE.Clock()

  function render() {
    rafId = requestAnimationFrame(render)
    if (paused) return
    const t = clock.getElapsedTime()
    const dt = Math.min(clock.getDelta(), 0.05)
    // 星灯：平滑追随选中星球并渐亮（柔和的暖光照明）；取消选中后渐灭
    if (selectLightOn) {
      selectLight.position.lerp(selectLightPos, 0.18)
      selectLight.intensity += (1.1 - selectLight.intensity) * 0.18
    } else {
      selectLight.intensity += (0 - selectLight.intensity) * 0.18
    }
    for (const entry of nodeMap.values()) {
      if (entry.explored && entry.n.cat !== 'core' && !entry.n.isHub) continue  // 已探索节点静态
      // 选中节点光晕轻微放大（柔和的暖光发散，不夸张）
      const boost = entry.n.id === selectedId ? 1.25 : 1
      const s = entry.baseScale * (1 + 0.12 * Math.sin(t * 1.4 + entry.phase)) * boost
      entry.halo.scale.setScalar(s)
      // 星球自转：普通星体绕极轴缓转；中心主星绕自身法线（保持「绣」字朝向）
      if (entry.n.cat === 'core') {
        entry.mesh.rotation.z += 0.0012
      } else {
        entry.mesh.rotation.y += entry.spin * entry.spinDir * dt
      }
    }
    controls.update()
    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)
  }

  // ── 尺寸自适应 ────────────────────────────────────
  function resize() {
    const w = container.clientWidth || 1
    const h = container.clientHeight || 1
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    labelRenderer.setSize(w, h)
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  disposeList.push(() => ro.disconnect())

  render()

  // ── 对外 API ──────────────────────────────────────
  return {
    setSelected(id) {
      selectedId = id
      // 聚焦某节点时转为缓慢自转（便于端详），取消聚焦后恢复常速自转
      controls.autoRotateSpeed = id ? FOCUS_ROTATE_SPEED : AUTO_ROTATE_SPEED
      // 星灯：点亮并移动到选中星球上方（渲染循环里平滑追随）
      selectLightOn = !!id
      if (id) {
        const p = pos3Of(id)
        selectLightPos.set(p.x, p.y + 30, p.z)
      }
      applyStates()
    },
    setVisited(ids) {
      exploredIds.clear()
      for (const id of ids) exploredIds.add(id)
      for (const [id, entry] of nodeMap) {
        entry.explored = exploredIds.has(id)
      }
      applyStates()
    },
    setFilter(catId) {
      filterCat = catId
      applyStates()
    },
    pause() { paused = true },
    resume() { paused = false },
    dispose() {
      cancelAnimationFrame(rafId)
      controls.dispose()
      renderer.domElement.remove()
      labelRenderer.domElement.remove()
      for (const d of disposeList) {
        try { d() } catch { /* 重复释放兜底 */ }
      }
    },
  }
}
