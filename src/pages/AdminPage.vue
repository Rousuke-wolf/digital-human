<template>
  <div class="app-wrapper">
    <Navbar />

    <div class="admin-page">
      <h2 class="admin-title">🛠 管理后台</h2>

      <!-- 运营概览 -->
      <section class="admin-card">
        <h3 class="admin-card-title">运营概览</h3>
        <div class="admin-stats">
          <div class="admin-stat"><b>{{ stats.todayCalls }}</b><span>今日 AI 调用</span></div>
          <div class="admin-stat"><b>{{ stats.userCount }}</b><span>注册用户</span></div>
          <div class="admin-stat"><b>{{ stats.vipCount }}</b><span>生效会员</span></div>
          <div class="admin-stat"><b>{{ stats.todayWorks }}</b><span>今日新增作品</span></div>
          <div class="admin-stat"><b>{{ stats.codeUsed }} / {{ stats.codeTotal }}</b><span>兑换码使用</span></div>
        </div>
      </section>

      <!-- 生成兑换码 -->
      <section class="admin-card">
        <h3 class="admin-card-title">生成兑换码</h3>
        <div class="admin-gen-row">
          <select v-model="genForm.package" class="admin-input">
            <option v-for="(p, key) in PACKAGES" :key="key" :value="key">{{ p.label }}</option>
          </select>
          <input v-model.number="genForm.count" class="admin-input" type="number" min="1" max="100" placeholder="数量" />
          <input v-model="genForm.batch" class="admin-input" placeholder="批次名（可选）" />
          <button class="profile-btn primary" :disabled="generating" @click="doGen">
            {{ generating ? '生成中...' : '生成' }}
          </button>
        </div>
        <div v-if="genResult.length" class="admin-gen-result">
          <p class="admin-gen-hint">已生成 {{ genResult.length }} 枚（答辩/活动发给用户现场兑换）：</p>
          <div v-for="c in genResult" :key="c" class="admin-code-line">
            <code>{{ c }}</code>
            <button class="work-btn" @click="copyCode(c)">复制</button>
          </div>
        </div>
        <p v-if="genMsg" class="profile-hint" :class="{ error: genMsgError }">{{ genMsg }}</p>
      </section>

      <!-- 兑换码列表 -->
      <section class="admin-card">
        <h3 class="admin-card-title">兑换码列表</h3>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr><th>兑换码</th><th>包类型</th><th>批次</th><th>状态</th><th>创建时间</th><th>操作</th></tr>
            </thead>
            <tbody>
              <tr v-for="c in codes" :key="c.id">
                <td><code class="admin-code">{{ c.code }}</code></td>
                <td>{{ packageLabel(c.package) }}</td>
                <td>{{ c.batch }}</td>
                <td>
                  <span v-if="c.used_by" class="code-status used">已使用（{{ c.username }}）</span>
                  <span v-else-if="c.revoked" class="code-status revoked">已作废</span>
                  <span v-else class="code-status free">未使用</span>
                </td>
                <td>{{ (c.created_at || '').slice(0, 16) }}</td>
                <td>
                  <button v-if="!c.used_by && !c.revoked" class="work-btn danger" @click="doRevoke(c)">作废</button>
                  <button v-else class="work-btn" @click="copyCode(c.code)">复制</button>
                </td>
              </tr>
              <tr v-if="!codes.length"><td colspan="6" class="admin-empty">暂无兑换码，先生成一批吧</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
// AdminPage.vue — 管理后台（成长体系，必做项 4 扩展）
// 运营统计 + 兑换码管理；仅 admin 角色可访问（路由守卫 + 页面自校验双保险）
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Navbar from '../components/Navbar.vue'
import { useAuth } from '../composables/useAuth.js'
import { authAPI, adminAPI } from '../api/client.js'

const router = useRouter()
const { user, isLoggedIn } = useAuth()

// 包类型（与服务端 REDEEM_PACKAGES 对应）
const PACKAGES = {
  VIP7:     { label: '会员 7 天' },
  VIP30:    { label: '会员 30 天' },
  PATTERN5: { label: '纹样额度 +5 张' },
  CHAT50:   { label: '对话额度 +50 条' },
}

function packageLabel(key) {
  return PACKAGES[key]?.label ?? key
}

const stats = ref({ todayCalls: 0, userCount: 0, vipCount: 0, codeTotal: 0, codeUsed: 0, todayWorks: 0 })
const codes = ref([])
const genForm = reactive({ package: 'VIP7', count: 5, batch: '' })
const genResult = ref([])
const generating = ref(false)
const genMsg = ref('')
const genMsgError = ref(false)

async function loadAll() {
  try {
    stats.value = await adminAPI.stats()
    const data = await adminAPI.codes()
    codes.value = data.codes
  } catch (err) {
    genMsg.value = err.message
    genMsgError.value = true
  }
}

async function doGen() {
  if (generating.value) return
  generating.value = true
  genMsg.value = ''
  try {
    const res = await adminAPI.genCodes({
      package: genForm.package,
      count: genForm.count,
      batch: genForm.batch,
    })
    genResult.value = res.codes
    loadAll()
  } catch (err) {
    genMsg.value = err.message
    genMsgError.value = true
  } finally {
    generating.value = false
  }
}

async function doRevoke(c) {
  if (!window.confirm(`确定作废兑换码 ${c.code} 吗？`)) return
  try {
    await adminAPI.revokeCode(c.id)
    loadAll()
  } catch (err) {
    genMsg.value = err.message
    genMsgError.value = true
  }
}

async function copyCode(code) {
  try {
    await navigator.clipboard.writeText(code)
    genMsg.value = `已复制：${code}`
    genMsgError.value = false
  } catch {
    genMsg.value = '复制失败，请手动选择复制'
    genMsgError.value = true
  }
}

onMounted(async () => {
  if (!isLoggedIn.value) {
    router.replace('/login')
    return
  }
  // 刷新直达场景：user 可能尚未加载 role，向后端确认一次
  if (user.value?.role !== 'admin') {
    try {
      const data = await authAPI.me()
      user.value = data.user
    } catch {
      router.replace('/login')
      return
    }
  }
  if (user.value?.role !== 'admin') {
    router.replace('/')
    return
  }
  loadAll()
})
</script>

<style scoped>
.admin-page {
  max-width: 1080px; margin: 28px auto 60px; padding: 0 20px;
  display: flex; flex-direction: column; gap: 22px;
}
.admin-title { font-size: 22px; color: #3d1f0a; margin: 0; }
.admin-card {
  background: #fff; border-radius: 20px; padding: 26px 28px;
  border: 1px solid #ede3d0; box-shadow: 0 6px 24px rgba(92, 61, 32, 0.08);
}
.admin-card-title { font-size: 17px; color: #3d1f0a; margin: 0 0 18px; }

.admin-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; }
.admin-stat {
  text-align: center; padding: 18px 10px; border-radius: 14px;
  background: linear-gradient(135deg, #faf6ef, #f4ecdd);
  border: 1px solid #ede3d0;
}
.admin-stat b { display: block; font-size: 24px; color: #8b6240; margin-bottom: 4px; }
.admin-stat span { font-size: 13px; color: #9a7d64; }

.admin-gen-row { display: flex; gap: 10px; flex-wrap: wrap; }
.admin-input {
  padding: 10px 14px; border: 1px solid #e2d5c3; border-radius: 10px;
  font-size: 14px; color: #3d1f0a; background: #faf8f3; outline: none;
  transition: border-color 0.2s;
}
.admin-input:focus { border-color: #c9984a; box-shadow: 0 0 0 3px rgba(201, 152, 74, 0.12); }
.admin-gen-result { margin-top: 16px; padding-top: 16px; border-top: 1px dashed #ede3d0; }
.admin-gen-hint { font-size: 13px; color: #9a7d64; margin: 0 0 10px; }
.admin-code-line { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.admin-code-line code {
  flex: 1; padding: 8px 12px; background: #faf8f3; border: 1px solid #ede3d0;
  border-radius: 8px; font-size: 13px; color: #8b6240; letter-spacing: 1px;
}

.admin-table-wrap { overflow-x: auto; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.admin-table th {
  text-align: left; padding: 10px 12px; color: #9a7d64; font-weight: 600;
  border-bottom: 1px solid #ede3d0; white-space: nowrap;
}
.admin-table td { padding: 10px 12px; border-bottom: 1px solid #f4ecdd; color: #5c3d20; }
.admin-code { color: #8b6240; letter-spacing: 1px; }
.code-status { font-size: 12px; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
.code-status.free { background: #eef7ee; color: #2e7d32; }
.code-status.used { background: #fdf1ef; color: #c0392b; }
.code-status.revoked { background: #f0e8da; color: #9a7d64; }
.admin-empty { text-align: center; color: #b0907a; padding: 24px 0; }

.profile-btn.primary { background: #c0392b; color: white; border: none; padding: 10px 18px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
.profile-btn.primary:hover { background: #922b21; }
.profile-btn.primary:disabled { opacity: 0.6; cursor: not-allowed; }
.work-btn {
  padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
  cursor: pointer; background: transparent; border: 1px solid #e2d5c3; color: #5c3d20;
  white-space: nowrap; transition: border-color 0.2s, color 0.2s, background 0.2s;
}
.work-btn:hover { border-color: #c9984a; color: #3d1f0a; }
.work-btn.danger { color: #c0392b; border-color: #e6c4bd; }
.work-btn.danger:hover { background: #fdf1ef; border-color: #c0392b; }
.profile-hint { font-size: 13px; margin: 10px 0 0; color: #2e7d32; }
.profile-hint.error { color: #c0392b; }

@media (max-width: 640px) {
  .admin-page { padding: 0 12px; margin-top: 16px; }
  .admin-card { padding: 20px 16px; }
}
</style>
