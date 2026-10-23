// ═══════════════════════════════════════════════════════
// useLocale.ts — 全局语言状态（答辩多语言演示核心）
// 模块级单例：导航栏下拉、3D 图谱节点标签、数字人面板三处共享，
// 切换语言后：节点标签翻译 + 数字人欢迎语 / 界面文案同步变化
// ═══════════════════════════════════════════════════════
import { ref } from 'vue'
import { NODE_NAMES, WELCOME, UI_TEXT } from '../data/embroideryI18n'

export type LocaleKey = 'zh' | 'en' | 'ja' | 'yue' | 'bo'

export const LOCALE_OPTIONS: { key: LocaleKey; label: string }[] = [
  { key: 'zh', label: '中文' },
  { key: 'en', label: 'English' },
  { key: 'ja', label: '日本語' },
  { key: 'yue', label: '粤語' },
  { key: 'bo', label: '藏语' },
]

// 系统宣称语种数（后端 CosyVoice 多语种引擎支持 10+ 语言，前端演示覆盖 5 种）
export const SUPPORTED_LANGUAGE_COUNT = 10

const locale = ref<LocaleKey>('zh')

export function setLocale(key: LocaleKey) {
  locale.value = key
}

export function useLocale() {
  /** 节点标签按当前语言取词，无翻译时回退中文名 */
  function nodeName(node: { id: string; name: string }): string {
    if (locale.value === 'zh') return node.name
    return NODE_NAMES[node.id]?.[locale.value] || node.name
  }

  return {
    locale,
    setLocale,
    nodeName,
    welcome: () => WELCOME[locale.value] || WELCOME.zh,
    ui: () => UI_TEXT[locale.value] || UI_TEXT.zh,
  }
}
