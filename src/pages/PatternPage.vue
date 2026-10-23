<template>
  <div class="app-wrapper page-pattern">
    <Navbar />

    <main class="pattern-main">
      <!-- 左侧：创作参数设置区 -->
      <aside class="param-panel">
        <div class="param-head">
          <h2 class="param-title">AI 纹样共创</h2>
          <p class="param-sub">输入灵感，AI 帮你设计专属非遗刺绣纹样</p>
        </div>

        <div class="param-field">
          <label class="param-label">纹样主题 <span class="param-required">*</span></label>
          <input
            v-model="theme"
            type="text"
            class="param-input"
            placeholder="如：牡丹、凤凰、蝴蝶、锦鲤…"
            maxlength="30"
          />
        </div>

        <div class="param-field">
          <label class="param-label">民族元素（可多选）</label>
          <div class="chip-wrap">
            <div class="chip-group">
              <button
                v-for="el in ELEMENT_OPTIONS"
                :key="el"
                class="chip"
                :class="{ active: selectedElements.includes(el) }"
                @click="toggleElement(el)"
              >{{ el }}</button>
              <button
                v-for="el in selectedExtraElements"
                :key="el"
                class="chip"
                :class="{ active: true }"
                @click="toggleElement(el)"
              >{{ el }}</button>
              <button class="chip more-chip" title="更多民族" @click="toggleElementPop">…</button>
            </div>

            <!-- 更多民族小弹窗 -->
            <div v-if="elementPopOpen" class="element-pop">
              <div class="element-pop-head">更多民族 · 均有刺绣技艺传承（点选可多选）</div>
              <div class="element-pop-grid">
                <button
                  v-for="el in EXTRA_ELEMENT_OPTIONS"
                  :key="el"
                  class="pop-chip"
                  :class="{ active: selectedElements.includes(el) }"
                  @click="toggleElement(el)"
                >{{ el }}</button>
              </div>
            </div>
          </div>
        </div>

        <div class="param-field">
          <label class="param-label">补充关键词</label>
          <input
            v-model="keywords"
            type="text"
            class="param-input"
            placeholder="如：吉祥纹、云纹、水波纹…"
            maxlength="40"
          />
        </div>

        <div class="param-field">
          <label class="param-label">刺绣类型</label>
          <div class="style-grid">
            <button
              v-for="s in STYLE_OPTIONS"
              :key="s.id"
              class="style-card"
              :class="{ active: style === s.id }"
              @click="style = s.id"
            >
              <span class="style-name">{{ s.name }}</span>
              <span class="style-desc">{{ s.desc }}</span>
            </button>
          </div>
        </div>

        <div class="param-field">
          <label class="param-label">纹样密度</label>
          <div class="seg-group">
            <button
              v-for="d in DENSITY_OPTIONS"
              :key="d.id"
              class="seg-btn"
              :class="{ active: density === d.id }"
              @click="density = d.id"
            >{{ d.label }}</button>
          </div>
        </div>

        <div class="param-field">
          <label class="param-label">构图布局</label>
          <div class="seg-group">
            <button
              v-for="l in LAYOUT_OPTIONS"
              :key="l.id"
              class="seg-btn"
              :class="{ active: layout === l.id }"
              @click="layout = l.id"
            >{{ l.label }}</button>
          </div>
        </div>

        <button
          class="gen-btn"
          :disabled="status === 'generating' || !theme.trim()"
          @click="onGenerate"
        >
          {{ status === 'generating' ? '生成中…' : '生成纹样' }}
        </button>
        <p class="gen-hint">AI 绘制约需 20~60 秒，请耐心等待</p>
      </aside>

      <!-- 右侧：作品预览与编辑区 -->
      <section class="preview-panel">
        <!-- 空态：默认展示框（与左侧参数栏等高，生成后由真实结果覆盖） -->
        <div v-if="status === 'idle'" class="preview-empty">
          <div class="empty-pattern-frame">
            <div class="mockup-img">
              <div class="empty-icon">
                <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 20V7" />
                  <path d="m5 4 14 2-3 3-8-1z" />
                  <path d="M19 6c-1.5 4.5-4 7.5-7 9" />
                </svg>
              </div>
              <p class="empty-title">等待灵感</p>
              <p class="empty-desc">你的专属非遗纹样将在这里呈现<br>填写左侧参数，点击「生成纹样」开始创作</p>
            </div>
            <div class="mockup-bar">
              <span>配色调整</span><span class="mockup-dot">·</span>
              <span>AI 解读</span><span class="mockup-dot">·</span>
              <span>下载分享</span>
              <span class="mockup-bar-hint">生成后自动呈现</span>
            </div>
          </div>
          <div class="inspo-section">
            <div class="inspo-title">灵感示例 · 点击填入参数</div>
            <div class="inspo-grid">
              <button
                v-for="ex in INSPO_EXAMPLES"
                :key="ex.theme"
                class="inspo-card"
                @click="fillInspo(ex)"
              >
                <span class="inspo-text">{{ ex.theme }} · {{ styleNameOf(ex.style) }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 生成中：水墨晕染 + 金线穿梭（替代普通旋转加载圈） -->
        <div v-else-if="status === 'generating'" class="preview-loading">
          <div class="ink-loader" aria-hidden="true">
            <span class="ink-blob"></span>
            <span class="gold-thread"></span>
          </div>
          <p class="loading-title">AI 正在创作中…（已等待 {{ elapsed }}s）</p>
          <p class="loading-desc">{{ loadingHint }}</p>
        </div>

        <!-- 失败 -->
        <div v-else-if="status === 'error'" class="preview-empty">
          <div class="empty-pattern-frame">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" x2="12" y1="9" y2="13" />
                <line x1="12" x2="12.01" y1="17" y2="17" />
              </svg>
            </div>
            <p class="empty-title">生成失败</p>
            <p class="empty-desc">可能是网络波动或图片配额问题<br>稍后重试，或调整参数后再生成</p>
            <button class="retry-btn" @click="onGenerate">重新生成</button>
          </div>
        </div>

        <!-- 成品 -->
        <div v-else class="preview-done">
          <div class="preview-img-wrap">
            <img
              class="preview-img"
              :src="imageUrl"
              alt="AI 生成纹样"
              :style="{ filter: filterStyle }"
              @click="openImagePreview(imageUrl)"
            />
            <span class="preview-tip">点击图片可放大查看</span>
          </div>

          <!-- 二次编辑：配色调整 -->
          <div class="edit-panel">
            <div class="edit-title">配色调整</div>
            <div class="slider-grid">
              <div v-for="f in FILTER_FIELDS" :key="f.key" class="slider-item">
                <label class="slider-label">{{ f.label }}（{{ f.disp(filters[f.key]) }}）</label>
                <input
                  v-model.number="filters[f.key]"
                  type="range"
                  class="edit-slider"
                  :min="f.min"
                  :max="f.max"
                  :step="f.step"
                />
              </div>
            </div>
            <button class="reset-filter-btn" @click="resetFilters">重置配色</button>
          </div>

          <!-- AI 一体化解读 -->
          <div class="analysis-panel">
            <div class="edit-title">AI 纹样解读</div>
            <div v-if="analysis" class="analysis-grid">
              <div class="analysis-card">
                <div class="analysis-head">配色方案</div>
                <p class="analysis-text">{{ analysis.colorScheme }}</p>
              </div>
              <div class="analysis-card">
                <div class="analysis-head">文化释义</div>
                <p class="analysis-text">{{ analysis.meaning }}</p>
              </div>
              <div class="analysis-card">
                <div class="analysis-head">推荐针法</div>
                <p class="analysis-text">{{ analysis.stitches }}</p>
              </div>
            </div>
            <p v-else class="analysis-empty">解读生成失败，重新生成纹样时会再次尝试</p>
          </div>

          <!-- 操作按钮（极简线性图标） -->
          <div class="action-row">
            <button class="action-btn primary" @click="onGenerate">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
              重新生成
            </button>
            <button class="action-btn" @click="saveWork">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
              保存作品
            </button>
            <button class="action-btn" @click="downloadImage">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
              下载
            </button>
            <button class="action-btn" @click="shareWork">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" x2="12" y1="2" y2="15" /></svg>
              分享
            </button>
          </div>
        </div>
      </section>
    </main>

    <!-- 作品库 -->
    <section class="works-panel">
      <div class="works-head">
        <h3 class="works-title">我的作品</h3>
        <span class="works-count">共 {{ works.length }} 件</span>
      </div>
      <div v-if="works.length" class="works-grid">
        <div v-for="w in worksWithLabel" :key="w.id" class="work-card">
          <img class="work-thumb" :src="w.url" :alt="w.theme" @click="loadWorkToPreview(w)" />
          <div class="work-info">
            <div class="work-theme">{{ w.theme }}</div>
            <div class="work-meta">{{ w.styleLabel }} · {{ w.createdLabel }}</div>
            <div class="work-actions">
              <button class="work-btn" @click="loadWorkToPreview(w)">查看</button>
              <button class="work-btn danger" @click="deleteWork(w.id)">删除</button>
            </div>
          </div>
        </div>
      </div>
      <p v-else class="works-empty">还没有保存的作品，生成满意的纹样后点击「保存作品」即可收藏到这里</p>
    </section>

    <Lightbox />

    <!-- 轻提示 -->
    <div v-if="toastMsg" class="pattern-toast">{{ toastMsg }}</div>
  </div>
</template>

<script setup>
// PatternPage.vue — AI 纹样共创页（必做项 2）
// 图片生成走 /api/ai/image（万相，服务端提交+轮询，约 20~60 秒）；
// 配色方案/文化释义/推荐针法由对话模型（qwen3.8-flash）同步生成；
// 作品库用 localStorage 持久化（生成的图片 URL 为临时签名地址，仅演示有效）
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import Navbar from '../components/Navbar.vue'
import Lightbox from '../components/ui/Lightbox.vue'
import { openImagePreview } from '../utils/lightboxBus.js'
import { useAuth } from '../composables/useAuth.js'
import { useLoginPrompt } from '../composables/useLoginPrompt.js'
import { authHeaders } from '../utils/guestId.js'
import { userAPI } from '../api/client.js'
import { guideOnPageEnter, guidePatternGenerate, guidePatternDone } from '../utils/voiceGuide.js'
import '../page/pattern/index.css'

const { isLoggedIn } = useAuth()
const { promptLogin } = useLoginPrompt()

// 图片生成：直接走后端代理，与 qwen.js 的 generateImage 相同逻辑。
// 注意：不要 import qwen.js —— 它内含中文 systemPrompt，卷进本页 chunk 会
// 触发 Rolldown 多字节字符串 hash 占位符 panic（vite8/rolldown 已知 bug）
// 额度/登录类错误（401/429 带 code）上抛，由 onGenerate 按码处理
async function generatePatternImage(prompt) {
  try {
    const res = await fetch('/api/ai/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ prompt }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (json.code) {
        const err = new Error(json.message || '图片生成失败')
        err.code = json.code
        err.status = res.status
        throw err
      }
      console.warn('[pattern] 图片生成失败:', json.message || res.status)
      return null
    }
    return json.url || null
  } catch (e) {
    if (e.code) throw e   // 业务码错误继续上抛
    console.warn('[pattern] 图片生成请求异常:', e.message)
    return null
  }
}

// ── 常量选项 ──────────────────────────────────────
const ELEMENT_OPTIONS = ['苗族', '彝族', '藏族', '壮族', '傣族', '汉族']

// 更多民族（点「…」弹出）：均为有明确刺绣技艺传承的民族。
// 其中水族马尾绣/土族盘绣/羌绣/满绣/蒙古族刺绣/维吾尔族刺绣/哈萨克毡绣布绣/
// 柯尔克孜族刺绣/瑶族花瑶挑花为国家级非遗；侗绣/白族/布依族/锡伯族有史料记载
// （来源：中国非物质文化遗产网 ihchina.cn）
const EXTRA_ELEMENT_OPTIONS = [
  '满族', '瑶族', '侗族', '白族', '水族', '羌族', '土族',
  '布依族', '蒙古族', '维吾尔族', '哈萨克族', '柯尔克孜族', '锡伯族',
]

// 刺绣类型单一维度（原「风格约束」混入水墨/国潮等画风概念，已统一为刺绣类型）
const STYLE_OPTIONS = [
  { id: 'miao', name: '苗绣', desc: '色彩浓烈 · 民族图腾' },
  { id: 'su',   name: '苏绣', desc: '丝线光泽 · 写实雅致' },
  { id: 'xiang', name: '湘绣', desc: '狮虎题材 · 层次丰富' },
  { id: 'shu',  name: '蜀绣', desc: '明快清丽 · 针脚细腻' },
  { id: 'yue',  name: '粤绣', desc: '金银垫绣 · 富丽繁密' },
  { id: 'jing', name: '京绣', desc: '宫廷气派 · 金线龙纹' },
]

// 灵感示例：点击填入左侧参数（空态占位 + 降低使用门槛）
const INSPO_EXAMPLES = [
  { theme: '牡丹', style: 'su',   keywords: '团花纹样' },
  { theme: '凤凰', style: 'miao', keywords: '吉祥图腾' },
  { theme: '锦鲤', style: 'shu',  keywords: '水波纹' },
  { theme: '龙纹', style: 'jing', keywords: '云纹' },
  { theme: '瑞狮', style: 'xiang', keywords: '' },
  { theme: '山茶花', style: 'yue', keywords: '金银线' },
]

const DENSITY_OPTIONS = [
  { id: 'sparse', label: '稀疏留白' },
  { id: 'mid',    label: '疏密适中' },
  { id: 'dense',  label: '密集饱满' },
]

const LAYOUT_OPTIONS = [
  { id: 'single',   label: '独立纹样' },
  { id: 'sym',      label: '对称构图' },
  { id: 'halfDrop', label: '二方连续' },
  { id: 'fullDrop', label: '四方连续' },
]

const STYLE_PROMPT = {
  miao:  '苗族刺绣风格，色彩浓烈饱和，几何纹样与民族图腾元素',
  su:    '苏绣风格，丝线光泽细腻，写实雅致，淡雅配色',
  xiang: '湘绣风格，针法多变，色彩鲜明，狮虎题材，层次丰富',
  shu:   '蜀绣风格，用色明快清丽，鲤鱼芙蓉题材，针脚整齐细腻',
  yue:   '粤绣风格，金银线垫绣，构图繁密热闹，色彩富丽堂皇',
  jing:  '京绣风格，宫廷气派，金线盘绕，龙纹云纹吉祥图案',
}

const LAYOUT_PROMPT = {
  single:   '独立纹样居中构图',
  sym:      '左右对称构图',
  halfDrop: '二方连续纹样',
  fullDrop: '四方连续纹样',
}

const DENSITY_PROMPT = {
  sparse: '纹样稀疏留白',
  mid:    '纹样疏密适中',
  dense:  '纹样密集饱满',
}

// 配色调整滑杆定义（实时 CSS filter，预览与下载一致）
const FILTER_FIELDS = [
  { key: 'hue',        label: '色相', min: -180, max: 180, step: 1,   disp: (v) => `${v}°` },
  { key: 'saturate',   label: '饱和度', min: 0,  max: 200, step: 1,   disp: (v) => `${v}%` },
  { key: 'brightness', label: '亮度', min: 0,  max: 200, step: 1,   disp: (v) => `${v}%` },
  { key: 'contrast',   label: '对比度', min: 0,  max: 200, step: 1,   disp: (v) => `${v}%` },
]

const WORKS_KEY = 'zhichuan-pattern-works'

// ── 创作参数状态 ──────────────────────────────────
const theme = ref('')
const selectedElements = ref([])
const keywords = ref('')
const style = ref('miao')
const density = ref('mid')
const layout = ref('single')
const elementPopOpen = ref(false)   // 更多民族弹窗

// 已选中的「更多民族」项：在主 chip 区以选中态显示，便于看到/取消
const selectedExtraElements = computed(() =>
  EXTRA_ELEMENT_OPTIONS.filter((el) => selectedElements.value.includes(el)))

// ── 预览状态 ──────────────────────────────────────
const status = ref('idle')   // idle | generating | done | error
const elapsed = ref(0)
const imageUrl = ref('')
const analysis = ref(null)
const filters = reactive({ hue: 0, saturate: 100, brightness: 100, contrast: 100 })
const toastMsg = ref('')

let elapsedTimer = null
let toastTimer = null

const styleLabel = computed(() => STYLE_OPTIONS.find((s) => s.id === style.value)?.name ?? '')
const filterStyle = computed(() =>
  `hue-rotate(${filters.hue}deg) saturate(${filters.saturate}%) brightness(${filters.brightness}%) contrast(${filters.contrast}%)`)

const loadingHints = [
  '正在构思纹样构图…',
  'AI 正在绘制线条与配色…',
  '精细渲染中，即将完成…',
]
const loadingHint = computed(() => {
  if (!elapsed.value) return loadingHints[0]
  return loadingHints[Math.min(Math.floor(elapsed.value / 15), loadingHints.length - 1)]
})

function styleNameOf(id) {
  return STYLE_OPTIONS.find((s) => s.id === id)?.name ?? ''
}

// 灵感示例：一键填入参数（不自动生成，让用户确认后再点生成）
function fillInspo(ex) {
  theme.value = ex.theme
  style.value = ex.style
  keywords.value = ex.keywords ?? ''
  selectedElements.value = []
  density.value = 'mid'
  layout.value = 'single'
  toast('已填入示例参数，点击「生成纹样」开始创作')
}

function toggleElement(el) {
  const i = selectedElements.value.indexOf(el)
  if (i >= 0) selectedElements.value.splice(i, 1)
  else selectedElements.value.push(el)
}

function toggleElementPop() {
  elementPopOpen.value = !elementPopOpen.value
}

// 点击弹窗外部关闭（与导航条退出弹窗同款交互）
function onDocClick(e) {
  if (elementPopOpen.value && !e.target.closest('.chip-wrap')) {
    elementPopOpen.value = false
  }
}

function resetFilters() {
  filters.hue = 0
  filters.saturate = 100
  filters.brightness = 100
  filters.contrast = 100
}

function toast(text) {
  toastMsg.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 2600)
}

// ── 提示词组装（服务端限制 ≤200 字）──
function buildPrompt() {
  const stylePrompt = STYLE_PROMPT[style.value] ?? STYLE_PROMPT.miao
  const parts = [
    stylePrompt,
    `纹样主题：${theme.value.trim()}`,
    selectedElements.value.length ? `民族元素：${selectedElements.value.join('、')}` : '',
    keywords.value.trim() ? `关键词：${keywords.value.trim()}` : '',
    LAYOUT_PROMPT[layout.value],
    DENSITY_PROMPT[density.value],
    '精美刺绣纹样，高清',
  ]
  return parts.filter(Boolean).join('，').slice(0, 200)
}

// ── AI 一体化解读（与图片生成并行，不额外拖慢等待）──
async function analyzePattern() {
  const sys = '你是非遗刺绣纹样专家。根据用户提供的纹样创作参数，输出该纹样的专业配色方案、文化释义、推荐针法方案，各 30~60 字。必须只返回如下 JSON 格式，不要输出任何其他内容：{"colorScheme":"","meaning":"","stitches":""}'
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        // 与聊天主流程共用对话模型
        model: 'qwen3.8-flash',
        response_format: { type: 'json_object' },
        // 计入纹样额度（需登录），不占对话额度
        quota_feature: 'pattern',
        messages: [
          { role: 'system', content: sys },
          {
            role: 'user',
            content: `主题：${theme.value.trim()}；风格：${styleLabel.value}；民族元素：${selectedElements.value.join('、') || '无'}；关键词：${keywords.value.trim() || '无'}`,
          },
        ],
      }),
    })
    const json = await res.json().catch(() => ({}))
    const raw = json.choices?.[0]?.message?.content ?? ''
    const data = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim())
    return {
      colorScheme: typeof data.colorScheme === 'string' ? data.colorScheme : '—',
      meaning: typeof data.meaning === 'string' ? data.meaning : '—',
      stitches: typeof data.stitches === 'string' ? data.stitches : '—',
    }
  } catch (e) {
    console.warn('[pattern] 纹样解读生成失败:', e.message)
    return null
  }
}

// ── 生成主流程：图片 + 解读并行 ───────────────────
async function onGenerate() {
  if (status.value === 'generating') return
  if (!theme.value.trim()) {
    toast('请先填写纹样主题')
    return
  }
  // 额度体系（必做项 4）：纹样生成需登录，游客弹登录引导（不发请求）
  if (!isLoggedIn.value) {
    promptLogin('pattern')
    return
  }

  // 数字人反馈：开始创作
  guidePatternGenerate()

  status.value = 'generating'
  elapsed.value = 0
  clearInterval(elapsedTimer)
  elapsedTimer = setInterval(() => { elapsed.value++ }, 1000)

  try {
    const prompt = buildPrompt()
    const [url, ana] = await Promise.all([
      generatePatternImage(prompt),
      analyzePattern(),
    ])
    imageUrl.value = url
    analysis.value = ana
    resetFilters()
    status.value = url ? 'done' : 'error'
    // 数字人反馈：生成成功后简单点评
    if (url) guidePatternDone(theme.value.trim())
    else toast('图片生成失败，请稍后重试')
  } catch (e) {
    console.error('[pattern] 生成失败:', e.message)
    status.value = 'error'
    // 额度/登录类错误：提示文案或登录引导（如 token 中途失效）
    if (e.code === 'LOGIN_REQUIRED') promptLogin('pattern')
    else if (e.code === 'QUOTA_EXCEEDED') toast(e.message)
  } finally {
    clearInterval(elapsedTimer)
  }
}

// ── 作品库（localStorage 持久化）──
function loadWorks() {
  try {
    const raw = localStorage.getItem(WORKS_KEY)
    const data = raw ? JSON.parse(raw) : []
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

const works = ref(loadWorks())

function persistWorks() {
  try { localStorage.setItem(WORKS_KEY, JSON.stringify(works.value)) } catch {}
}

async function saveWork() {
  if (!imageUrl.value) return
  const work = {
    id: Date.now(),
    url: imageUrl.value,
    theme: theme.value.trim(),
    style: style.value,
    styleLabel: styleLabel.value,
    elements: [...selectedElements.value],
    keywords: keywords.value.trim(),
    density: density.value,
    layout: layout.value,
    filters: { ...filters },
    analysis: analysis.value,
    createdAt: new Date().toISOString(),
  }
  works.value.unshift(work)
  works.value = works.value.slice(0, 30)   // 最多保留 30 件
  persistWorks()
  toast('已保存到我的作品')
  // 额度体系（必做项 4）：登录状态下同步上云（静默失败，本地保留）
  if (isLoggedIn.value) {
    try {
      const res = await userAPI.addWork({
        type: 'pattern',
        name: work.theme || '未命名纹样',
        data: work.url,
        payload: {
          style: work.style,
          styleLabel: work.styleLabel,
          elements: work.elements,
          keywords: work.keywords,
          density: work.density,
          layout: work.layout,
          filters: work.filters,
          analysis: work.analysis,
          createdAt: work.createdAt,
        },
      })
      if (res.work?.id) {
        work.cloudId = res.work.id
        persistWorks()
      }
    } catch {
      // 后端不可用时本地仍保留作品
    }
  }
}

function deleteWork(id) {
  if (!window.confirm('确定删除这件作品吗？')) return
  const target = works.value.find((w) => w.id === id)
  works.value = works.value.filter((w) => w.id !== id)
  persistWorks()
  // 云端作品同步删除（静默失败，下次 loadCloudWorks 会以云端为准回填）
  if (target?.cloudId && isLoggedIn.value) {
    userAPI.deleteWork(target.cloudId).catch(() => {})
  }
  toast('作品已删除')
}

// 查看历史作品：恢复预览与参数
function loadWorkToPreview(w) {
  theme.value = w.theme
  // 旧存档可能保存了已下线的类型（水墨/国潮），回退为苗绣兜底
  style.value = STYLE_PROMPT[w.style] ? w.style : 'miao'
  selectedElements.value = [...(w.elements ?? [])]
  keywords.value = w.keywords ?? ''
  density.value = w.density ?? 'mid'
  layout.value = w.layout ?? 'single'
  imageUrl.value = w.url
  analysis.value = w.analysis ?? null
  Object.assign(filters, w.filters ?? { hue: 0, saturate: 100, brightness: 100, contrast: 100 })
  status.value = 'done'
  document.querySelector('.pattern-main')?.scrollIntoView({ behavior: 'smooth' })
}

// ── 下载（含当前配色滤镜效果）──
async function downloadImage() {
  if (!imageUrl.value) return
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl.value
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.filter = filterStyle.value
    ctx.drawImage(img, 0, 0)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `智传非遗纹样_${Date.now()}.png`
    a.click()
    URL.revokeObjectURL(a.href)
    toast('下载已开始')
  } catch {
    // 跨域受限时退化为新窗口打开（OSS 图片一般可直接保存）
    window.open(imageUrl.value, '_blank')
    toast('已在新窗口打开图片，长按/右键即可保存')
  }
}

// ── 分享 ─────────────────────────────────────────
async function shareWork() {
  if (!imageUrl.value) return
  const shareData = {
    title: '智传非遗 · AI 纹样共创',
    text: `我用智传非遗生成了一枚「${styleLabel.value}」${theme.value.trim()}纹样，快来一起创作吧！`,
    url: imageUrl.value,
  }
  let shared = false
  if (navigator.share) {
    try { await navigator.share(shareData); shared = true } catch { /* 用户取消分享 */ }
  } else {
    try {
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`)
      toast('分享链接已复制，去粘贴给朋友吧')
      shared = true
    } catch {
      toast('当前浏览器不支持分享')
    }
  }
  // 成长体系：分享成功后上报任务事件（仅登录；fire-and-forget）
  if (shared && isLoggedIn.value) {
    userAPI.tasksEvent('share').catch(() => {})
  }
}

// 展示时给历史作品算好日期标签
const worksWithLabel = computed(() =>
  works.value.map((w) => ({
    ...w,
    createdLabel: new Date(w.createdAt).toLocaleDateString('zh-CN'),
  })))

// 个人中心「复用」跳转标记（sessionStorage，跨页传作品参数）
const REUSE_KEY = 'zhichuan-pattern-reuse'

onMounted(() => {
  document.addEventListener('click', onDocClick)
  // 语音引导：首次进入播报共创页介绍，之后每次进入随机问候
  guideOnPageEnter('create')
  // 个人中心「复用」：恢复指定作品到预览区，继续二次创作
  try {
    const raw = sessionStorage.getItem(REUSE_KEY)
    sessionStorage.removeItem(REUSE_KEY)
    if (raw) {
      loadWorkToPreview(JSON.parse(raw))
      toast('已恢复作品参数，可继续创作')
    }
  } catch { /* 数据损坏时忽略 */ }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  clearInterval(elapsedTimer)
  clearTimeout(toastTimer)
})
</script>
