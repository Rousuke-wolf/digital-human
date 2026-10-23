<!-- ═══════════════════════════════════════════════════════
  AvatarPlayer.vue — 数字人形象播放器（答辩技术亮点 ③）
  双输入设计：
    videoUrl — 预录数字人讲解视频段（无声口型视频，循环播放）
    audioUrl — 对应讲解音频（与视频同步起播，音频结束视频停止）
  降级策略：未传 videoUrl 时渲染插槽内容 —— 本项目插槽内放
    Live2D 画布（口型由 TTS 振幅实时驱动），现场无网络同样可演示
  props: videoUrl / audioUrl / poster
  expose: play() / stop()
  emits: started / ended
═══════════════════════════════════════════════════════ -->
<template>
  <div class="avatar-player">
    <!-- 预录视频段：有配套音频时静音循环（视频只出形象，声音走 audioUrl） -->
    <video
      v-if="videoUrl"
      ref="videoRef"
      class="avatar-video"
      :src="videoUrl"
      :poster="poster"
      :muted="hasAudio"
      loop
      playsinline
      preload="auto"
    ></video>
    <audio v-if="audioUrl" ref="audioRef" :src="audioUrl" preload="auto" @ended="handleAudioEnded"></audio>

    <!-- 无预录视频：降级为 Live2D / 静态形象（插槽由父组件填充） -->
    <div v-if="!videoUrl" class="avatar-fallback">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  videoUrl: { type: String, default: '' }, // 预录讲解视频段
  audioUrl: { type: String, default: '' }, // 配套讲解音频
  poster: { type: String, default: '' },   // 视频封面
})

const emit = defineEmits(['started', 'ended'])

const videoRef = ref(null)
const audioRef = ref(null)
const hasAudio = computed(() => !!props.audioUrl)

/** 同步播放：音频为「时间主」，视频循环垫形象 */
async function play() {
  stop()
  const video = videoRef.value
  const audio = audioRef.value

  if (video && audio) {
    audio.play().catch(() => {})
    await video.play().catch(() => {})
    emit('started')
    return
  }
  // 只有视频（带原声）或只有音频
  if (video) {
    await video.play().catch(() => {})
    emit('started')
  } else if (audio) {
    audio.play().catch(() => {})
    emit('started')
  }
}

function stop() {
  videoRef.value?.pause()
  audioRef.value?.pause()
  if (audioRef.value) audioRef.value.currentTime = 0
}

function handleAudioEnded() {
  videoRef.value?.pause()
  emit('ended')
}

// 音频自然播完 → 视频同步停止
defineExpose({ play, stop })
</script>

<style scoped lang="scss">
@use '../styles/variables.scss' as *;

.avatar-player {
  position: relative;
  width: 100%;
  height: 100%;
}

.avatar-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  width: 100%;
  height: 100%;
}
</style>
