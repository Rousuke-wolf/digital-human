<!-- ═══════════════════════════════════════════════════════════
  HomePage.vue — 首页（路由 / 实际挂载的主页）
  布局：博物馆数字展厅式「上半屏主视觉 + 下半屏图文双栏」
    上：主视觉 —— 巨型书法标题「绣美中华」（Ma Shan Zheng）居中，
        副标题一句话；与内容区之间以金色渐变过渡带衔接
    下：左图右讯 —— CSS Grid 强制 3fr/2fr（约 60%/40%）双栏，居中限宽 1200px
        左「经典绣坊图鉴」：Swiper 轮播 + vue-easy-lightbox 灯箱，
            **硬性限高 min(400px, 42vh)**，图片 object-fit: cover 填满不变形
        右「非遗刺绣前沿资讯」：白卡 + 资讯列表，
            **同高限高，列表 overflow-y: auto 内部滚动**
  主题：宣纸米黄底 × 朱砂红 × 墨黑（与全站 style.css 一致）
  ═══════════════════════════════════════════════════════════ -->
<template>
  <div class="app-wrapper page-home">
    <Navbar />

    <!-- ── 上：主视觉区 ── -->
    <section class="hero">
      <!-- 巨型水印「绣」字：博物馆氛围背景（低透明度，不干扰主标题） -->
      <div class="hero-watermark" aria-hidden="true">绣</div>

      <h1 class="hero-title">绣美中华</h1>
      <p class="hero-subtitle">以数字之光，传承千年绣艺</p>

      <!-- 主视觉 → 内容区的柔和渐变过渡带（金色细线 + 菱形饰） -->
      <div class="hero-fade" aria-hidden="true">
        <span class="hero-fade-line"></span>
        <span class="hero-fade-orn">◆</span>
        <span class="hero-fade-line"></span>
      </div>
    </section>

    <!-- ── 下：左图右讯双栏（Grid 强制分栏，双卡等高） ── -->
    <section class="home-content">
      <div class="content-grid">
        <!-- 左栏：经典绣坊图鉴（Swiper 轮播 + 灯箱放大） -->
        <article class="panel gallery-panel">
          <header class="panel-head">
            <h2 class="panel-title">经典绣坊图鉴</h2>
            <p class="panel-sub">指尖上的东方美学 · 点击图片细赏</p>
          </header>

          <Swiper
            class="gallery-swiper"
            :modules="modules"
            :loop="true"
            :space-between="16"
            :speed="600"
            :grab-cursor="true"
            :navigation="true"
            :pagination="{ clickable: true }"
            :autoplay="{ delay: 4500, disableOnInteraction: false, pauseOnMouseEnter: true }"
            @swiper="onSwiper"
          >
            <SwiperSlide v-for="(img, i) in gallery" :key="i">
              <figure class="gallery-item" @click="openLightbox">
                <img :src="img.src" :alt="img.caption" loading="lazy" />
                <figcaption class="gallery-caption">
                  <span class="gallery-caption-text">{{ img.caption }}</span>
                  <span class="gallery-zoom-hint">🔍 点击放大</span>
                </figcaption>
              </figure>
            </SwiperSlide>
          </Swiper>
        </article>

        <!-- 右栏：非遗刺绣前沿资讯（列表必须渲染，超高内部滚动） -->
        <article class="panel news-panel">
          <header class="panel-head">
            <h2 class="panel-title">非遗刺绣前沿资讯</h2>
            <p class="panel-sub">每日精选 · 织就时代新声</p>
          </header>

          <ul class="news-list">
            <li v-for="item in newsList" :key="item.id" class="news-item">
              <a
                class="news-link"
                :href="item.url"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span class="news-title">{{ item.title }}</span>
                <time class="news-date" :datetime="item.date">{{ item.date }}</time>
              </a>
            </li>
          </ul>

          <p v-if="newsLoading && !newsList.length" class="news-loading">资讯加载中…</p>
          <a
            class="news-more"
            href="https://www.baidu.com/s?wd=%E9%9D%9E%E9%81%97%E5%88%BA%E7%BB%A3%E8%B5%84%E8%AE%AF"
            target="_blank"
            rel="noopener noreferrer"
          >
            查看全部资讯 <span aria-hidden="true">→</span>
          </a>
        </article>
      </div>
    </section>

    <!-- 灯箱：点击轮播图后平滑放大查看细节 -->
    <vue-easy-lightbox
      :visible="lightboxVisible"
      :imgs="gallerySrcs"
      :index="lightboxIndex"
      @hide="lightboxVisible = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Navbar from '../components/Navbar.vue'

/* ── Swiper 轮播 + vue-easy-lightbox 灯箱 ── */
import { Swiper, SwiperSlide } from 'swiper/vue'
import { Navigation, Pagination, Autoplay } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import VueEasyLightbox from 'vue-easy-lightbox'
import 'vue-easy-lightbox/external-css/vue-easy-lightbox.css'

const modules = [Navigation, Pagination, Autoplay]

/* ── 经典绣坊图鉴 ──
 * 数据源：GET /api/gallery（server/routes/gallery.js，最多 5 张 { id, url, title }）
 * 后端不可用时回退本地 SVG 纹样图，保证轮播始终有内容
 */
const DEFAULT_GALLERY = [
  { src: '/gallery/gallery-peony.svg', caption: '苏绣 · 牡丹团花' },
  { src: '/gallery/gallery-lotus.svg', caption: '湘绣 · 金线荷塘' },
  { src: '/gallery/gallery-cloud.svg', caption: '京绣 · 祥云瑞气' },
  { src: '/gallery/gallery-koi.svg', caption: '蜀绣 · 芙蓉锦鲤' },
  { src: '/gallery/gallery-butterfly.svg', caption: '苗绣 · 蝴蝶妈妈' },
]
const gallery = ref(DEFAULT_GALLERY)
const gallerySrcs = ref(DEFAULT_GALLERY.map((g) => g.src))

/** 从后端拉取图鉴列表（最多 5 张），失败时保留本地默认纹样图 */
async function fetchGallery() {
  try {
    const res = await fetch('/api/gallery')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const list = await res.json()
    if (Array.isArray(list) && list.length > 0) {
      gallery.value = list.map((g) => ({ src: g.url, caption: g.title ?? '绣品图鉴' }))
      gallerySrcs.value = gallery.value.map((g) => g.src)
    }
  } catch (err) {
    console.warn('[gallery] 后端图鉴不可用，使用本地默认纹样图:', err.message)
  }
}

/* ── 灯箱状态：loop 模式下用 Swiper 实例的 realIndex 取真实序号 ── */
const swiperRef = ref(null)
const lightboxVisible = ref(false)
const lightboxIndex = ref(0)

function onSwiper(swiper) {
  swiperRef.value = swiper
}

function openLightbox() {
  lightboxIndex.value = swiperRef.value?.realIndex ?? 0
  lightboxVisible.value = true
}

/* ── 非遗刺绣前沿资讯 ──
 * 数据源：GET /api/news（server/utils/newsFetcher.js 写入 server/data/news.json）
 * 每条含 { id, title, date, url }，整行点击新标签页打开 url
 */
const newsLoading = ref(false)

/* 前端兜底 Mock（初始值直接渲染，保证首屏列表可见；后端可用时被接口数据覆盖） */
const DEFAULT_NEWS = [
  {
    id: 1,
    title: '苏绣国家级传承人新作亮相中国工艺美术馆',
    date: '2026-10-18',
    url: 'https://www.baidu.com/s?wd=%E8%8B%8F%E7%BB%A3%E5%9B%BD%E5%AE%B6%E7%BA%A7%E4%BC%A0%E6%89%BF%E4%BA%BA%E6%96%B0%E4%BD%9C',
  },
  {
    id: 2,
    title: '数字技术助力湘绣焕发新生：AI 辅助纹样设计走进课堂',
    date: '2026-10-12',
    url: 'https://www.baidu.com/s?wd=%E6%95%B0%E5%AD%97%E6%8A%80%E6%9C%AF%E5%8A%A9%E5%8A%9B%E6%B9%98%E7%BB%A3%E7%84%95%E5%8F%91%E6%96%B0%E7%94%9F',
  },
  {
    id: 3,
    title: '蜀绣双面异色绣《芙蓉锦鲤》获国际手工艺展金奖',
    date: '2026-10-05',
    url: 'https://www.baidu.com/s?wd=%E8%9C%80%E7%BB%A3%E5%8F%8C%E9%9D%A2%E5%BC%82%E8%89%B2%E7%BB%A3%E8%8A%99%E8%93%89%E9%94%A6%E9%B2%A4',
  },
  {
    id: 4,
    title: '粤绣龙凤褂登上巴黎高定秀场，岭南针法惊艳世界',
    date: '2026-09-28',
    url: 'https://www.baidu.com/s?wd=%E7%B2%A4%E7%BB%A3%E9%BE%99%E5%87%A4%E8%A4%82%E5%B7%B4%E9%BB%8E%E9%AB%98%E5%AE%9A%E7%A7%80%E5%9C%BA',
  },
  {
    id: 5,
    title: '苗绣纹样数字化工程启动：千年图腾进入元宇宙展厅',
    date: '2026-09-20',
    url: 'https://www.baidu.com/s?wd=%E8%8B%97%E7%BB%A3%E7%BA%B9%E6%A0%B7%E6%95%B0%E5%AD%97%E5%8C%96%E5%B7%A5%E7%A8%8B',
  },
]
const newsList = ref(DEFAULT_NEWS)

/** 从后端拉取最新资讯（GET /api/news），失败时保留前端 Mock */
async function fetchLatestNews() {
  newsLoading.value = true
  try {
    const res = await fetch('/api/news')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const list = await res.json()
    if (Array.isArray(list) && list.length > 0) {
      newsList.value = list
    }
  } catch (err) {
    console.warn('[news] 后端资讯不可用，使用本地 Mock:', err.message)
  } finally {
    newsLoading.value = false
  }
}

onMounted(() => {
  fetchGallery()
  fetchLatestNews()
})
</script>

<style scoped>
/* ── 页面基调：宣纸米黄 + 顶部金色光晕 ── */
.page-home {
  display: block;
  min-height: 100vh;
  overflow-x: hidden;
  background:
    radial-gradient(1200px 600px at 50% -8%, rgba(201, 152, 74, 0.16), transparent 62%),
    linear-gradient(180deg, #faf6ef 0%, #f6eedd 46%, #efe3c8 100%);
}

/* ═══ 上：主视觉（收紧高度，把空间让给下方双栏） ═══ */
.hero {
  position: relative;
  min-height: 30vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 24px 56px;
  user-select: none;
}

/* 巨型水印「绣」字：透明度已调低，不干扰主标题阅读 */
.hero-watermark {
  position: absolute;
  left: 50%;
  top: 58%;
  transform: translate(-50%, -50%);
  font-family: 'STXingkai', 'Xingkai SC', 'FZShuTi', 'Ma Shan Zheng', 'KaiTi', serif;
  font-size: min(34vw, 440px);
  line-height: 1;
  color: rgba(192, 57, 43, 0.035);
  pointer-events: none;
  z-index: 0;
}

.hero-title {
  position: relative;
  z-index: 1;
  margin: 4vh 0 0; /* 整体下移，落在页面视觉中心 */
  /* 飘逸书法字体：华文行楷（Windows 自带，行楷最飘逸）→ 方正舒体 → 马善政 */
  font-family: 'STXingkai', 'Xingkai SC', 'FZShuTi', 'Ma Shan Zheng', 'STKaiti', 'KaiTi', cursive;
  font-weight: 400;
  font-size: clamp(64px, 8.5vw, 140px);
  line-height: 1.12;
  letter-spacing: 0.08em;
  text-indent: 0.08em;
  color: #3d1f0a;
  text-shadow:
    0 2px 0 rgba(250, 246, 239, 0.9),
    0 14px 44px rgba(61, 31, 10, 0.18);
  animation: title-in 0.9s ease-out both;
}

@keyframes title-in {
  from {
    opacity: 0;
    transform: translateY(26px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hero-subtitle {
  position: relative;
  z-index: 1;
  margin: 10px 0 0; /* 收紧与标题、分割线的间距 */
  font-size: clamp(15px, 1.5vw, 19px);
  letter-spacing: 0.5em;
  text-indent: 0.5em;
  color: #6b4226;
}

/* 主视觉 → 内容区渐变过渡带 */
.hero-fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  z-index: 2;
  background: linear-gradient(180deg, transparent, #f6eedd 82%);
}

.hero-fade-line {
  width: min(320px, 28vw);
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(201, 152, 74, 0.75));
}

.hero-fade-line:last-child {
  background: linear-gradient(270deg, transparent, rgba(201, 152, 74, 0.75));
}

.hero-fade-orn {
  color: #c0392b;
  font-size: 12px;
  line-height: 1;
}

/* ═══ 下：左图右讯双栏（与主视觉间距收紧，保证一屏展示完整） ═══ */
.home-content {
  position: relative;
  margin-top: 8px;
  padding: 4px clamp(16px, 4vw, 48px) 40px;
}

/* 双栏后方的柔和色晕 */
.home-content::before,
.home-content::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  pointer-events: none;
  z-index: 0;
}

.home-content::before {
  width: 380px;
  height: 380px;
  right: 5%;
  top: 10%;
  background: radial-gradient(circle, rgba(192, 57, 43, 0.14), transparent 70%);
}

.home-content::after {
  width: 460px;
  height: 460px;
  left: 3%;
  bottom: -10%;
  background: radial-gradient(circle, rgba(201, 152, 74, 0.2), transparent 70%);
}

/* 强制双栏：3fr/2fr（约 60%/40%）；minmax(0,…) 防止子内容撑爆列宽 */
.content-grid {
  position: relative;
  z-index: 1;
  /* 自适应宽度：整体略收窄，观感更紧凑精致（1400/92vw → 1240/90vw） */
  max-width: min(1240px, 90vw);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 24px;
  /* 双卡等高：视觉整齐 */
  align-items: stretch;
  /* 双卡统一硬限高：加高到 470px，图鉴更舒展、资讯列表更从容；
     1080p 一屏仍完整放得下，矮屏自动收缩 */
  --card-h: min(470px, 48vh);
}

/* ── 卡片通用：白色半透明底 + 20px 圆角 + 极柔软阴影 + 24px 内边距 ── */
.panel {
  display: flex;
  flex-direction: column;
  height: var(--card-h);
  min-height: 0;
  border-radius: 20px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(201, 152, 74, 0.32);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
}

.panel-head {
  flex-shrink: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px dashed rgba(201, 152, 74, 0.45);
}

.panel-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #3d1f0a;
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 国风竖线装饰：朱砂红 */
.panel-title::before {
  content: '';
  width: 4px;
  height: 18px;
  border-radius: 2px;
  background: linear-gradient(180deg, #c0392b, #922b21);
  flex-shrink: 0;
}

.panel-sub {
  margin: 0;
  font-size: 12.5px;
  color: #9a7d64;
  letter-spacing: 1px;
  white-space: nowrap;
}

/* ── 左栏：图鉴轮播（硬限高 + object-fit: cover） ── */
.gallery-swiper {
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  padding-bottom: 30px; /* 底部留给分页器 */
}

/* 双保险：即使 Swiper 基础样式加载异常，也强制横向单行 + 撑满高度 */
.gallery-swiper :deep(.swiper-wrapper) {
  display: flex;
  height: 100%;
}

.gallery-swiper :deep(.swiper-slide) {
  display: block;
  width: 100%;
  height: 100%;
  flex-shrink: 0;
}

.gallery-item {
  position: relative;
  margin: 0;
  width: 100%;
  height: 100%;
  border-radius: 16px;
  overflow: hidden;
  cursor: zoom-in;
  box-shadow: 0 6px 18px rgba(61, 31, 10, 0.12);
  background: #f3e9d2;
}

.gallery-item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover; /* 填满容器且不变形 */
  transition: transform 0.5s ease;
}

.gallery-item:hover img {
  transform: scale(1.03);
}

.gallery-caption {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 16px 12px;
  background: linear-gradient(180deg, transparent, rgba(61, 31, 10, 0.72));
  color: #f8f1e1;
  font-size: 14px;
  letter-spacing: 1px;
}

.gallery-zoom-hint {
  font-size: 12px;
  padding: 4px 10px;
  border: 1px solid rgba(248, 241, 225, 0.5);
  border-radius: 20px;
  opacity: 0;
  transform: translateY(4px);
  transition: all 0.3s;
}

.gallery-item:hover .gallery-zoom-hint {
  opacity: 1;
  transform: translateY(0);
}

/* Swiper 控件换装：墨底圆钮 → 悬停朱砂，分页器金色长条 */
.gallery-swiper :deep(.swiper-button-next),
.gallery-swiper :deep(.swiper-button-prev) {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(61, 31, 10, 0.55);
  color: #f8f1e1;
  transition: background 0.25s;
}

.gallery-swiper :deep(.swiper-button-next:hover),
.gallery-swiper :deep(.swiper-button-prev:hover) {
  background: #c0392b;
}

.gallery-swiper :deep(.swiper-button-next::after),
.gallery-swiper :deep(.swiper-button-prev::after) {
  font-size: 15px;
}

.gallery-swiper :deep(.swiper-pagination-bullet) {
  width: 8px;
  height: 8px;
  opacity: 1;
  background: #d8c29a;
}

.gallery-swiper :deep(.swiper-pagination-bullet-active) {
  width: 22px;
  border-radius: 4px;
  background: #c0392b;
}

/* ── 右栏：前沿资讯（同高卡片，列表内部滚动） ── */
.news-list {
  list-style: none;
  margin: 0;
  padding: 0 2px 0 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto; /* 内容超高时卡片内部滚动，绝不撑破布局 */
  scrollbar-width: thin;
  scrollbar-color: rgba(201, 152, 74, 0.55) transparent;
}

.news-list::-webkit-scrollbar {
  width: 6px;
}

.news-list::-webkit-scrollbar-thumb {
  background: rgba(201, 152, 74, 0.55);
  border-radius: 3px;
}

.news-item + .news-item {
  border-top: 1px dashed rgba(139, 98, 64, 0.28);
}

.news-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 8px;
  text-decoration: none;
  border-radius: 8px;
  transition: background 0.25s, transform 0.25s;
}

.news-link:hover {
  background: rgba(192, 57, 43, 0.05);
  transform: translateX(4px);
}

.news-title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #5c3d20;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  background: linear-gradient(currentColor, currentColor) no-repeat 0 100% / 0 1px;
  transition: color 0.25s, background-size 0.35s;
}

.news-link:hover .news-title {
  color: #c0392b; /* 悬停：标题变朱砂 + 底部划线渐显 */
  background-size: 100% 1px;
}

.news-date {
  flex-shrink: 0;
  font-size: 12px;
  color: #9a7d64;
  letter-spacing: 0.5px;
  font-variant-numeric: tabular-nums;
}

.news-link:hover .news-date {
  color: #c9984a;
}

.news-loading {
  margin: 0;
  text-align: center;
  color: #9a7d64;
  font-size: 13px;
  padding: 12px 0;
}

.news-more {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-end;
  margin-top: 12px;
  padding: 8px 16px;
  border: 1px solid rgba(192, 57, 43, 0.4);
  border-radius: 20px;
  color: #c0392b;
  font-size: 13px;
  text-decoration: none;
  letter-spacing: 1px;
  transition: all 0.25s;
}

.news-more:hover {
  background: #c0392b;
  color: #fff;
}

/* ── 响应式：仅在真正窄屏（<900px）才降级单栏，1024~1366 窗口保持双栏 ── */
@media (max-width: 900px) {
  .content-grid {
    grid-template-columns: 1fr;
    --card-h: auto;
  }

  .gallery-swiper {
    height: 340px;
    flex: none;
  }

  .news-list {
    max-height: 300px;
  }
}

@media (max-width: 640px) {
  .hero {
    min-height: 26vh;
  }

  .hero-title {
    font-size: 56px;
    letter-spacing: 0.06em;
    text-indent: 0.06em;
  }

  .hero-subtitle {
    letter-spacing: 0.22em;
    text-indent: 0.22em;
  }

  .panel {
    padding: 18px 16px;
  }

  .panel-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}
</style>
