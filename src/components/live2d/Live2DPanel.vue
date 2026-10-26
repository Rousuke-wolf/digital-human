<template>
  <div class="left-stage culture-left">
    <div class="character-section">
      <div class="character-3d">
        <canvas id="live2d" style="width:100%;height:100%;display:block;"></canvas>
      </div>
      <Live2DControls />
      <div v-if="live2dState.expressionSupported" class="emotion-switch">
        <button
          v-for="e in emotions"
          :key="e.key"
          class="emotion-btn"
          :class="{ active: current === e.key }"
          @click="set(e.key)"
        >
          <span>{{ e.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { initLive2D, setEmotion, live2dState } from '../../composables/useLive2D.js'
import Live2DControls from './Live2DControls.vue'

const emotions = [
  { key: 'happy', label: '开心' },
  { key: 'peace', label: '平静' },
  { key: 'thoughtful', label: '思考' },
  { key: 'surprised', label: '惊讶' },
  { key: 'gentle', label: '温柔' },
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
