<template>
  <div ref="root"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { appState } from '../utils/state.js'
import { initLive2D, destroyLive2D } from '../composables/useLive2D.js'
import { meshyRestoreState } from '../page/show3D/Meshy.js'

const root = ref(null)

onMounted(async () => {
  const { build3DPage } = await import('../page/show3D/index.js')
  root.value.innerHTML = build3DPage(appState._modelHasContent)

  // 3D 展厅初始化（原 window.__rebindScriptEvents 包装顺序：Live2D → Meshy 状态恢复 → 组合事件）
  initLive2D()
  meshyRestoreState()
  window.__bindComboEvents?.()
})

onBeforeUnmount(() => {
  destroyLive2D()
})
</script>
