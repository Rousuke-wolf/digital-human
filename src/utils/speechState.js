// 振幅来自实际播放的音频；浏览器 speechSynthesis 无音频输出接口，使用近似节奏。
export const speechState = {
  active: false,
  paused: false,
  amplitude: 0,
}

let amplitudeSampler = null

// 渲染时直接采样音频时间轴，不读取另一条 RAF 上一帧留下的振幅。
export function setSpeechSampler(sampler) {
  amplitudeSampler = sampler
}

export function readSpeechAmplitude() {
  if (!speechState.active || speechState.paused) return setSpeechAmplitude(0)
  return setSpeechAmplitude(amplitudeSampler ? amplitudeSampler() : speechState.amplitude)
}

export function setSpeechAmplitude(value) {
  speechState.amplitude = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
  // 保留旧模块兼容入口。
  if (typeof window !== 'undefined') {
    window._ttsAmplitude = speechState.amplitude
    window._teachAmplitude = speechState.amplitude
  }
  return speechState.amplitude
}
