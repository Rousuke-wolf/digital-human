<template>
  <div ref="root"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { initTeachingCharacter, destroyTeachingCharacter } from '../page/teach/character.js'

const root = ref(null)

onMounted(async () => {
  // 动态导入教学页（含 canvas 动画脚本 + 游戏 CSS）
  const { default: buildTeachingPage } = await import('../page/teach/index.js')

  root.value.innerHTML = buildTeachingPage()

  // 3D 数字人角色初始化（原 window.__rebindScriptEvents）
  initTeachingCharacter()

  // 教学页初始化 — 动画演示需要 DOM 就绪后手动触发
  setTimeout(() => {
    if (typeof window.updateDemo === 'function') {
      window.updateDemo()
    }
  }, 150)
})

onBeforeUnmount(() => {
  destroyTeachingCharacter()
})
</script>
