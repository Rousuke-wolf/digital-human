// 振幅来自实际播放的音频；浏览器 speechSynthesis 无音频输出接口，使用近似节奏。
export const speechState = {
  active: false,
  paused: false,
  amplitude: 0,
}

export function setSpeechAmplitude(value) {
  speechState.amplitude = Math.max(0, Math.min(1, value))
  // 保留旧模块兼容入口。
  if (typeof window !== 'undefined') {
    window._ttsAmplitude = speechState.amplitude
    window._teachAmplitude = speechState.amplitude
  }
}
