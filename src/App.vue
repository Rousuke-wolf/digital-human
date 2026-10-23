<template>
  <router-view />
  <!-- 全局登录引导弹窗（额度体系：未登录触发需登录功能时出现） -->
  <LoginPromptModal />
  <!-- 全局悬浮「锦绣助手」刺绣问答（DeepSeek 经后端 /api/chat 代理） -->
  <AiChat />
</template>

<script setup>
import { onMounted } from 'vue'
import { useAuth } from './composables/useAuth.js'
import LoginPromptModal from './components/LoginPromptModal.vue'
import AiChat from './components/AiChat.vue'

const { checkAuth } = useAuth()

// 启动时恢复登录态（导航条登录态由 Navbar.vue 响应式渲染，无需手动同步）
onMounted(async () => {
  await checkAuth()
})
</script>
