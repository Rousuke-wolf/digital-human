<template>
  <transition name="loginprompt">
    <div v-if="state.visible" class="login-prompt-mask" @click.self="close">
      <div class="login-prompt-card">
        <div class="login-prompt-icon">绣</div>
        <h3 class="login-prompt-title">登录后完整体验</h3>
        <p class="login-prompt-text">{{ state.message }}</p>
        <div class="login-prompt-actions">
          <button class="login-prompt-btn primary" @click="goLogin">去登录</button>
          <button class="login-prompt-btn ghost" @click="close">再逛逛</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
// 全局登录引导弹窗（挂在 App.vue 根，配合 useLoginPrompt 使用）
// 文案随功能变化；「去登录」跳 /login 并带 redirect 回当前页
import { useRouter, useRoute } from 'vue-router'
import { useLoginPrompt } from '../composables/useLoginPrompt.js'

const router = useRouter()
const route = useRoute()
const { state, closeLoginPrompt } = useLoginPrompt()

function goLogin() {
  closeLoginPrompt()
  router.push({ path: '/login', query: { redirect: route.fullPath } })
}

function close() {
  closeLoginPrompt()
}
</script>

<style scoped>
.login-prompt-mask {
  position: fixed; inset: 0; z-index: 3000;
  background: rgba(61, 31, 10, 0.45);
  display: flex; align-items: center; justify-content: center;
}
.login-prompt-card {
  background: #fff; border-radius: 20px; padding: 32px 36px;
  width: 90%; max-width: 380px; text-align: center;
  box-shadow: 0 12px 40px rgba(92, 61, 32, 0.25); border: 1px solid #ede3d0;
}
.login-prompt-icon {
  width: 48px; height: 48px; margin: 0 auto 14px;
  background: #c0392b; color: white; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: bold;
}
.login-prompt-title { font-size: 19px; color: #3d1f0a; margin: 0 0 10px; }
.login-prompt-text { font-size: 14px; color: #9a7d64; line-height: 1.7; margin: 0 0 24px; }
.login-prompt-actions { display: flex; gap: 12px; }
.login-prompt-btn {
  flex: 1; padding: 12px 0; border-radius: 10px; font-size: 15px;
  font-weight: 600; cursor: pointer; transition: background 0.2s, color 0.2s;
}
.login-prompt-btn.primary { background: #c0392b; color: white; border: none; }
.login-prompt-btn.primary:hover { background: #922b21; }
.login-prompt-btn.ghost { background: transparent; color: #9a7d64; border: 1px solid #e2d5c3; }
.login-prompt-btn.ghost:hover { color: #5c3d20; border-color: #c9984a; }

.loginprompt-enter-active, .loginprompt-leave-active { transition: opacity 0.2s; }
.loginprompt-enter-active .login-prompt-card, .loginprompt-leave-active .login-prompt-card {
  transition: transform 0.2s;
}
.loginprompt-enter-from, .loginprompt-leave-to { opacity: 0; }
.loginprompt-enter-from .login-prompt-card, .loginprompt-leave-to .login-prompt-card {
  transform: translateY(12px) scale(0.97);
}
</style>
