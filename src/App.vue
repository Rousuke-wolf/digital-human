<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuth } from './composables/useAuth.js'

const { checkAuth } = useAuth()

// 启动时恢复登录态（导航条登录态由 Navbar.vue 响应式渲染，无需手动同步）
onMounted(async () => {
  await checkAuth()
})
</script>
