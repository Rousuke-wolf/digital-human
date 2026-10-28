<template>
  <div class="live2d-controls" aria-label="数字人形象控制" @pointerdown.stop>
    <button
      type="button"
      class="model-switch-btn"
      :disabled="live2dState.loading"
      :title="`当前：${modelLabel}，点击切换另一个形象`"
      @click="switchLive2DModel()"
    >
      {{ live2dState.loading ? '加载中…' : '切换形象' }}
      <span v-if="!live2dState.loading" class="model-index">{{ live2dState.modelId === 'res1' ? '1' : '2' }}</span>
    </button>
    <button type="button" aria-label="缩小，显示全身" title="缩小，显示全身" :disabled="!live2dState.ready || !live2dState.canZoomOut" @click="zoomLive2D(-1)">−</button>
    <button type="button" aria-label="放大人物" title="放大人物" :disabled="!live2dState.ready || !live2dState.canZoomIn" @click="zoomLive2D(1)">+</button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { LIVE2D_MODELS, live2dState, switchLive2DModel, zoomLive2D } from '../../composables/useLive2D.js'
const modelLabel = computed(() => LIVE2D_MODELS.find((item) => item.id === live2dState.modelId)?.label)
</script>

<style scoped>
.live2d-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 8;
  display: flex;
  gap: 5px;
  padding: 5px;
  border: 1px solid rgba(160, 122, 74, 0.3);
  border-radius: 22px;
  background: rgba(255, 248, 234, 0.88);
  backdrop-filter: blur(8px);
  touch-action: manipulation;
}
button {
  border: 0;
  border-radius: 18px;
  background: transparent;
  color: #795a39;
  padding: 5px 8px;
  font-size: 13px;
  cursor: pointer;
}
/* 只用 hover 反馈：focus-visible 会在鼠标点击后因焦点残留而卡在"按下"状态 */
button:hover:not(:disabled) { background: rgba(160, 122, 74, 0.15); }
button:disabled { opacity: 0.45; cursor: default; }
.model-index { font-size: 11px; margin-left: 3px; }
@media (max-width: 900px) {
  /* 移到悬浮圆框上方（外壳不再裁剪，可溢出显示），居中不遮挡数字人 */
  .live2d-controls { top: auto; bottom: 100%; margin-bottom: 6px; right: 50%; transform: translateX(50%); width: max-content; gap: 0; padding: 2px; }
  button { padding: 4px; font-size: 10px; }
  .model-index { display: none; }
}
</style>
