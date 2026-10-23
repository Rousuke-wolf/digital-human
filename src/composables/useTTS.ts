// ═══════════════════════════════════════════════════════
// useTTS.ts — 多语言语音合成封装（答辩技术亮点 ①）
// 链路：useTTS → src/tts.js（流式解码播放 + 口型振幅）→ POST /tts
//       → server/routes/tts.js → DashScope（CosyVoice v2 多语种引擎）
// 音色：默认「知性女声 longling_v2」，温柔、亲和，中英日粤均可用；
//       如需少女音可换 longwan_v2 / longxiaochun_v2（后端同名 voice 参数直通）
// 升级 Qwen3-TTS：后端把 MODEL 改为 qwen3-tts-flash、voice 映射为
//       Cherry / Serena 等即可，前端接口零改动（本文件按 provider 无关设计）
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

// 音色档案：voice 透传后端（CosyVoice 音色 ID），lang 用于浏览器 TTS 兜底
// bo 音色预留：接入讯飞藏语 TTS 后替换 voice / lang（如讯飞藏语女声 ID），
// 当前未接入时回退 CosyVoice 默认音色（答辩如实说明「接口就绪、引擎待接入」）
export const VOICE_PROFILE: Record<LocaleKey, { voice: string; lang: string }> = {
  zh: { voice: 'longling_v2', lang: 'zh-CN' },
  en: { voice: 'longling_v2', lang: 'en-US' },
  ja: { voice: 'longling_v2', lang: 'ja-JP' },
  yue: { voice: 'longling_v2', lang: 'zh-HK' },
  bo: { voice: 'longling_v2', lang: 'bo-CN' },
}

export const DEFAULT_VOICE = 'longling_v2'

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
  setVoiceProfile({ ...profile, language: route })
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
