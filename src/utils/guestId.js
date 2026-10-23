// guestId.js — 游客标识 + 统一认证请求头（额度体系，必做项 4）
// 游客身份用 localStorage 持久化的 UUID 标识，服务端按它统计每日试用额度。
// AI 类请求（对话/纹样/3D）都要带这两个头：
//   登录态 → Authorization: Bearer <token>
//   游客态 → X-Guest-Id: <uuid>
const GUEST_KEY = 'zhichuan-guest-id'

export function getGuestId() {
  try {
    let id = localStorage.getItem(GUEST_KEY)
    if (!id) {
      id = 'g-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
      localStorage.setItem(GUEST_KEY, id)
    }
    return id
  } catch {
    return 'g-unknown'
  }
}

// 认证请求头（Content-Type 由调用方自行补充）
export function authHeaders() {
  const headers = { 'X-Guest-Id': getGuestId() }
  const token = localStorage.getItem('token')
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}
