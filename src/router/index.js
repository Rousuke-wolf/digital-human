import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { guideClearPending, guideStop } from '../utils/voiceGuide.js'

const { user } = useAuth()

const routes = [
  { path: '/',             name: 'home',     component: () => import('../pages/HomePage.vue') },
  { path: '/culture',      name: 'culture',  component: () => import('../pages/CulturePage.vue') },
  { path: '/teaching',     name: 'teaching', component: () => import('../pages/TeachingPage.vue') },
  { path: '/3d',           name: '3d',       component: () => import('../pages/Show3DPage.vue') },
  { path: '/create',       name: 'create',   component: () => import('../pages/PatternPage.vue') },
  { path: '/graph',        name: 'graph',    component: () => import('../pages/GraphPage.vue') },
  { path: '/about',        name: 'about',    component: () => import('../pages/AboutPage.vue') },
  { path: '/login',        name: 'login',    component: () => import('../pages/LoginPage.vue') },
  { path: '/profile',      name: 'profile',  component: () => import('../pages/ProfilePage.vue'), meta: { requiresAuth: true } },
  { path: '/admin',        name: 'admin',    component: () => import('../pages/AdminPage.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫
router.beforeEach((to, from, next) => {
  // 切页：取消未触发的播报 + 打断正在播放的语音（问候/讲解等，新页面挂载后会重新安排）
  guideClearPending()
  guideStop()
  if (to.meta.requiresAuth) {
    const token = localStorage.getItem('token')
    if (!token) {
      return next({ path: '/login', query: { redirect: to.fullPath } })
    }
  }
  // 管理员路由：user 未加载时放行（AdminPage 挂载后自校验）；
  // 已加载且非 admin 则拦回首页
  if (to.meta.requiresAdmin && user.value && user.value.role !== 'admin') {
    return next({ path: '/' })
  }
  next()
})

export default router
