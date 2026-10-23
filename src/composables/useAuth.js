import { ref } from 'vue'
import { authAPI, userAPI } from '../api/client.js'
import { mergeLocalWorks, loadCloudWorks } from '../utils/worksSync.js'

// 全局单例状态（跨组件共享；导航条登录态由 Navbar.vue 响应式渲染）
const user = ref(null)
const isLoggedIn = ref(false)
const loading = ref(true)
// 额度状态（必做项 4）：登录后为 { quotas: [...] }，未登录为 null
const quota = ref(null)

// 本地缓存（后端不可用时也能保持登录态）
const CACHE_KEY = 'auth_cache'

function _saveCache(data) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data))
}
function _loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function _clearCache() {
  localStorage.removeItem(CACHE_KEY)
  localStorage.removeItem('token')
}

// 登录成功后：游客本地作品合并上云 + 拉取额度（均不阻塞登录流程）
async function _afterLogin() {
  await mergeLocalWorks()
  await refreshQuota()
}

// 拉取个人额度（未登录或失败时置空，页面据此隐藏额度卡片）
async function refreshQuota() {
  if (!isLoggedIn.value) {
    quota.value = null
    return
  }
  try {
    quota.value = await userAPI.usage()
  } catch {
    quota.value = null
  }
}

export function useAuth() {
  async function login(email, credential, mode = 'password') {
    const body = mode === 'code'
      ? { email, code: credential, mode: 'code' }
      : { email, password: credential }
    const data = await authAPI.login(body)
    localStorage.setItem('token', data.token)
    _saveCache({ username: data.user.username, email: data.user.email, avatar: data.user.avatar })
    user.value = data.user
    isLoggedIn.value = true
    _afterLogin()
    return data.user
  }

  async function register(username, email, password, code) {
    const data = await authAPI.register({ username, email, password, code })
    localStorage.setItem('token', data.token)
    _saveCache({ username: data.user.username, email: data.user.email, avatar: data.user.avatar })
    user.value = data.user
    isLoggedIn.value = true
    _afterLogin()
    return data.user
  }

  async function checkAuth() {
    loading.value = true
    const token = localStorage.getItem('token')
    if (!token) {
      loading.value = false
      return
    }
    try {
      // 尝试从后端验证 token 是否有效
      const data = await authAPI.me()
      user.value = data.user
      isLoggedIn.value = true
      _saveCache({ username: data.user.username, email: data.user.email, avatar: data.user.avatar })
      // 恢复登录态后：同步云端作品（换设备场景）+ 拉取额度
      loadCloudWorks()
      refreshQuota()
    } catch {
      // 后端不可用 → 从本地缓存恢复
      const cache = _loadCache()
      if (cache?.username) {
        console.log('[auth] 后端不可用，从本地缓存恢复登录态')
        user.value = { username: cache.username, email: cache.email, avatar: cache.avatar }
        isLoggedIn.value = true
      } else {
        // 无缓存 → 退出
        _clearCache()
      }
    } finally {
      loading.value = false
    }
  }

  function logout() {
    _clearCache()
    user.value = null
    isLoggedIn.value = false
    quota.value = null
  }

  return { user, isLoggedIn, loading, quota, login, register, checkAuth, logout, refreshQuota }
}


