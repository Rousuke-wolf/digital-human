<!-- ═══════════════════════════════════════════════════════
  EmbroideryDrawer.vue — 绣法详情抽屉（右侧滑出，叙事入口）
  结构：绣法名 + 文化定位（书法体）→ 五信息块（线性国风图标 + 短文本）
        起源介绍 / 传承人物 / 核心针法 / 代表作品 / 视频鉴赏（B站嵌入）
       → 底部「与传承人对话」按钮（唤起数字人专属讲解）
  props: open(Boolean) / node(Object)（图谱节点数据）
  emits: close / talk(node)（与传承人对话）
═══════════════════════════════════════════════════════ -->
<template>
  <Teleport to="body">
    <!-- 遮罩 -->
    <Transition name="drawer-fade">
      <div v-if="open" class="ed-mask" @click="emit('close')"></div>
    </Transition>

    <!-- 右侧滑出抽屉（深黛绿玻璃质感） -->
    <Transition name="drawer-slide">
      <aside v-if="open" class="ed-drawer">
        <button class="ed-close" title="关闭" @click="emit('close')">✕</button>

        <div v-if="node" class="ed-body">
          <!-- 顶部：绣法名 + 文化定位（大字号书法体） -->
          <header class="ed-head">
            <span class="ed-group-chip" :style="{ background: nodeColor }">{{ node.group }}</span>
            <h2 class="ed-title">{{ node.name }}</h2>
            <p v-if="localizedName && localizedName !== node.name" class="ed-name-locale">{{ localizedName }}</p>
            <p class="ed-slogan">「 {{ node.slogan }} 」</p>
          </header>

          <!-- 五信息块：线性国风图标 + 短文本 -->
          <section class="ed-section">
            <h3 class="ed-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              起源介绍
            </h3>
            <p class="ed-text">{{ briefHistory }}</p>
          </section>

          <section class="ed-section">
            <h3 class="ed-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="9" cy="7" r="3"></circle>
                <path d="M2.5 21c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"></path>
                <circle cx="17" cy="9" r="2.4"></circle>
                <path d="M15.5 15.8c2.8.3 6 2.2 6 5.2"></path>
              </svg>
              传承人物
            </h3>
            <div v-for="f in node.figures.slice(0, 2)" :key="f.name" class="ed-figure">
              <span class="ed-avatar" :style="{ background: nodeColor }">{{ f.name[0] }}</span>
              <div class="ed-figure-info">
                <b>{{ f.name }}</b>
                <p>{{ f.title }}</p>
              </div>
            </div>
            <p v-if="node.figures.length > 2" class="ed-more-hint">另有 {{ node.figures.length - 2 }} 位传承人收录于完整档案</p>
          </section>

          <section class="ed-section">
            <h3 class="ed-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 4L4.5 19.5"></path>
                <path d="M20 4c0 2-2.2 3.2-3.4 3.4"></path>
              </svg>
              核心针法
            </h3>
            <ul class="ed-stitch-list">
              <li v-for="(f, i) in node.features.slice(0, 3)" :key="i">{{ f }}</li>
            </ul>
          </section>

          <section class="ed-section">
            <h3 class="ed-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"></path>
                <path d="M3 8l9 5 9-5"></path>
                <path d="M12 13v8"></path>
              </svg>
              代表作品
            </h3>
            <div v-for="w in works" :key="w.name" class="ed-work">
              <b>{{ w.name }}</b>
              <p>{{ w.desc }}</p>
            </div>
          </section>

          <!-- 视频鉴赏（B站官方 iframe 嵌入 + 加载失败兜底外链） -->
          <section v-if="video" class="ed-section">
            <h3 class="ed-section-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"></circle>
                <path d="M10 8.5l5.5 3.5-5.5 3.5z"></path>
              </svg>
              视频鉴赏
            </h3>
            <BilibiliPlayer :bvid="video.bvid" :title="video.title" />
          </section>

          <!-- 底部：与传承人对话（唤起数字人专属讲解） -->
          <footer class="ed-foot">
            <button class="ed-talk-btn" @click="emit('talk', node)">
              <span class="ed-talk-icon">🗣️</span>
              <span>与传承人对话</span>
              <span class="ed-talk-arrow">→</span>
            </button>
            <router-link :to="`/detail/${node.id}`" class="ed-more">查看完整档案 →</router-link>
          </footer>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, watch, onBeforeUnmount } from 'vue'
import BilibiliPlayer from './BilibiliPlayer.vue'
import { groupColor } from '../data/embroideryData'
import { EMBROIDERY_WORKS } from '../data/embroideryWorks'
import { getBilibiliVideo } from '../data/bilibiliVideos'
import { useLocale } from '../composables/useLocale'

const props = defineProps({
  open: { type: Boolean, default: false },
  node: { type: Object, default: null },
})

const emit = defineEmits(['close', 'talk'])

const { locale, nodeName } = useLocale()

const nodeColor = computed(() => (props.node ? groupColor(props.node.group) : '#7c3a30'))
const works = computed(() => (props.node ? EMBROIDERY_WORKS[props.node.id] || [] : []))
const video = computed(() => (props.node ? getBilibiliVideo(props.node.id) : null))
const localizedName = computed(() => (props.node ? nodeName(props.node) : ''))

// 起源介绍：历史首段截断为短文本（避免大段文字，完整内容在 /detail 页）
const briefHistory = computed(() => {
  if (!props.node?.history) return ''
  const first = props.node.history.split('\n')[0]
  return first.length > 96 ? first.slice(0, 96) + '……' : first
})

/* ── 打开时锁定页面滚动 + Esc 关闭 ── */
let onKey = null

watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (open && !onKey) {
      onKey = (e) => {
        if (e.key === 'Escape') emit('close')
      }
      document.addEventListener('keydown', onKey)
    } else if (!open && onKey) {
      document.removeEventListener('keydown', onKey)
      onKey = null
    }
  }
)

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  if (onKey) document.removeEventListener('keydown', onKey)
})
</script>

<style scoped lang="scss">
@use '../styles/variables.scss' as *;

/* ── 遮罩 ── */
.ed-mask {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba($color-bg-deep, 0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

/* ── 抽屉主体：深黛绿玻璃 ── */
.ed-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  width: min(430px, 92vw);
  background: rgba($color-bg-deep, 0.92);
  border-left: 1px solid $color-glass-border;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: -24px 0 60px rgba(0, 0, 0, 0.5);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: $color-bg-elevated transparent;
}

.ed-close {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid $color-glass-border;
  background: rgba($color-bg-elevated, 0.7);
  color: $color-text-secondary;
  font-size: $font-size-body;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    color: $color-accent-gold-pale;
    border-color: $color-accent-gold;
  }
}

.ed-body {
  padding: 36px 30px 30px;
}

/* ── 顶部：文化定位 ── */
.ed-head {
  text-align: center;
  margin-bottom: 26px;
}

.ed-group-chip {
  display: inline-block;
  padding: 3px 14px;
  border-radius: 999px;
  color: $color-text-primary;
  font-size: $font-size-caption;
  letter-spacing: 3px;
}

.ed-title {
  margin-top: 12px;
  font-family: $font-title;
  font-weight: 400;
  font-size: calc($font-size-h1 * 1.35);
  letter-spacing: 8px;
  text-indent: 8px;
  color: $color-accent-gold-pale;
  text-shadow: 0 0 26px rgba($color-accent-gold-pale, 0.35);
}

.ed-name-locale {
  margin-top: 4px;
  font-size: $font-size-body-sm;
  letter-spacing: 2px;
  color: $color-text-secondary;
}

.ed-slogan {
  margin-top: 12px;
  font-family: $font-deco;
  font-size: $font-size-body-lg;
  letter-spacing: 3px;
  color: $color-text-primary;
  line-height: 1.7;
}

/* ── 五信息块 ── */
.ed-section {
  margin-bottom: 20px;
  padding: 16px 18px;
  border-radius: 16px;
  background: rgba($color-bg-elevated, 0.45);
  border: 1px solid $color-gold-faint;
}

.ed-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: $font-size-body;
  font-weight: 700;
  letter-spacing: 2px;
  color: $color-accent-gold-pale;
  margin-bottom: 10px;

  svg {
    width: 17px;
    height: 17px;
    opacity: 0.9;
  }
}

.ed-text {
  font-size: $font-size-body-sm;
  color: $color-text-primary;
  line-height: 1.9;
}

/* 传承人物 */
.ed-figure {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;

  &:last-of-type {
    margin-bottom: 0;
  }
}

.ed-avatar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  color: $color-text-primary;
  font-family: $font-title;
  font-size: $font-size-h3;
}

.ed-figure-info b {
  display: block;
  font-size: $font-size-body-sm;
  color: $color-text-primary;
}

.ed-figure-info p {
  margin-top: 2px;
  font-size: $font-size-caption;
  color: $color-text-secondary;
  line-height: 1.6;
}

.ed-more-hint {
  margin-top: 8px;
  font-size: $font-size-tiny;
  color: $color-text-secondary;
  letter-spacing: 1px;
}

/* 核心针法 */
.ed-stitch-list {
  list-style: none;
}

.ed-stitch-list li {
  position: relative;
  padding: 4px 0 4px 18px;
  font-size: $font-size-body-sm;
  color: $color-text-primary;
  line-height: 1.7;

  &::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 12px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: $color-accent-gold;
  }
}

/* 代表作品 */
.ed-work {
  margin-bottom: 10px;

  &:last-child {
    margin-bottom: 0;
  }

  b {
    font-size: $font-size-body-sm;
    color: $color-accent-gold-pale;
  }

  p {
    margin-top: 2px;
    font-size: $font-size-caption;
    color: $color-text-secondary;
    line-height: 1.6;
  }
}

/* ── 底部：与传承人对话 ── */
.ed-foot {
  margin-top: 24px;
  text-align: center;
}

.ed-talk-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px 20px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, $color-accent-gold, $color-accent-gold-deep);
  color: $color-bg-deep;
  font-size: $font-size-body;
  font-weight: 700;
  letter-spacing: 3px;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba($color-accent-gold-pale, 0.3);
  transition: all 0.25s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 36px rgba($color-accent-gold-pale, 0.42);
  }
}

.ed-talk-icon {
  font-size: $font-size-h3;
}

.ed-talk-arrow {
  font-size: $font-size-h3;
}

.ed-more {
  display: inline-block;
  margin-top: 14px;
  font-size: $font-size-caption;
  color: $color-text-secondary;
  text-decoration: none;
  letter-spacing: 2px;
  transition: color 0.2s;

  &:hover {
    color: $color-accent-gold-pale;
  }
}

/* ── 过渡动画 ── */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.3s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.38s cubic-bezier(0.32, 0.72, 0.24, 1);
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}
</style>
