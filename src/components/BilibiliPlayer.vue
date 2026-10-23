<!-- ═══════════════════════════════════════════════════════
  BilibiliPlayer.vue — B站视频嵌入播放器（详情抽屉「视频鉴赏」区块）
  方案：官方 iframe 嵌入（player.bilibili.com/player.html?bvid=…&page=1）
    · 懒加载（loading="lazy"）+ 高画质（high_quality=1）+ 关弹幕（danmaku=0）
    · 点封面才加载 iframe：抽屉滑出不白占带宽，跨域 iframe 加载失败
      无法被 onload 检测（浏览器不抛跨域错误），用超时兜底判断：
      加载超时后若页面未感知播放器已就绪，则切换为「视频加载失败，
      点击前往B站观看」外链按钮（答辩现场断网也能优雅降级）
    · 封面占位用国风视觉（深墨绿渐变 + 鎏金纹样 + 播放按钮）
  props: bvid(BV 号，必填) / title(视频标题) / poster(可选封面图)
═══════════════════════════════════════════════════════ -->
<template>
  <div class="bili-player">
    <!-- 封面占位（国风视觉，点按后加载 iframe） -->
    <button v-if="!loaded" class="bili-cover" :style="coverStyle" title="点击播放" @click="loadVideo">
      <span class="bili-play">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5z"></path>
        </svg>
      </span>
      <span class="bili-cover-title">{{ title }}</span>
      <span class="bili-cover-hint">点击播放 · Bilibili</span>
    </button>

    <!-- 加载超时兜底：视频加载失败，点击前往B站观看 -->
    <a
      v-else-if="failed"
      class="bili-fallback"
      :href="watchUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 8v4.5"></path>
        <path d="M12 16h.01"></path>
      </svg>
      <b>视频加载失败，点击前往B站观看</b>
    </a>

    <!-- 官方 iframe 嵌入 -->
    <iframe
      v-else
      class="bili-frame"
      :src="embedUrl"
      scrolling="no"
      frameborder="0"
      allowfullscreen="true"
      loading="lazy"
      title="刺绣技艺视频"
    ></iframe>

    <!-- 常驻外链：B站原页面（无论成败都提供） -->
    <a class="bili-link" :href="watchUrl" target="_blank" rel="noopener noreferrer">
      前往B站观看原视频 ↗
    </a>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'

const props = defineProps({
  bvid: { type: String, required: true },
  title: { type: String, default: '刺绣技艺视频' },
  poster: { type: String, default: '' },
})

// iframe 加载是否已启动（点封面后置 true，此后不再显示封面）
const loaded = ref(false)
// 超时兜底：loadVideo 后 5s 内未确认加载成功 → 显示外链按钮
const failed = ref(false)
let failTimer = null

// 官方嵌入地址：高画质 + 关弹幕 + 第 1P
const embedUrl = computed(() =>
  `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(props.bvid)}&page=1&high_quality=1&danmaku=0`,
)
// 外链观看地址
const watchUrl = computed(() => `https://www.bilibili.com/video/${encodeURIComponent(props.bvid)}`)

// 国风封面：poster 图优先，缺省时深墨绿渐变 + 鎏金暗纹
const coverStyle = computed(() => {
  if (props.poster) return { backgroundImage: `url(${props.poster})` }
  return {
    backgroundImage:
      'radial-gradient(420px 240px at 50% 20%, rgba(185,138,47,0.16), transparent 70%),' +
      'radial-gradient(300px 200px at 78% 88%, rgba(51,70,95,0.5), transparent 75%),' +
      'linear-gradient(180deg, #223c35, #101f1b)',
  }
})

function loadVideo() {
  if (loaded.value) return
  loaded.value = true
  // 跨域 iframe 加载失败无法被 JS 感知：5s 超时兜底判断
  failTimer = setTimeout(() => {
    failed.value = true
  }, 5000)
}

onBeforeUnmount(() => clearTimeout(failTimer))
</script>

<style scoped lang="scss">
@use '../styles/variables.scss' as *;

.bili-player {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 16:9 容器（封面 / iframe / 兜底共用） */
.bili-cover,
.bili-frame,
.bili-fallback {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  border: 1px solid $color-gold-faint;
  overflow: hidden;
}

/* ── 国风封面：鎏金播放钮 + 标题 + 提示 ── */
.bili-cover {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: $color-bg-card;
  background-size: cover;
  background-position: center;
  cursor: pointer;
  padding: 0;
  transition: transform 0.2s ease, border-color 0.2s ease;

  &:hover {
    border-color: $color-accent-gold;
    transform: translateY(-2px);
  }
}

.bili-play {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: rgba($color-accent-gold, 0.9);
  color: $color-bg-deep;
  box-shadow: 0 6px 22px $color-gold-halo;

  svg {
    width: 26px;
    height: 26px;
    margin-left: 3px;
  }
}

.bili-cover-title {
  max-width: 86%;
  color: $color-text-primary;
  font-size: $font-size-caption;
  letter-spacing: 2px;
  text-shadow: 0 1px 6px rgba($color-bg-deep, 0.9);
}

.bili-cover-hint {
  color: $color-ivory-dim;
  font-size: $font-size-tiny;
  letter-spacing: 1px;
}

/* ── 加载失败兜底：外链按钮 ── */
.bili-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: linear-gradient(180deg, $color-bg-card, $color-bg-deep);
  color: $color-accent-gold-pale;
  text-decoration: none;
  font-size: $font-size-body-sm;
  letter-spacing: 1px;
  transition: border-color 0.2s ease;

  svg {
    width: 30px;
    height: 30px;
    color: $color-accent-cinnabar;
  }

  &:hover {
    border-color: $color-accent-gold;
  }
}

/* ── iframe ── */
.bili-frame {
  background: $color-bg-deep;
}

/* ── 常驻外链 ── */
.bili-link {
  align-self: flex-end;
  color: $color-ivory-dim;
  font-size: $font-size-caption;
  letter-spacing: 1px;
  text-decoration: none;
  transition: color 0.2s;

  &:hover {
    color: $color-accent-gold-pale;
  }
}
</style>
