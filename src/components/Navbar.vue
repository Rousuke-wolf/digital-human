<template>
  <div class="navbar">
    <router-link to="/" class="nav-logo">
      <div class="nav-logo-icon">绣</div>
      <span class="nav-logo-text">智传非遗</span>
    </router-link>

    <div class="nav-center">
      <router-link
        v-for="tab in tabs"
        :key="tab.id"
        :to="tab.path"
        class="nav-tab"
        active-class="active"
      >{{ tab.label }}</router-link>
    </div>

    <!-- 用户区：与字符串版导航条（Navibar.js）结构一致，登录态改为响应式 -->
    <div class="nav-right">
      <div class="nav-user-area">
        <template v-if="isLoggedIn">
          <div class="nav-user-menu">
            <span class="nav-user-name">👤 欢迎，{{ user?.username }}</span>
            <router-link to="/profile" class="nav-profile-link">个人中心</router-link>
            <div class="nav-logout-wrap" @mouseenter="cancelHide" @mouseleave="scheduleHide">
              <button class="nav-user-logout" title="退出登录" @click.stop="showPopup">退出</button>
              <div class="nav-logout-popup" :class="{ visible: popupVisible }">
                <span class="popup-text">确认退出吗？</span>
                <button class="popup-confirm" @click.stop="confirmLogout">确认</button>
                <button class="popup-cancel" @click.stop="hidePopup">取消</button>
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <router-link to="/login" class="nav-login-btn">登录</router-link>
          <router-link to="/login?mode=register" class="nav-register-btn">注册</router-link>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useAuth } from '../composables/useAuth.js'

const tabs = [
  { id: 'home',     path: '/',          label: '首页' },
  { id: 'culture',  path: '/culture',   label: '刺绣文化' },
  { id: 'teaching', path: '/teaching',  label: '教学体验' },
  { id: '3d',       path: '/3d',        label: '3D展厅' },
  { id: 'about',    path: '/about',     label: '关于我们' },
]

const { user, isLoggedIn, logout } = useAuth()

// ── 退出确认弹窗（行为对齐原 Navibar.js：点击别处 150ms 后关闭）──
const popupVisible = ref(false)
let hideTimer = null

function showPopup() {
  clearTimeout(hideTimer)
  popupVisible.value = true
}
function hidePopup() {
  hideTimer = setTimeout(() => { popupVisible.value = false }, 150)
}
function scheduleHide() { hidePopup() }
function cancelHide() { clearTimeout(hideTimer) }
function confirmLogout() {
  popupVisible.value = false
  logout()
}

onMounted(() => {
  document.addEventListener('click', hidePopup)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', hidePopup)
  clearTimeout(hideTimer)
})
</script>
