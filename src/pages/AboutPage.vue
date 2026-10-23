<!-- ═══════════════════════════════════════════════════════════
  AboutPage.vue — 关于我们（路由 /about）
  定位：建立信任、传递价值、引导行动的高级叙事页
    · Hero = 真实刺绣大图铺底（img 占位，替换 src 即换图）+ 米黄遮罩
      +「绣美中华」与首页完全一致的书法字体 + 一句真诚的使命 Slogan
    · 分块叙事：我们的故事（痛点 → 介入 → 方案）→ 我们的价值（3 个核心亮点）
      → 项目里程碑（极简时间线）→ 核心团队（五卡一行）→ 联系我们 + CTA
    · 全页无 Emoji；卡片 = rgba(255,252,245,0.6) 毛玻璃 + 极细淡金边线；
      色板/字体与 HomePage.vue 同源
  ═══════════════════════════════════════════════════════════ -->
<template>
  <div class="app-wrapper page-about">
    <Navbar />

    <!-- ── Hero：第一印象 ── -->
    <section class="ab-hero">
      <!-- TODO: 替换为真实高清刺绣纹理 / 绣娘工作场景大图：放入 public/ 后改这一行 src 即可 -->
      <img class="ab-hero-img" src="/gallery/gallery-peony.svg" alt="中国传统刺绣纹样" />
      <div class="ab-hero-veil" aria-hidden="true"></div>

      <div class="ab-hero-inner">
        <h1 class="ab-hero-title">绣美中华</h1>
        <p class="ab-hero-sub">用数字之光，守护千年指尖技艺，让非遗在当代焕发新生。</p>
      </div>
    </section>

    <!-- ── 核心内容区 ── -->
    <main class="ab-main">
      <!-- 我们的故事：痛点 → 介入 → 方案 -->
      <section class="ab-block ab-story">
        <h2 class="ab-block-title">我们的故事</h2>
        <div class="ab-story-body">
          <p>
            在查阅非遗传承的文献与新闻报道时，我们注意到一个普遍的现象：老一辈绣娘坚守着极其繁复的针法，
            而年轻一代虽然对传统文化抱有敬意，却往往因快节奏的生活和无从下手的门槛，
            鲜少有机会真正深入了解。
          </p>
          <p>
            我们是一群计算机与设计专业的学生。2025年，项目获批省级大学生创新创业训练计划立项。
            我们开始思考：在这个数字时代，能否用年轻人熟悉的方式，让非遗刺绣跨越理解的鸿沟？
          </p>
          <p>
            于是有了「智传非遗」。我们用 Live2D 数字人做导览，用大模型与检索增强回答关于刺绣的一切提问，
            用 3D 知识图谱还原纹样背后的世界，把针法拆解成可回放的动画——
            我们希望通过技术手段降低大众的认知门槛，让传承不再只靠言传身教，
            也让世界多一种方式认识中国刺绣。
          </p>
        </div>
      </section>

      <!-- 我们的价值：3 个核心亮点 -->
      <section class="ab-block">
        <h2 class="ab-block-title">我们的价值</h2>
        <div class="ab-value-grid">
          <article v-for="(v, i) in values" :key="i" class="ab-card ab-value">
            <span class="ab-value-index">{{ NUMERALS[i] }}</span>
            <h3 class="ab-value-name">{{ v.title }}</h3>
            <p class="ab-value-text">{{ v.text }}</p>
          </article>
        </div>
      </section>

      <!-- 项目里程碑：极简时间线（可信度证明） -->
      <section class="ab-block">
        <h2 class="ab-block-title">项目里程碑</h2>
        <!-- TODO: 按真实节点校对时间与描述 -->
        <ol class="ab-timeline">
          <li v-for="m in milestones" :key="m.title">
            <span class="ab-tl-dot" aria-hidden="true"></span>
            <time class="ab-tl-date">{{ m.date }}</time>
            <h3 class="ab-tl-title">{{ m.title }}</h3>
            <p class="ab-tl-text">{{ m.desc }}</p>
          </li>
        </ol>
      </section>

      <!-- 核心团队：五卡一行均匀分布，极简无边框 + 悬停浮起 -->
      <section class="ab-block">
        <h2 class="ab-block-title">核心团队</h2>
        <div class="ab-core-grid">
          <article v-for="m in team" :key="m.name" class="ab-core-card">
            <!-- 换真实照片：替换 m.photo 即可（默认国风纹样占位图） -->
            <img class="ab-core-photo" :src="m.photo" :alt="m.name" loading="lazy" />
            <h3 class="ab-core-name">{{ m.name }}</h3>
            <p class="ab-core-role">{{ m.role }}</p>
          </article>
        </div>
      </section>

      <!-- 联系我们 + CTA：引导行动 -->
      <section class="ab-block ab-contact">
        <h2 class="ab-block-title">联系我们</h2>
        <div class="ab-contact-card ab-card">
          <p class="ab-contact-line">
            <!-- TODO: 替换为真实邮箱与账号 -->
            邮箱
            <a href="mailto:contact@zhichuanfeiyi.com">contact@zhichuanfeiyi.com</a>
            <span class="ab-contact-sep" aria-hidden="true"></span>
            项目主页
            <a href="#" rel="noopener">GitHub 仓库</a>
            <span class="ab-contact-sep" aria-hidden="true"></span>
            微信公众号
            <a href="#">智传非遗</a>
          </p>
        </div>

        <div class="ab-cta-wrap">
          <router-link to="/" class="ab-cta-btn">返回首页，体验数字人</router-link>
        </div>
      </section>
    </main>

    <footer class="ab-footer">
      <p class="ab-footer-brand">智传非遗 · 绣美中华</p>
      <p class="ab-footer-note">让千年绣艺，在数字时代继续绽放</p>
    </footer>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import Navbar from '../components/Navbar.vue'
import { guideOnPageEnter } from '../utils/voiceGuide.js'

// 语音引导：首次进入播报「关于我们」页面介绍
onMounted(() => guideOnPageEnter('about'))

const NUMERALS = ['壹', '贰', '叁']

const values = [
  {
    title: '沉浸式体验',
    text: '3D 知识图谱与数字人导览相结合，让用户身临其境地探索刺绣文化，而非被动浏览图文。',
  },
  {
    title: '多语言桥梁',
    text: '数字人支持多语言交互，让中国非遗跨越语言边界，被世界听见、看懂、喜爱。',
  },
  {
    title: '技术赋能',
    text: '运用大模型与 RAG 检索增强技术，提供专业、生动、可信的非遗知识问答。',
  },
]

const milestones = [
  { date: '2025.05', title: '省级大创立项', desc: '项目获批省级大学生创新创业训练计划立项。' },
  { date: '2025.11', title: '数字人 1.0 上线', desc: '「绫韵」Live2D 数字人完成形象建模，支持语音播报与知识问答。' },
  { date: '2026.04', title: '3D 知识图谱上线', desc: '星图式知识图谱支持 2D / 3D 双模式探索，串联刺绣流派与纹样文化。' },
  { date: '2026.10', title: '全平台整合', desc: '首页、纹样共创、个人中心等模块贯通，迎接省级项目答辩。' },
]

// TODO: 校正每位成员的分工；换真实照片时替换 photo 路径
const team = [
  { name: '李玲', role: '项目负责人 · 前端开发', photo: '/team/avatar.svg' },
  { name: '陈泽恩', role: '算法实现 · 知识图谱', photo: '/team/avatar.svg' },
  { name: '熊帆', role: '数字人技术 · 大模型应用', photo: '/team/avatar.svg' },
  { name: '高境', role: '内容策划 · 交互设计', photo: '/team/avatar.svg' },
  { name: '黄程金', role: '三维视觉 · 非遗研究', photo: '/team/avatar.svg' },
]
</script>

<style scoped>
/* ── 页面基调：与首页完全一致的宣纸米黄渐变 + 顶部金色光晕 ── */
.page-about {
  /* 色板与 HomePage.vue 同源：朱砂 / 墨棕 / 茶褐 / 金 */
  --cinnabar: #c0392b;
  --ink: #3d2a1a;
  --ink-soft: #4a3a2a;
  --tea: #8a7357;
  --gold: rgba(201, 152, 74, 0.75);
  --hairline: rgba(160, 122, 74, 0.22);

  display: block;
  min-height: 100vh;
  overflow-x: hidden;
  background:
    radial-gradient(1200px 600px at 50% -8%, rgba(201, 152, 74, 0.16), transparent 62%),
    linear-gradient(180deg, #faf6ef 0%, #f6eedd 46%, #efe3c8 100%);
}

/* ═══ Hero ═══ */
.ab-hero {
  position: relative;
  min-height: min(46vh, 480px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* 大图：铺满 + 居中裁剪 */
.ab-hero-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

/* 与首页一致的米黄色半透明遮罩，保证文字清晰 */
.ab-hero-veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(250, 246, 239, 0.42) 0%,
    rgba(250, 246, 239, 0.66) 70%,
    rgba(250, 246, 239, 0.92) 100%
  );
}

.ab-hero-inner {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 32px 24px;
}

/* 主标题：与首页 hero-title 完全一致的书法字体栈 */
.ab-hero-title {
  margin: 0 0 22px;
  font-family: 'STXingkai', 'Xingkai SC', 'FZShuTi', 'Ma Shan Zheng', 'STKaiti', 'KaiTi', cursive;
  font-weight: 400;
  font-size: clamp(56px, 7.5vw, 108px);
  line-height: 1.15;
  letter-spacing: 8px;
  background: linear-gradient(180deg, #c0392b, #922b21);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 2px 10px rgba(146, 43, 33, 0.18));
}

/* Slogan：宋体 + 拉宽字距，一句真诚的使命陈述 */
.ab-hero-sub {
  margin: 0 auto;
  max-width: 760px;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', serif;
  font-size: 16px;
  letter-spacing: 5px;
  line-height: 2;
  color: var(--ink);
}

/* ═══ 内容容器：分块 + 充足留白（padding 40px 0）═══ */
.ab-main {
  position: relative;
  max-width: min(1160px, 90vw);
  margin: 0 auto;
  padding: 8px 0 0;
}

.ab-block {
  padding: 40px 0;
}

/* 块间以极细线分隔，增加版面秩序感 */
.ab-block + .ab-block {
  border-top: 1px solid var(--hairline);
}

/* 章节标题：宋体加粗 + 朱砂红左竖线 */
.ab-block-title {
  margin: 0 0 28px;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', serif;
  font-weight: 700;
  font-size: 22px;
  line-height: 1.4;
  color: var(--ink);
  border-left: 3px solid var(--cinnabar);
  padding-left: 12px;
}

/* ── 我们的故事：舒适阅读行宽、居中铺开（修复左侧挤压、右侧留白） ── */
.ab-story-body {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.ab-story-body p {
  margin: 0 0 18px;
  font-size: 15.5px;
  line-height: 2;
  color: var(--ink-soft);
  text-align: justify;
}

.ab-story-body p:last-child {
  margin-bottom: 0;
}

/* ═══ 毛玻璃卡片（全页统一） ═══ */
.ab-card {
  background: rgba(255, 252, 245, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--hairline);
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 10px 30px rgba(92, 61, 32, 0.05);
}

/* ── 我们的价值：三亮点 ── */
.ab-value-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 28px;
}

.ab-value {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ab-value-index {
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', serif;
  font-size: 22px;
  line-height: 1;
  color: var(--cinnabar);
}

.ab-value-name {
  margin: 6px 0 0;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', serif;
  font-weight: 700;
  font-size: 18px;
  color: var(--ink);
}

.ab-value-text {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.8;
  color: var(--ink-soft);
}

/* ── 项目里程碑：极简时间线 ── */
.ab-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 28px;
  position: relative;
}

/* 贯穿的金色细线 */
.ab-timeline::before {
  content: '';
  position: absolute;
  top: 6px;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold), transparent);
}

.ab-timeline li {
  position: relative;
  padding-top: 34px;
}

.ab-tl-dot {
  position: absolute;
  top: 0;
  left: 0;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: #faf6ef;
  border: 3px solid var(--cinnabar);
  box-shadow: 0 0 0 4px rgba(192, 57, 43, 0.1);
}

.ab-tl-date {
  display: block;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', serif;
  font-size: 13px;
  letter-spacing: 2px;
  color: var(--cinnabar);
  margin-bottom: 8px;
}

.ab-tl-title {
  margin: 0 0 8px;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', serif;
  font-weight: 700;
  font-size: 16px;
  color: var(--ink);
}

.ab-tl-text {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.8;
  color: var(--tea);
}

/* ── 核心团队：五卡一行均匀分布，极简无边框 + 悬停浮起 ── */
.ab-core-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20px;
}

.ab-core-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 30px 14px 26px;
  border-radius: 16px;
  background: rgba(255, 252, 245, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 6px 18px rgba(92, 61, 32, 0.05);
  transition: transform 0.25s, box-shadow 0.25s;
}

.ab-core-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 14px 30px rgba(92, 61, 32, 0.12);
}

.ab-core-photo {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  background: #f3e7cd;
  border: 1px solid var(--gold);
  margin-bottom: 14px;
}

.ab-core-name {
  margin: 0 0 6px;
  font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', serif;
  font-weight: 700;
  font-size: 16px;
  color: var(--ink);
}

.ab-core-role {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: #9a8b78;
}

/* ── 联系我们 + CTA ── */
.ab-contact-card {
  text-align: center;
  padding: 28px 32px;
}

.ab-contact-line {
  margin: 0;
  font-size: 15px;
  line-height: 2;
  color: var(--ink-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
}

.ab-contact-line a {
  color: var(--cinnabar);
  text-decoration: none;
  border-bottom: 1px solid rgba(192, 57, 43, 0.3);
  transition: border-color 0.2s;
}

.ab-contact-line a:hover {
  border-bottom-color: var(--cinnabar);
}

.ab-contact-sep {
  width: 1px;
  height: 14px;
  background: var(--hairline);
  margin: 0 8px;
}

/* CTA：与全站按钮统一（朱砂红底白字、胶囊圆角） */
.ab-cta-wrap {
  display: flex;
  justify-content: center;
  margin-top: 36px;
}

.ab-cta-btn {
  display: inline-block;
  background: #c0392b;
  color: #fff;
  text-decoration: none;
  padding: 14px 44px;
  border-radius: 26px;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 2px;
  transition: all 0.25s;
  box-shadow: 0 8px 22px rgba(192, 57, 43, 0.28);
}

.ab-cta-btn:hover {
  background: #a93226;
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(192, 57, 43, 0.34);
}

/* ═══ 页脚 ═══ */
.ab-footer {
  text-align: center;
  padding: 40px 24px 48px;
  border-top: 1px solid var(--hairline);
}

.ab-footer-brand {
  margin: 0 0 8px;
  font-family: 'STXingkai', 'Xingkai SC', 'FZShuTi', 'Ma Shan Zheng', 'STKaiti', 'KaiTi', cursive;
  font-size: 24px;
  letter-spacing: 6px;
  color: var(--ink);
}

.ab-footer-note {
  margin: 0;
  font-size: 13px;
  letter-spacing: 3px;
  color: var(--tea);
}

/* ═══ 响应式 ═══ */
@media (max-width: 960px) {
  .ab-value-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .ab-core-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  /* 时间线转为纵向：金线置于左侧 */
  .ab-timeline {
    grid-template-columns: 1fr;
    gap: 28px;
    padding-left: 24px;
  }

  .ab-timeline::before {
    top: 6px;
    bottom: 6px;
    left: 5px;
    right: auto;
    width: 1px;
    height: auto;
    background: linear-gradient(180deg, transparent, var(--gold), transparent);
  }

  .ab-timeline li {
    padding-top: 0;
  }

  .ab-tl-dot {
    left: -24px;
    top: 5px;
  }

  .ab-hero-sub {
    letter-spacing: 3px;
  }
}

@media (max-width: 560px) {
  .ab-value-grid {
    grid-template-columns: 1fr;
  }

  .ab-core-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .ab-hero-title {
    letter-spacing: 4px;
  }

  .ab-hero {
    min-height: 40vh;
  }
}
</style>
