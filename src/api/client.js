// 统一 API 客户端 — 自动带 JWT token
const BASE = '/api'

function getToken() {
  return localStorage.getItem('token')
}

export async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data.message || `请求失败 (${res.status})`)
    err.status = res.status
    // 业务错误码（额度体系的 QUOTA_EXCEEDED / LOGIN_REQUIRED 等），调用方按 code 分支处理
    err.code = data.code
    throw err
  }

  return data
}

// ── 认证接口 ──
export const authAPI = {
  sendCode:       (body) => api('POST', '/auth/send-code', body),
  register:       (body) => api('POST', '/auth/register', body),
  login:          (body) => api('POST', '/auth/login', body),
  resetPassword:  (body) => api('POST', '/auth/reset-password', body),
  changePassword: (body) => api('POST', '/auth/change-password', body),
  me:             ()    => api('GET',  '/auth/me'),
}

// ── 个人中心接口（额度 / 云端作品 / 成长体系，必做项 4）──
export const userAPI = {
  usage:       ()          => api('GET', '/user/usage'),
  works:       ()          => api('GET', '/user/works'),
  addWork:     (body)      => api('POST', '/user/works', body),
  mergeWorks:  (works)     => api('POST', '/user/works/merge', { works }),
  deleteWork:  (id)        => api('DELETE', `/user/works/${id}`),
  // 成长体系：任务 / 兑换码 / 模拟会员
  tasksEvent:  (task)      => api('POST', '/user/tasks/event', { task }),
  checkin:     ()          => api('POST', '/user/tasks/checkin'),
  claimTask:   (task, stage) => api('POST', '/user/tasks/claim', { task, stage }),
  redeem:      (code)      => api('POST', '/user/redeem', { code }),
  vipPurchase: (plan)      => api('POST', '/user/vip/purchase', { plan }),
  setAvatar:   (dataUrl)   => api('POST', '/user/avatar', { dataUrl }),
}

// ── 管理后台接口（admin 角色，成长体系）──
export const adminAPI = {
  stats:        ()          => api('GET', '/admin/stats'),
  genCodes:     (body)      => api('POST', '/admin/codes', body),
  codes:        ()          => api('GET', '/admin/codes'),
  revokeCode:   (id)        => api('POST', `/admin/codes/${id}/revoke`),
}
