<template>
  <div class="app-wrapper detail-page">
    <Navbar />

    <!-- 正常详情 -->
    <div v-if="node" class="detail-body">
      <div class="detail-top">
        <button class="back-btn" @click="router.push('/')">← 返回首页</button>
        <div class="detail-head">
          <span class="group-chip" :style="{ background: nodeColor, color: '#f2ead8' }">{{ node.group }}</span>
          <h1 class="detail-title">{{ node.name }}</h1>
          <p class="detail-slogan">{{ node.slogan }}</p>
        </div>
      </div>

      <!-- 模块一：历史背景 -->
      <section class="glass-card">
        <div class="card-head">
          <span class="card-icon">📜</span>
          <h2 class="card-title">历史背景</h2>
        </div>
        <p class="history-text">{{ node.history }}</p>
      </section>

      <!-- 模块二：传承人物 -->
      <section class="glass-card">
        <div class="card-head">
          <span class="card-icon">🧑‍🎨</span>
          <h2 class="card-title">传承人物</h2>
        </div>
        <div class="figure-grid">
          <div v-for="f in node.figures" :key="f.name" class="figure-card">
            <div class="figure-avatar" :style="{ background: nodeColor }">{{ f.name[0] }}</div>
            <div class="figure-info">
              <div class="figure-name">{{ f.name }}</div>
              <div class="figure-title">{{ f.title }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- 模块三：相关视频 -->
      <section class="glass-card">
        <div class="card-head">
          <span class="card-icon">🎬</span>
          <h2 class="card-title">相关视频</h2>
        </div>
        <div class="video-grid">
          <template v-for="v in node.videos" :key="v.title">
            <!-- 配置了 BVID 时直接内嵌 B 站播放器 -->
            <div v-if="v.bvid" class="video-embed">
              <iframe
                class="video-frame"
                :src="`https://player.bilibili.com/player.html?bvid=${v.bvid}&page=1&high_quality=1`"
                scrolling="no"
                frameborder="no"
                framespacing="0"
                allowfullscreen="true"
                title="video player"
              ></iframe>
              <div class="video-caption">{{ v.title }}</div>
            </div>
            <!-- 否则展示可跳转的视频卡片 -->
            <a v-else :href="v.url" target="_blank" rel="noopener" class="video-link-card">
              <span class="video-play">▶</span>
              <span class="video-link-main">
                <span class="video-link-title">{{ v.title }}</span>
                <span class="video-link-hint">前往 B 站观看 ↗</span>
              </span>
            </a>
          </template>
        </div>
      </section>

      <!-- 模块四：当前前沿技术 -->
      <section class="glass-card">
        <div class="card-head">
          <span class="card-icon">💡</span>
          <h2 class="card-title">当前前沿技术</h2>
        </div>
        <div class="tech-grid">
          <div v-for="t in node.tech" :key="t" class="tech-chip">
            <span class="tech-dot" :style="{ background: nodeColor }"></span>{{ t }}
          </div>
        </div>
      </section>

      <!-- 相关流派（来自知识图谱连线） -->
      <section v-if="relatedNodes.length" class="glass-card">
        <div class="card-head">
          <span class="card-icon">🕸️</span>
          <h2 class="card-title">相关流派</h2>
        </div>
        <div class="related-row">
          <router-link
            v-for="r in relatedNodes"
            :key="r.id"
            :to="`/detail/${r.id}`"
            class="related-chip"
            :style="{ borderColor: groupColor(r.group), color: groupColor(r.group) }"
          >
            {{ r.name }}
            <span class="related-label">{{ relatedLabel(r.id) }}</span>
          </router-link>
        </div>
      </section>
    </div>

    <!-- 未找到该流派 -->
    <div v-else class="detail-empty">
      <div class="empty-icon">🪡</div>
      <h2 class="empty-title">未找到该刺绣流派</h2>
      <p class="empty-text">链接可能有误，或该流派尚未收录</p>
      <button class="back-btn" @click="router.push('/')">← 返回首页</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Navbar from '../components/Navbar.vue'
import { embroideryNodes, embroideryLinks, groupColor } from '../data/embroideryData'

const route = useRoute()
const router = useRouter()

// 按路由参数匹配节点
const node = computed(() => embroideryNodes.find((n) => n.id === route.params.id))

const nodeColor = computed(() => (node.value ? groupColor(node.value.group) : '#b98a2f'))

// 相关流派：从连线中找出与当前节点相连的其它节点
const related = computed(() => {
  if (!node.value) return []
  return embroideryLinks
    .filter((l) => l.source === node.value.id || l.target === node.value.id)
    .map((l) => ({
      node: embroideryNodes.find((n) => n.id === (l.source === node.value.id ? l.target : l.source)),
      label: l.label,
    }))
    .filter((r) => r.node)
})

const relatedNodes = computed(() => related.value.map((r) => r.node))

function relatedLabel(id) {
  return related.value.find((r) => r.node.id === id)?.label || ''
}
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #1a2f2a 0%, #223c35 55%, #101f1b 100%);
}

.detail-body {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 24px 96px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* ── 顶部：返回 + 标题 ── */
.detail-top {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  margin-bottom: 6px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 22px;
  border-radius: 40px;
  border: 1.5px solid #d9b36a;
  background: rgba(26, 47, 42, 0.72);
  color: #d9b36a;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: all 0.2s;
  font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

.back-btn:hover {
  background: #d9b36a;
  color: #f2ead8;
  transform: translateY(-1px);
}

.detail-head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.group-chip {
  padding: 5px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 1px;
}

.detail-title {
  font-size: clamp(38px, 6vw, 56px);
  font-weight: 700;
  color: #f2ead8;
  letter-spacing: 4px;
  line-height: 1.1;
}

.detail-slogan {
  font-size: 15px;
  color: #6b4226;
  letter-spacing: 1px;
}

/* ── 毛玻璃卡片 ── */
.glass-card {
  padding: 30px 32px;
  border-radius: 22px;
  background: rgba(26, 47, 42, 0.72);
  border: 1px solid rgba(185, 138, 47, 0.14);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.08);
}

.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.card-icon {
  font-size: 24px;
}

.card-title {
  font-size: 20px;
  font-weight: 700;
  color: #f2ead8;
  letter-spacing: 1px;
}

/* ── 历史背景 ── */
.history-text {
  font-size: 15px;
  line-height: 2.05;
  color: #9fb3a8;
  white-space: pre-line;
}

/* ── 传承人物 ── */
.figure-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.figure-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 16px;
  background: rgba(26, 47, 42, 0.75);
  border: 1px solid rgba(185, 138, 47, 0.1);
  transition: all 0.2s;
}

.figure-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
}

.figure-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f2ead8;
  font-size: 19px;
  font-weight: 700;
  flex-shrink: 0;
}

.figure-name {
  font-size: 16px;
  font-weight: 700;
  color: #f2ead8;
  margin-bottom: 4px;
}

.figure-title {
  font-size: 13px;
  color: #8a6a4f;
  line-height: 1.7;
}

/* ── 相关视频 ── */
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.video-embed {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(185, 138, 47, 0.12);
  background: rgba(26, 47, 42, 0.75);
}

.video-frame {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: none;
  display: block;
}

.video-caption {
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #9fb3a8;
}

.video-link-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  border-radius: 16px;
  background: rgba(26, 47, 42, 0.75);
  border: 1px solid rgba(185, 138, 47, 0.12);
  text-decoration: none;
  transition: all 0.2s;
}

.video-link-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  border-color: rgba(185, 138, 47, 0.35);
}

.video-play {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(166, 58, 43, 0.1);
  color: #a63a2b;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.video-link-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.video-link-title {
  font-size: 14px;
  font-weight: 600;
  color: #f2ead8;
}

.video-link-hint {
  font-size: 12px;
  color: #b98a2f;
}

/* ── 前沿技术 ── */
.tech-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.tech-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 40px;
  background: rgba(26, 47, 42, 0.85);
  border: 1px solid rgba(185, 138, 47, 0.14);
  font-size: 14px;
  color: #9fb3a8;
}

.tech-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── 相关流派 ── */
.related-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.related-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 40px;
  border: 1.5px solid;
  background: rgba(26, 47, 42, 0.72);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s;
}

.related-chip:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.related-label {
  font-size: 12px;
  font-weight: 400;
  opacity: 0.75;
}

/* ── 未找到 ── */
.detail-empty {
  min-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  padding: 24px;
}

.empty-icon {
  font-size: 56px;
  margin-bottom: 6px;
}

.empty-title {
  font-size: 24px;
  color: #f2ead8;
}

.empty-text {
  font-size: 14px;
  color: #b98a2f;
  margin-bottom: 14px;
}

/* ── 移动端 ── */
@media (max-width: 640px) {
  .detail-body {
    padding: 20px 14px 80px;
    gap: 16px;
  }

  .glass-card {
    padding: 22px 18px;
    border-radius: 18px;
  }

  .figure-grid,
  .video-grid {
    grid-template-columns: 1fr;
  }

  .history-text {
    font-size: 14px;
  }
}
</style>
