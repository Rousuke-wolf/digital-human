<!-- ═══════════════════════════════════════════════════════
  Home.vue — 首页（答辩主舞台，src/views/ 主页面）
  布局（上下结构，东方留白，做减法之后的两段式）：
    上：居中书法标题「绣美中华」+ 副标题（收紧的固定高度区）
    中：3D 知识图谱画布 —— 向下扩展填满剩余全部空间，
        与标题形成紧凑的视觉组（球形节点云，永不飘出画布/遮挡标题）
    右：数字人对话面板 —— 顶部与图谱区上沿平齐、底部与图谱区下沿平齐，
        毛玻璃 + 极细鎏金边框（左右平衡版式）
  交互流：节点点击 → 镜头聚焦 → 抽屉滑出 → 「与传承人对话」→ 数字人讲解
═══════════════════════════════════════════════════════ -->
<template>
  <div class="app-wrapper page-home">
    <Navbar />

    <!-- 上下布局主舞台 -->
    <section class="graph-hero">
      <!-- 上：书法标题区（收紧高度，让视线更快落到图谱） -->
      <header class="hero-title-block">
        <h1 class="hero-title">绣美中华</h1>
        <p class="hero-subtitle">十二大流派 · 一针一线皆山河</p>
      </header>

      <!-- 中：3D 图谱画布区（向下扩展，占据标题以下的全部空间） -->
      <div class="graph-zone">
        <KnowledgeGraph
          ref="graphRef"
          :data="embroideryData"
          :open="drawerOpen"
          @node-click="openDrawer"
        />
      </div>

      <!-- 数字人对话面板（右对齐；顶与图谱区上沿平齐、底与图谱区下沿平齐） -->
      <DigitalHumanPanel ref="panelRef" auto-greet />
    </section>

    <!-- 绣法详情抽屉（右侧滑出） -->
    <EmbroideryDrawer
      :open="drawerOpen"
      :node="activeNode"
      @close="closeDrawer"
      @talk="talkWithMaster"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Navbar from '../components/Navbar.vue'
import KnowledgeGraph from '../components/KnowledgeGraph.vue'
import DigitalHumanPanel from '../components/DigitalHumanPanel.vue'
import EmbroideryDrawer from '../components/EmbroideryDrawer.vue'
import { embroideryData } from '../data/embroideryData'

const graphRef = ref(null)
const panelRef = ref(null)

/* ── 节点详情抽屉 ── */
const drawerOpen = ref(false)
const activeNode = ref(null)

function openDrawer(node) {
  activeNode.value = node
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
}

/* ── 抽屉「与传承人对话」→ 数字人针对该绣法专属讲解 ── */
function talkWithMaster(node) {
  closeDrawer()
  panelRef.value?.askAbout(node)
}
</script>

<style scoped lang="scss">
@use '../styles/variables.scss' as *;

/* ── 主舞台：深墨绿底 + 宣纸噪点 + 金晕 + 暗角，上下两段式 ── */
.graph-hero {
  position: relative;
  height: calc(100vh - 64px);
  min-height: 640px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: $color-bg-primary;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E"),
    radial-gradient(900px 480px at 50% 30%, $color-gold-glow, transparent 70%),
    radial-gradient(860px 520px at 14% 84%, rgba($color-bg-elevated, 0.5), transparent 66%),
    radial-gradient(860px 520px at 88% 18%, rgba($color-bg-card, 0.45), transparent 66%),
    radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba($color-bg-deep, 0.55) 100%),
    linear-gradient(180deg, $color-bg-primary 0%, $color-bg-card 58%, $color-bg-deep 100%);

  // 数字人面板对齐锚点：顶与图谱区上沿平齐、底与图谱区下沿平齐
  // （面板为 fixed 定位且是 .graph-hero 的 DOM 子节点，CSS 变量可沿树继承）
  --title-zone: 168px;
  --dh-top: calc(64px + var(--title-zone));
  --dh-bottom: 12px;
}

/* ── 上：书法标题区（收紧高度，垂直居中，留白呼吸） ── */
.hero-title-block {
  height: var(--title-zone);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: 10px;
  pointer-events: none;
  user-select: none;
  animation: hero-breathe 7s ease-in-out infinite;
}

@keyframes hero-breathe {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

/* 书法主标题：马善政毛笔楷书 · 淡金（深底上最华贵的对比） */
.hero-title {
  font-family: $font-title;
  font-weight: 400;
  font-size: clamp($font-size-h1, 6.6vw, $font-size-display);
  line-height: 1.18;
  letter-spacing: 14px;
  text-indent: 14px;
  color: $color-accent-gold-pale;
  text-shadow:
    0 2px 0 rgba($color-bg-deep, 0.6),
    0 0 30px rgba($color-accent-gold, 0.32),
    0 18px 44px rgba(0, 0, 0, 0.5);
}

/* 副标题：思源宋体 · 宣纸白 */
.hero-subtitle {
  margin-top: 12px;
  font-family: $font-body;
  font-size: clamp($font-size-body-sm, 1.6vw, $font-size-body-lg);
  letter-spacing: 7px;
  text-indent: 7px;
  color: $color-text-primary;
  text-shadow: 0 1px 0 rgba($color-bg-deep, 0.7);
}

/* ── 中：3D 图谱画布区（标题之下全部剩余空间，紧凑视觉焦点） ── */
.graph-zone {
  position: relative;
  flex: 1;
  min-height: 380px;
  margin: 0 24px 12px;
}

/* ── 移动端 ── */
@media (max-width: 640px) {
  .graph-hero {
    min-height: 560px;
    --title-zone: 132px;
  }

  .hero-title-block {
    padding-bottom: 6px;
  }

  .hero-title {
    letter-spacing: 8px;
    text-indent: 8px;
  }

  .hero-subtitle {
    margin-top: 8px;
    letter-spacing: 4px;
    text-indent: 4px;
  }

  .graph-zone {
    min-height: 320px;
    margin: 0 10px 8px;
  }
}
</style>
