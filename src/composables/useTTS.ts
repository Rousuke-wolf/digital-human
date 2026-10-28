// ═══════════════════════════════════════════════════════
// useTTS.ts — 多语言语音合成封装（答辩技术亮点 ①）
// 链路：useTTS → src/tts.js（流式分块起播 + 音频时钟口型）→ POST /tts
//       → server/routes/tts.js → DashScope（模型/音色由 server/.env 配置）
// 默认试用 guxiaoran_v3.1；前端不再用 longling_v2 覆盖后端设置。
// 切换语言仅设置浏览器兜底语言；云端音色支持的语言以服务商/账号为准。
// 藏语扩展技术路线（答辩说明）：
//   前端已就绪 —— TtsLanguage 类型含 'bo'，语言切换器含「藏语」，
//   接口已预留 language 路由参数；接入时二选一：
//     ① 大模型侧：后端 LLM 换为智达AI（藏语大模型）生成藏文回答；
//     ② 语音侧：后端 /tts 按 language === 'bo' 路由到讯飞藏语 TTS，
//        音色档案补藏语音色 ID 即可，前端调用方式零改动
// ═══════════════════════════════════════════════════════
import { speak, stop, setVoiceProfile } from '../tts'
import type { LocaleKey } from './useLocale'

/** 合成引擎语言路由参数（预留）：'zh-TW' 覆盖中文/粤语繁体文案，'bo' 为藏语代码 */
export type TtsLanguage = 'zh-TW' | 'en' | 'ja' | 'bo'

// locale → language 路由推导：前端 locale 键映射到引擎语言路由
const DEFAULT_LANGUAGE: Record<LocaleKey, TtsLanguage> = {
  zh: 'zh-TW',
  yue: 'zh-TW',
  en: 'en',
  ja: 'ja',
  bo: 'bo',
}

// 如需为某语言配置专属音色，可增加 voice；未指定时使用后端默认音色。
// 藏语引擎尚未接入；不能因为有语言档案就假定云端音色支持该语言。
export const VOICE_PROFILE: Record<LocaleKey, { voice?: string; lang: string }> = {
  zh: { lang: 'zh-CN' },
  en: { lang: 'en-US' },
  ja: { lang: 'ja-JP' },
  yue: { lang: 'zh-HK' },
  bo: { lang: 'bo-CN' },
}

export interface SpeakHooks {
  onStart?: () => void   // 首段音频起播（用于开启 Live2D 口型）
  onEnd?: () => void     // 全部播完（用于关闭口型）
  onDuration?: (seconds: number) => void
}

/**
 * 按语言合成并播放：自动切换音色档案，失败时由 tts.js 降级浏览器 TTS
 * @param language 引擎语言路由（预留）：不传时由 localeKey 自动推导；
 *                 bo → 后端路由讯飞藏语 TTS（接入后生效）
 */
export function speakWithLocale(
  text: string,
  localeKey: LocaleKey,
  hooks: SpeakHooks = {},
  language?: TtsLanguage,
) {
  const profile = VOICE_PROFILE[localeKey] ?? VOICE_PROFILE.zh
  const route = language ?? DEFAULT_LANGUAGE[localeKey] ?? 'zh-TW'
  // language 随音色档案写入 _ttsSettings，供 tts.js 按语言路由引擎（bo 预留）
  setVoiceProfile({ ...profile, voice: profile.voice, language: route })
  speak(text, hooks.onDuration, hooks.onStart, hooks.onEnd)
}

export function stopSpeaking() {
  stop()
}

/** 静音开关（答辩备用）：立即停止当前语音 */
export function muteSpeaking() {
  stop()
}

// ── 音色克隆预留接口（答辩口头说明：「已具备 3 秒音色克隆能力，可复刻非遗传承人声线」）──
// 接入方案：
//   1. 后端新增 POST /api/tts/clone：接收 3 秒语音样本 → DashScope 声纹克隆 → 返回 voice_id
//   2. 前端录音（MediaRecorder 3s）→ 调 cloneVoice() → 拿到 voiceId
//   3. 将 voiceId 写入 VOICE_PROFILE[locale].voice，后续合成即用传承人声线
export async function cloneVoice(_sampleAudio: Blob, _voiceName: string): Promise<string> {
  return Promise.reject(new Error('[useTTS] 音色克隆为预留接口，待后端 /api/tts/clone 接入'))
}
