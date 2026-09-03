<template>
  <div class="left-stage culture-left">
    <div class="character-section">
      <div class="character-3d">
        <canvas id="live2d" style="width:100%;height:100%;display:block;"></canvas>
      </div>
      <div class="emotion-switch">
        <button
          v-for="e in emotions"
          :key="e.key"
          class="emotion-btn"
          :class="{ active: current === e.key }"
          @click="set(e.key)"
        >
          {{ e.icon }} <span>{{ e.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { initLive2D, setEmotion } from '../../composables/useLive2D.js'

const emotions = [
  { key: 'happy', icon: '😊', label: '开心' },
  { key: 'peace', icon: '😌', label: '平静' },
  { key: 'thoughtful', icon: '🤔', label: '思考' },
  { key: 'surprised', icon: '😲', label: '惊讶' },
  { key: 'gentle', icon: '🥰', label: '温柔' },
]
const current = ref('happy')

function set(emotion) {
  current.value = emotion
  setEmotion(emotion)
}

onMounted(() => {
  // Live2D 初始化由 useLive2D 模块承载（文化页 / 3D 展厅共用）
  initLive2D()
  setEmotion('happy')
})
</script>
