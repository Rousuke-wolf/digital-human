<template>
  <div class="app-wrapper">
    <Navbar />

    <div class="profile-page">
      <!-- ── 1. 账号信息 ── -->
      <section class="profile-card account-card">
        <div class="account-main">
          <div
            class="account-avatar"
            :class="{ photo: user?.avatar }"
            :title="avatarBusy ? '上传中...' : '点击更换头像'"
            @click="onPickAvatar"
          >
            <img v-if="user?.avatar" :src="user.avatar" alt="我的头像" />
            <template v-else>{{ avatarChar }}</template>
          </div>
          <input
            ref="avatarInput"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style="display:none"
            @change="onAvatarFile"
          />
          <div class="account-info">
            <h2 class="account-name">{{ user?.username || '—' }}</h2>
            <p class="account-meta">{{ user?.email || '' }}</p>
            <p class="account-meta">{{ user?.created_at ? `注册于 ${formatDate(user.created_at)}` : '' }}</p>
            <p v-if="avatarMsg" class="profile-hint">{{ avatarMsg }}</p>
          </div>
          <div class="account-actions">
            <button v-if="user?.avatar" class="profile-btn ghost" :disabled="avatarBusy" @click="onResetAvatar">
              恢复默认头像
            </button>
            <button class="profile-btn ghost" @click="showPwdForm = !showPwdForm">
              {{ showPwdForm ? '收起' : '🔒 修改密码' }}
            </button>
            <button class="profile-btn danger" @click="handleLogout">退出登录</button>
          </div>
        </div>

        <!-- 修改密码（折叠表单，沿用旧实现） -->
        <form v-if="showPwdForm" class="pwd-form" @submit.prevent="handleChangePwd">
          <div class="pwd-form-row">
            <input v-model="form.oldPassword" type="password" placeholder="旧密码" required autocomplete="current-password" />
            <input v-model="form.newPassword" type="password" placeholder="新密码（至少 6 位）" required minlength="6" autocomplete="new-password" />
            <input v-model="form.confirmPassword" type="password" placeholder="确认新密码" required minlength="6" />
            <button type="submit" class="profile-btn primary" :disabled="submitting">
              {{ submitting ? '请稍候...' : '确认修改' }}
            </button>
          </div>
          <p v-if="pwdMismatch" class="profile-hint error">两次输入不一致</p>
          <p v-if="pwdError" class="profile-hint error">{{ pwdError }}</p>
          <p v-if="pwdSuccess" class="profile-hint success">{{ pwdSuccess }}</p>
        </form>
      </section>

      <!-- ── 2. 额度中心 ── -->
      <section class="profile-card">
        <h3 class="profile-card-title">🎯 今日额度</h3>
        <div class="quota-grid">
          <div v-for="q in quotaCards" :key="q.feature" class="quota-card" :class="{ full: isFull(q) }">
            <div class="quota-head">
              <span class="quota-icon">{{ q.icon }}</span>
              <span class="quota-name">{{ q.label }}</span>
              <span class="quota-num">{{ q.unlimited ? '不限' : `${q.used} / ${q.limit}` }}</span>
            </div>
            <div class="quota-bar">
              <div class="quota-bar-fill" :class="{ over: isFull(q) }" :style="{ width: q.pct }"></div>
            </div>
            <p v-if="isFull(q)" class="quota-hint">今日额度已用完，明天再来吧</p>
          </div>
        </div>
      </section>

      <!-- ── 2.5 今日任务 ── -->
      <section class="profile-card">
        <h3 class="profile-card-title">🏆 今日任务 <span class="title-hint">完成任务领奖励，当日额度加成</span></h3>
        <div class="task-grid">
          <div v-for="t in taskCards" :key="t.key" class="task-card" :class="{ claimed: t.claimed }">
            <div class="task-tip">{{ t.desc || '完成任务并领取，当日额度加成' }}</div>
            <span class="task-icon">{{ t.icon }}</span>
            <div class="task-info">
              <div class="task-name-row">
                <span class="task-name">{{ t.name }}</span>
              </div>

              <!-- 只显示当前待完成的阶段；完成并领取后自动显示下一阶段 -->
              <template v-if="t.key === 'checkin'">
                <span class="task-progress-text">{{ t.claimed ? '已签到，对话额度 +20 已生效' : '未签到' }}</span>
                <div class="task-bar"><div class="task-bar-fill" :style="{ width: t.pct }"></div></div>
              </template>
              <template v-else-if="t.currentStage">
                <div class="task-stage-row">
                  <span class="stage-goal">🎯 {{ t.currentStage.label }}</span>
                  <span class="stage-bonus">{{ t.currentStage.bonusText }}</span>
                  <button
                    class="work-btn stage-btn"
                    :class="{ ready: t.currentStage.done }"
                    :disabled="!t.currentStage.done"
                    @click="claimStage(t.key, t.currentStage.idx)"
                  >{{ t.currentStage.done ? '领取奖励' : '进行中' }}</button>
                </div>
                <!-- 进度条 + 右下角阶段计数：0/3 → 1/3 ... -->
                <div class="task-bar-row">
                  <div class="task-bar"><div class="task-bar-fill" :style="{ width: t.pct }"></div></div>
                  <span class="task-counter">{{ t.claimedCount }}/{{ t.stages.length }}</span>
                </div>
              </template>
              <template v-else>
                <span class="task-progress-text">🎉 全部阶段已完成，额度已加成</span>
                <div class="task-bar-row">
                  <div class="task-bar"><div class="task-bar-fill" :style="{ width: t.pct }"></div></div>
                  <span class="task-counter">{{ t.claimedCount }}/{{ t.stages.length }}</span>
                </div>
              </template>
            </div>
            <div class="task-action">
              <button v-if="t.key === 'checkin'" class="work-btn ready" :disabled="t.claimed" @click="doCheckin">
                {{ t.claimed ? '已签到' : '立即签到' }}
              </button>
            </div>
          </div>
        </div>
        <p v-if="taskMsg" class="profile-hint" :class="{ error: taskMsgError }">{{ taskMsg }}</p>
      </section>

      <!-- ── 2.6 会员中心 ── -->
      <section class="profile-card">
        <h3 class="profile-card-title">👑 会员中心</h3>
        <div v-if="vip.active" class="vip-status">
          <span class="vip-crown">👑</span>
          <div>
            <p class="vip-status-title">会员生效中（{{ vip.level }}）</p>
            <p class="vip-status-meta">到期时间：{{ formatTime(vip.expiresAt) }} · 每日 AI 额度 ×{{ vipMultiplier }}</p>
          </div>
        </div>
        <div class="vip-plans">
          <div v-for="p in vipPlans" :key="p.plan" class="vip-plan">
            <div class="vip-plan-name">{{ p.label }}</div>
            <div class="vip-plan-price">¥{{ p.price }}</div>
            <div class="vip-plan-desc">{{ p.desc }}</div>
            <button class="profile-btn primary" @click="openPay(p)">立即开通</button>
          </div>
        </div>
        <p class="vip-note">演示环境 · 模拟支付，确认后直接开通，不会产生真实扣款</p>

        <div class="redeem-row">
          <input v-model="redeemCode" class="redeem-input" placeholder="输入兑换码，如 ZCF-XXXX-XXXX-XXXX" @keyup.enter="doRedeem" />
          <button class="profile-btn ghost" :disabled="redeeming" @click="doRedeem">{{ redeeming ? '兑换中...' : '兑换' }}</button>
        </div>
        <p v-if="redeemMsg" class="profile-hint" :class="{ error: redeemMsgError }">{{ redeemMsg }}</p>
      </section>

      <!-- ── 3. 我的作品 ── -->
      <section class="profile-card">
        <h3 class="profile-card-title">🎨 纹样作品</h3>
        <div v-if="patternWorks.length" class="work-grid">
          <div v-for="w in patternWorks" :key="w.id" class="work-card">
            <img class="work-thumb" :src="w.url" :alt="w.theme" loading="lazy" />
            <div class="work-meta">
              <span class="work-name">{{ w.theme }}</span>
              <span class="work-time">{{ formatTime(w.createdAt) }}</span>
            </div>
            <div class="work-actions">
              <button class="work-btn" @click="reusePattern(w)">复用创作</button>
              <button class="work-btn danger" @click="deletePattern(w)">删除</button>
            </div>
          </div>
        </div>
        <p v-else class="profile-empty">暂无纹样作品，去「纹样共创」创作一枚专属纹样吧</p>

        <h3 class="profile-card-title sub">🧊 3D 生成模型</h3>
        <div v-if="modelWorks.length" class="work-grid">
          <div v-for="m in modelWorks" :key="m.glbUrl" class="work-card model">
            <div class="model-thumb">🧊</div>
            <div class="work-meta">
              <span class="work-name">{{ m.name }}</span>
              <span class="work-time">AI 生成 · {{ m.intro ? '有介绍' : '无介绍' }}</span>
            </div>
            <div class="work-actions">
              <button class="work-btn" @click="viewModel(m)">查看</button>
              <button class="work-btn danger" @click="deleteModel(m)">删除</button>
            </div>
          </div>
        </div>
        <p v-else class="profile-empty">暂无 3D 作品，去「3D 展厅」用 AI 生成一个吧</p>
      </section>

      <!-- ── 4. 成长记录 ── -->
      <section class="profile-card">
        <h3 class="profile-card-title">🌱 成长记录</h3>
        <div class="stat-grid">
          <div class="stat-item">
            <b>{{ stats.chat }}</b>
            <span>累计对话</span>
          </div>
          <div class="stat-item">
            <b>{{ stats.pattern }}</b>
            <span>纹样生成</span>
          </div>
          <div class="stat-item">
            <b>{{ stats.model3d }}</b>
            <span>3D 生成</span>
          </div>
          <div class="stat-item">
            <b>{{ stats.graph }}</b>
            <span>图谱探索节点</span>
          </div>
        </div>
      </section>

      <!-- ── 5. 语音引导设置（数字人页面介绍/问候，独立音量）── -->
      <section class="profile-card">
        <h3 class="profile-card-title">⚙️ 语音引导设置</h3>
        <div class="guide-setting-row">
          <div class="guide-setting-info">
            <span class="guide-setting-name">绫韵页面引导与问候</span>
            <span class="guide-setting-desc">
              首次进入页面时介绍功能，3D 展厅、纹样共创、知识图谱每次进入会随机问候；关闭后不再播报
            </span>
          </div>
          <label class="guide-switch">
            <input
              v-model="guideSettings.enabled"
              type="checkbox"
              @change="onGuideEnabledChange"
            />
            <span class="guide-switch-track"><span class="guide-switch-thumb"></span></span>
          </label>
        </div>
        <div class="guide-setting-row" :class="{ off: !guideSettings.enabled }">
          <div class="guide-setting-info">
            <span class="guide-setting-name">引导音量 <b>{{ guideSettings.volume }}</b></span>
            <span class="guide-setting-desc">
              只影响页面引导与问候的播报音量，不改变「绫韵问答」对话语音的音量
            </span>
          </div>
          <div class="guide-volume-box">
            <input
              v-model.number="guideSettings.volume"
              type="range"
              min="0"
              max="100"
              step="5"
              :disabled="!guideSettings.enabled"
              @change="onGuideVolumeChange"
            />
            <button
              class="profile-btn ghost"
              :disabled="!guideSettings.enabled"
              @click="previewGuideVoice"
            >🔊 试听</button>
          </div>
        </div>
      </section>
    </div>

    <!-- 模拟支付弹窗（演示环境，无真实交易） -->
    <div v-if="payPlan" class="pay-mask" @click.self="payPlan = null">
      <div class="pay-card">
        <h4 class="pay-title">模拟支付</h4>
        <p class="pay-plan-name">{{ payPlan.label }} · ¥{{ payPlan.price }}</p>
        <div class="pay-qr">🧧</div>
        <p class="pay-note">演示环境：确认后直接开通会员，<br />不会产生任何真实扣款</p>
        <div class="pay-actions">
          <button class="profile-btn ghost" @click="payPlan = null">取消</button>
          <button class="profile-btn primary" :disabled="paying" @click="confirmPay">
            {{ paying ? '开通中...' : `确认支付 ¥${payPlan.price}` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// ProfilePage.vue — 个人中心（必做项 4）
// 四分区：账号信息 / 额度中心 / 我的作品（纹样 + 3D）/ 成长记录
// 作品展示读本地缓存（登录时已由 worksSync 与云端镜像同步）
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Navbar from '../components/Navbar.vue'
import { useAuth } from '../composables/useAuth.js'
import { authAPI, userAPI } from '../api/client.js'
import { loadCloudWorks } from '../utils/worksSync.js'
import { removeGeneratedModel } from '../utils/state.js'
import { goToGeneratedModel } from '../utils/navigation.js'
import {
  getGuideSettings, saveGuideSettings, guideSpeak, guideStop, guideOnPageEnter,
} from '../utils/voiceGuide.js'

const router = useRouter()
const { user, isLoggedIn, quota, logout, refreshQuota } = useAuth()

// ── 本地作品缓存 key（与各页面共用）──
const PATTERN_KEY = 'zhichuan-pattern-works'
const MODEL_KEY = 'zhichuan-generated-models'
const GRAPH_HISTORY_KEY = 'zhichuan-graph-history'

function readLocal(key) {
  try {
    const list = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(list) ? list : []
  } catch { return [] }
}

function writeLocal(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)) } catch {}
}

// ── 账号信息 ──────────────────────────────────────
const avatarChar = computed(() => (user.value?.username?.[0] || '绣'))

// ── 头像设置：点击头像选图 → 压缩为 200×200 JPEG → 上传 → 同步到聊天气泡 ──
const avatarInput = ref(null)
const avatarBusy = ref(false)
const avatarMsg = ref('')

function onPickAvatar() {
  if (avatarBusy.value) return
  avatarInput.value?.click()
}

function onAvatarFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''   // 允许重复选择同一文件
  if (!file) return
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    avatarMsg.value = '仅支持 PNG / JPG / WebP 图片'
    return
  }
  const img = new Image()
  const url = URL.createObjectURL(file)
  img.onload = () => {
    // 居中裁剪压缩到 200×200，控制体积（后端限制 2MB）
    const size = 200
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const scale = Math.max(size / img.width, size / img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
    URL.revokeObjectURL(url)
    uploadAvatar(canvas.toDataURL('image/jpeg', 0.85))
  }
  img.onerror = () => URL.revokeObjectURL(url)
  img.src = url
}

async function uploadAvatar(dataUrl) {
  avatarBusy.value = true
  avatarMsg.value = '头像上传中...'
  try {
    const res = await userAPI.setAvatar(dataUrl)
    user.value = { ...(user.value || {}), avatar: res.avatarUrl }
    avatarMsg.value = '头像已更新，聊天中的头像已同步'
  } catch (err) {
    avatarMsg.value = err.message
  } finally {
    avatarBusy.value = false
  }
}

async function onResetAvatar() {
  if (avatarBusy.value) return
  avatarBusy.value = true
  try {
    await userAPI.setAvatar(null)
    user.value = { ...(user.value || {}), avatar: null }
    avatarMsg.value = '已恢复默认头像'
  } catch (err) {
    avatarMsg.value = err.message
  } finally {
    avatarBusy.value = false
  }
}

const showPwdForm = ref(false)
const submitting = ref(false)
const pwdError = ref('')
const pwdSuccess = ref('')

const form = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const pwdMismatch = computed(() =>
  form.confirmPassword && form.newPassword !== form.confirmPassword)

function formatDate(s) {
  return String(s ?? '').slice(0, 10)
}

function formatTime(s) {
  if (!s) return ''
  const d = new Date(s)
  return isNaN(d.getTime()) ? String(s).slice(0, 10) : d.toLocaleDateString('zh-CN')
}

async function handleChangePwd() {
  pwdError.value = ''
  pwdSuccess.value = ''
  if (form.newPassword !== form.confirmPassword) {
    pwdError.value = '两次输入的新密码不一致'
    return
  }
  submitting.value = true
  try {
    await authAPI.changePassword({
      oldPassword: form.oldPassword,
      newPassword: form.newPassword,
    })
    pwdSuccess.value = '密码修改成功'
    form.oldPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
  } catch (err) {
    pwdError.value = err.message
  } finally {
    submitting.value = false
  }
}

function handleLogout() {
  if (!window.confirm('确定退出登录吗？')) return
  logout()
  router.push('/')
}

// ── 额度中心 ──────────────────────────────────────
const QUOTA_ICONS = { chat: '💬', pattern: '🎨', model3d: '🧊', tts: '🔊' }
const quotaCards = computed(() => {
  const list = quota.value?.quotas ?? []
  return list.map((q) => ({
    ...q,
    icon: QUOTA_ICONS[q.feature] ?? '✨',
    pct: q.unlimited || !q.limit ? '100%' : `${Math.min(100, Math.round((q.used / q.limit) * 100))}%`,
  }))
})

// 满额判断：不限额（limit 为 null）永远不算满
// 注意不能直接写 q.used >= q.limit —— null 会被强转成 0，不限项会被误判满额
function isFull(q) {
  return !q.unlimited && q.limit != null && q.used >= q.limit
}

// ── 我的作品 ──────────────────────────────────────
const patternWorks = ref([])
const modelWorks = ref([])

function loadWorksLocal() {
  patternWorks.value = readLocal(PATTERN_KEY)
  modelWorks.value = readLocal(MODEL_KEY)
}

function reusePattern(w) {
  try { sessionStorage.setItem('zhichuan-pattern-reuse', JSON.stringify(w)) } catch {}
  router.push('/create')
}

function deletePattern(w) {
  if (!window.confirm(`确定删除纹样作品「${w.theme || '未命名'}」吗？`)) return
  patternWorks.value = patternWorks.value.filter((x) => x.id !== w.id)
  writeLocal(PATTERN_KEY, patternWorks.value)
  if (w.cloudId && isLoggedIn.value) {
    userAPI.deleteWork(w.cloudId).catch(() => {})
  }
}

function viewModel(m) {
  goToGeneratedModel(m.glbUrl)
}

function deleteModel(m) {
  if (!window.confirm(`确定删除 3D 作品「${m.name || '未命名'}」吗？`)) return
  removeGeneratedModel(m.glbUrl)
  if (m.cloudId && isLoggedIn.value) {
    userAPI.deleteWork(m.cloudId).catch(() => {})
  }
  modelWorks.value = readLocal(MODEL_KEY)
}

// ── 今日任务 ──────────────────────────────────────
const taskMsg = ref('')
const taskMsgError = ref(false)

function bonusTextOf(bonus) {
  return Object.entries(bonus ?? {})
    .map(([f, amt]) => `${QUOTA_ICONS[f] ?? ''} +${amt}`)
    .join(' ')
}

const taskCards = computed(() => {
  const list = quota.value?.tasks ?? []
  return list.map((t) => {
    const stages = (t.stages ?? []).map((s, idx) => ({ ...s, idx, bonusText: bonusTextOf(s.bonus) }))
    const claimedCount = stages.filter((s) => s.claimed).length
    // 当前待完成阶段 = 第一个未领取的阶段；全部领取则为 null
    const currentStage = claimedCount < stages.length ? stages[claimedCount] : null
    return {
      ...t,
      stages,
      claimedCount,
      currentStage,
      pct: `${Math.min(100, Math.round((t.progress / t.target) * 100))}%`,
    }
  })
})

function showTaskMsg(text, isError = false) {
  taskMsg.value = text
  taskMsgError.value = isError
}

async function doCheckin() {
  try {
    await userAPI.checkin()
    showTaskMsg('签到成功！对话额度 +20 已生效')
    await refreshQuota()
  } catch (err) {
    showTaskMsg(err.message, true)
  }
}

// 领取任务阶段奖励（stage 为阶段序号，0 起）
async function claimStage(key, stage) {
  try {
    await userAPI.claimTask(key, stage)
    showTaskMsg('奖励已领取，今日额度已加成')
    await refreshQuota()
  } catch (err) {
    showTaskMsg(err.message, true)
  }
}

// ── 会员中心（模拟支付）──────────────────────────
const vip = computed(() => quota.value?.vip ?? { active: false, level: null, expiresAt: null })
const vipMultiplier = computed(() => quota.value?.config?.vipMultiplier ?? 2)
const vipPlans = [
  { plan: 'week', label: '周卡', price: 6, desc: '7 天会员 · 额度 ×2' },
  { plan: 'month', label: '月卡', price: 18, desc: '30 天会员 · 额度 ×2' },
]
const payPlan = ref(null)
const paying = ref(false)
const redeemCode = ref('')
const redeeming = ref(false)
const redeemMsg = ref('')
const redeemMsgError = ref(false)

function openPay(p) {
  payPlan.value = p
}

async function confirmPay() {
  if (!payPlan.value || paying.value) return
  paying.value = true
  try {
    const res = await userAPI.vipPurchase(payPlan.value.plan)
    payPlan.value = null
    redeemMsg.value = `开通成功（模拟支付）！会员有效期至 ${formatTime(res.expiresAt)}`
    redeemMsgError.value = false
    await refreshQuota()
  } catch (err) {
    redeemMsg.value = err.message
    redeemMsgError.value = true
  } finally {
    paying.value = false
  }
}

async function doRedeem() {
  if (!redeemCode.value.trim() || redeeming.value) return
  redeeming.value = true
  try {
    const res = await userAPI.redeem(redeemCode.value.trim())
    redeemMsg.value = `兑换成功：${res.package}`
    redeemMsgError.value = false
    redeemCode.value = ''
    await refreshQuota()
  } catch (err) {
    redeemMsg.value = err.message
    redeemMsgError.value = true
  } finally {
    redeeming.value = false
  }
}

// ── 成长记录 ──────────────────────────────────────
const stats = computed(() => {
  const list = quota.value?.quotas ?? []
  const totalOf = (f) => list.find((q) => q.feature === f)?.total ?? 0
  return {
    chat: totalOf('chat'),
    pattern: totalOf('pattern'),
    model3d: totalOf('model3d'),
    graph: readLocal(GRAPH_HISTORY_KEY).length,
  }
})

// ── 语音引导设置（默认开启；音量只影响引导播报，与绫韵问答对话音量独立）──
const guideSettings = reactive(getGuideSettings())

function onGuideEnabledChange() {
  saveGuideSettings({ enabled: guideSettings.enabled })
  if (!guideSettings.enabled) guideStop()   // 关闭开关：停止当前引导播报
}

function onGuideVolumeChange() {
  saveGuideSettings({ volume: guideSettings.volume })
}

function previewGuideVoice() {
  guideSpeak('你好，我是绫韵。这是语音引导的音量试听，你觉得这个大小合适吗？')
}

onMounted(async () => {
  if (!isLoggedIn.value) {
    router.replace('/login')
    return
  }
  // 语音引导：首次进入播报个人中心介绍
  guideOnPageEnter('profile')
  loadWorksLocal()
  refreshQuota()
  // 从云端同步作品（换设备场景）+ 刷新账号资料（登录响应不含注册时间）
  await loadCloudWorks()
  loadWorksLocal()
  authAPI.me()
    .then((data) => { user.value = data.user })
    .catch(() => {})
})
</script>

<style scoped>
.profile-page {
  max-width: 1080px; margin: 28px auto 60px; padding: 0 20px;
  display: flex; flex-direction: column; gap: 22px;
}
.profile-card {
  background: #fff; border-radius: 20px; padding: 26px 28px;
  border: 1px solid #ede3d0; box-shadow: 0 6px 24px rgba(92, 61, 32, 0.08);
}
.profile-card-title { font-size: 17px; color: #3d1f0a; margin: 0 0 18px; }
.profile-card-title.sub { margin-top: 26px; }

/* ── 账号信息 ── */
.account-main { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.account-avatar {
  width: 64px; height: 64px; background: #c0392b; color: white; border-radius: 18px;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; font-weight: bold; flex-shrink: 0;
  cursor: pointer; overflow: hidden; position: relative;
  transition: filter 0.2s;
}
.account-avatar:hover { filter: brightness(0.92); }
.account-avatar:hover::after {
  content: '更换'; position: absolute; inset: 0;
  background: rgba(61, 31, 10, 0.45); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 500;
}
.account-avatar.photo { background: #f4ecdd; }
.account-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.account-info { flex: 1; min-width: 180px; }
.account-name { font-size: 20px; color: #3d1f0a; margin: 0 0 4px; }
.account-meta { font-size: 13px; color: #9a7d64; margin: 2px 0 0; }
.account-actions { display: flex; gap: 10px; }
.profile-btn {
  padding: 10px 18px; border-radius: 10px; font-size: 14px; font-weight: 600;
  cursor: pointer; transition: background 0.2s, color 0.2s, border-color 0.2s;
}
.profile-btn.primary { background: #c0392b; color: white; border: none; }
.profile-btn.primary:hover { background: #922b21; }
.profile-btn.primary:disabled { opacity: 0.6; cursor: not-allowed; }
.profile-btn.ghost { background: transparent; color: #5c3d20; border: 1px solid #e2d5c3; }
.profile-btn.ghost:hover { border-color: #c9984a; color: #3d1f0a; }
.profile-btn.danger { background: transparent; color: #c0392b; border: 1px solid #e6c4bd; }
.profile-btn.danger:hover { background: #fdf1ef; border-color: #c0392b; }

.pwd-form { margin-top: 18px; padding-top: 18px; border-top: 1px dashed #ede3d0; }
.pwd-form-row { display: flex; gap: 10px; flex-wrap: wrap; }
.pwd-form-row input {
  flex: 1; min-width: 150px; padding: 10px 14px; border: 1px solid #e2d5c3;
  border-radius: 10px; font-size: 14px; color: #3d1f0a; background: #faf8f3;
  outline: none; transition: border-color 0.2s;
}
.pwd-form-row input:focus { border-color: #c9984a; box-shadow: 0 0 0 3px rgba(201, 152, 74, 0.12); }
.profile-hint { font-size: 13px; margin: 10px 0 0; }
.profile-hint.error { color: #c0392b; }
.profile-hint.success { color: #2e7d32; }

/* ── 额度中心 ── */
.quota-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; }
.quota-card {
  border: 1px solid #ede3d0; border-radius: 14px; padding: 16px;
  background: #fdfbf7; transition: border-color 0.2s;
}
.quota-card.full { border-color: #e6c4bd; background: #fdf6f4; }
.quota-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.quota-icon { font-size: 18px; }
.quota-name { flex: 1; font-size: 14px; font-weight: 600; color: #5c3d20; }
.quota-num { font-size: 13px; color: #8b6240; font-weight: 700; }
.quota-card.full .quota-num { color: #c0392b; }
.quota-bar { height: 8px; background: #f0e8da; border-radius: 999px; overflow: hidden; }
.quota-bar-fill {
  height: 100%; background: linear-gradient(90deg, #c9984a, #8b6240);
  border-radius: 999px; transition: width 0.4s;
}
.quota-bar-fill.over { background: #c0392b; }
.quota-hint { font-size: 12px; color: #c0392b; margin: 8px 0 0; }

/* ── 我的作品 ── */
.work-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; }
.work-card {
  border: 1px solid #ede3d0; border-radius: 14px; overflow: hidden;
  background: #fdfbf7; display: flex; flex-direction: column;
  transition: box-shadow 0.2s, transform 0.2s;
}
.work-card:hover { box-shadow: 0 6px 18px rgba(92, 61, 32, 0.12); transform: translateY(-2px); }
.work-thumb { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; background: #f4ecdd; }
.model-thumb {
  width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
  font-size: 44px; background: linear-gradient(135deg, #f4ecdd, #e9dcc3);
}
.work-meta { padding: 10px 12px 4px; }
.work-name { display: block; font-size: 14px; font-weight: 600; color: #3d1f0a; }
.work-time { font-size: 12px; color: #9a7d64; }
.work-actions { display: flex; gap: 8px; padding: 8px 12px 12px; }
.work-btn {
  flex: 1; padding: 7px 0; border-radius: 8px; font-size: 13px; font-weight: 600;
  cursor: pointer; background: transparent; border: 1px solid #e2d5c3; color: #5c3d20;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}
.work-btn:hover { border-color: #c9984a; color: #3d1f0a; }
.work-btn.danger { color: #c0392b; border-color: #e6c4bd; }
.work-btn.danger:hover { background: #fdf1ef; border-color: #c0392b; }
.profile-empty { font-size: 14px; color: #9a7d64; margin: 0; }

/* ── 成长记录 ── */
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; }
.stat-item {
  text-align: center; padding: 18px 10px; border-radius: 14px;
  background: linear-gradient(135deg, #faf6ef, #f4ecdd);
  border: 1px solid #ede3d0;
}
.stat-item b { display: block; font-size: 26px; color: #8b6240; margin-bottom: 4px; }
.stat-item span { font-size: 13px; color: #9a7d64; }

/* ── 今日任务 ── */
.title-hint { font-size: 12px; color: #b0907a; font-weight: normal; margin-left: 8px; }
.task-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 12px; }
.task-card {
  position: relative;
  display: flex; align-items: center; gap: 12px; padding: 14px 16px;
  border: 1px solid #ede3d0; border-radius: 14px; background: #fdfbf7;
}
/* 悬浮解释气泡（完成条件说明） */
.task-tip {
  position: absolute; left: 50%; bottom: calc(100% + 9px); transform: translateX(-50%);
  background: #3d1f0a; color: #fdf6ec; font-size: 12px; line-height: 1.6;
  padding: 7px 12px; border-radius: 8px; white-space: nowrap;
  opacity: 0; pointer-events: none; transition: opacity 0.15s;
  z-index: 20; box-shadow: 0 4px 14px rgba(61, 31, 10, 0.3);
}
.task-tip::after {
  content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
  border: 5px solid transparent; border-top-color: #3d1f0a;
}
.task-card:hover .task-tip { opacity: 1; }
/* 已领取：卡片与进度条变绿（签到/领取后一眼可见） */
.task-card.claimed { background: #f6faf3; border-color: #d8e8d0; }
.task-card.claimed .task-bar-fill { background: linear-gradient(90deg, #7fb069, #2e7d32); }
.task-card.claimed .task-bonus { color: #2e7d32; }
.task-card.claimed .task-name { color: #2e5d28; }
.task-icon { font-size: 24px; flex-shrink: 0; }
.task-info { flex: 1; min-width: 0; }
.task-name-row { display: flex; align-items: center; gap: 8px; }
.task-name { font-size: 14px; font-weight: 600; color: #3d1f0a; white-space: nowrap; }
.task-bonus { font-size: 12px; color: #c9984a; font-weight: 700; }
.task-progress-text {
  font-size: 12px; color: #9a7d64; display: block; margin: 3px 0 6px;
  line-height: 1.6;
}
.task-bar { height: 6px; background: #f0e8da; border-radius: 999px; overflow: hidden; }
.task-bar-fill { height: 100%; background: linear-gradient(90deg, #c9984a, #8b6240); border-radius: 999px; transition: width 0.4s; }
.task-action { flex-shrink: 0; }

/* ── 阶段任务：只显示当前待完成的一步 ──
   布局规则：空间足够时三项一行；不足时整体换行——目标独占一行，
   奖励 + 按钮在第二行（绝不出现半截折行） */
.task-stage-row {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px;
  padding: 6px 10px; margin-bottom: 8px;
  border-radius: 8px; background: #faf6ef; border: 1px solid #f0e8da;
}
.stage-goal {
  flex: 1 1 170px; min-width: 0; font-size: 12.5px; color: #5c3d20;
  white-space: nowrap;
}
.stage-bonus { font-size: 12px; color: #c9984a; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
.stage-btn { padding: 4px 12px; font-size: 12px; flex-shrink: 0; }
/* 进度条 + 右下角阶段计数（0/3 → 1/3 ...） */
.task-bar-row { display: flex; align-items: center; gap: 8px; }
.task-bar-row .task-bar { flex: 1; }
.task-counter {
  font-size: 12px; font-weight: 700; color: #8b6240;
  padding: 2px 9px; border-radius: 999px; background: #fdf6ec; border: 1px solid #e8d5b8;
  flex-shrink: 0; white-space: nowrap;
}
.work-btn.ready { border-color: #c9984a; color: #8b6240; background: #fdf6ec; }
.work-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.work-btn:disabled:hover { border-color: #e2d5c3; color: #5c3d20; background: transparent; }

/* ── 会员中心 ── */
.vip-status {
  display: flex; align-items: center; gap: 14px; padding: 14px 16px; margin-bottom: 16px;
  border-radius: 14px; background: linear-gradient(135deg, #fdf6ec, #f7ecd7);
  border: 1px solid #e8d5b8;
}
.vip-crown { font-size: 30px; }
.vip-status-title { font-size: 15px; font-weight: 700; color: #8b6240; margin: 0 0 2px; }
.vip-status-meta { font-size: 13px; color: #9a7d64; margin: 0; }
.vip-plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 10px; }
.vip-plan {
  text-align: center; padding: 18px 14px; border-radius: 14px;
  border: 1px solid #ede3d0; background: #fdfbf7;
  transition: box-shadow 0.2s, transform 0.2s;
}
.vip-plan:hover { box-shadow: 0 6px 18px rgba(92, 61, 32, 0.12); transform: translateY(-2px); }
.vip-plan-name { font-size: 14px; font-weight: 600; color: #5c3d20; }
.vip-plan-price { font-size: 26px; font-weight: 700; color: #c0392b; margin: 6px 0; }
.vip-plan-desc { font-size: 12px; color: #9a7d64; margin-bottom: 12px; }
.vip-note { font-size: 12px; color: #b0907a; margin: 4px 0 16px; }
.redeem-row { display: flex; gap: 10px; }
.redeem-input {
  flex: 1; padding: 10px 14px; border: 1px solid #e2d5c3; border-radius: 10px;
  font-size: 14px; color: #3d1f0a; background: #faf8f3; outline: none;
  transition: border-color 0.2s;
}
.redeem-input:focus { border-color: #c9984a; box-shadow: 0 0 0 3px rgba(201, 152, 74, 0.12); }

/* ── 模拟支付弹窗 ── */
.pay-mask {
  position: fixed; inset: 0; z-index: 3000;
  background: rgba(61, 31, 10, 0.45);
  display: flex; align-items: center; justify-content: center;
}
.pay-card {
  background: #fff; border-radius: 20px; padding: 28px 32px;
  width: 90%; max-width: 360px; text-align: center;
  box-shadow: 0 12px 40px rgba(92, 61, 32, 0.25); border: 1px solid #ede3d0;
}
.pay-title { font-size: 18px; color: #3d1f0a; margin: 0 0 6px; }
.pay-plan-name { font-size: 15px; color: #8b6240; font-weight: 600; margin: 0 0 14px; }
.pay-qr {
  width: 120px; height: 120px; margin: 0 auto 14px; border-radius: 14px;
  background: linear-gradient(135deg, #fdf6ec, #f0e2c8);
  display: flex; align-items: center; justify-content: center; font-size: 52px;
  border: 1px dashed #c9984a;
}
.pay-note { font-size: 12px; color: #b0907a; line-height: 1.7; margin: 0 0 20px; }
.pay-actions { display: flex; gap: 12px; }
.pay-actions .profile-btn { flex: 1; }

@media (max-width: 640px) {
  .profile-page { padding: 0 12px; margin-top: 16px; }
  .profile-card { padding: 20px 16px; }
  .account-actions { width: 100%; }
  .account-actions .profile-btn { flex: 1; }
  .redeem-row { flex-direction: column; }
  .task-card { flex-wrap: wrap; }
  .task-action { width: 100%; }
  .task-action .work-btn { width: 100%; }
  .guide-setting-row { flex-direction: column; align-items: stretch; gap: 12px; }
  .guide-volume-box { width: 100%; }
  /* 任务网格最小列宽 420px 在窄屏会横向溢出，改为单列 */
  .task-grid { grid-template-columns: 1fr; }
}

/* ── 语音引导设置 ── */
.guide-setting-row {
  display: flex; align-items: center; gap: 18px;
  padding: 14px 16px; border-radius: 14px;
  background: #fdfbf7; border: 1px solid #ede3d0;
  transition: opacity 0.2s;
}
.guide-setting-row + .guide-setting-row { margin-top: 12px; }
.guide-setting-row.off { opacity: 0.5; }
.guide-setting-info { flex: 1; min-width: 0; }
.guide-setting-name { display: block; font-size: 14px; font-weight: 600; color: #3d1f0a; }
.guide-setting-name b { color: #8b6240; }
.guide-setting-desc { display: block; font-size: 12px; color: #9a7d64; margin-top: 4px; line-height: 1.6; }

/* 开关：隐藏原生 checkbox，轨道+滑块自绘 */
.guide-switch { position: relative; flex-shrink: 0; cursor: pointer; }
.guide-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.guide-switch-track {
  display: block; width: 48px; height: 26px; border-radius: 999px;
  background: #e2d5c3; transition: background 0.2s;
}
.guide-switch-thumb {
  position: absolute; top: 3px; left: 3px; width: 20px; height: 20px;
  border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(92, 61, 32, 0.3);
  transition: left 0.2s;
}
.guide-switch input:checked + .guide-switch-track { background: #c9984a; }
.guide-switch input:checked + .guide-switch-track .guide-switch-thumb { left: 25px; }
.guide-switch input:focus-visible + .guide-switch-track { box-shadow: 0 0 0 3px rgba(201, 152, 74, 0.25); }

/* 音量滑杆 + 试听 */
.guide-volume-box { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.guide-volume-box input[type='range'] {
  width: 150px; accent-color: #c9984a; cursor: pointer;
}
.guide-volume-box input[type='range']:disabled { cursor: not-allowed; }
.guide-volume-box .profile-btn { white-space: nowrap; }
</style>
