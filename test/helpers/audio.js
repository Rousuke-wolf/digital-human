// 两段语音，中间停顿 200ms；保留起始静音以验证嘴巴不会提前动。
export function makeAudioBuffer(volume = 1) {
  const sampleRate = 1000
  const samples = Float32Array.from({ length: 2400 }, (_, i) => {
    const silent = i < 100 || (i >= 500 && i < 700)
    return silent ? 0 : Math.sin(i * Math.PI / 2) * 0.1 * volume
  })
  return {
    sampleRate, length: samples.length, duration: samples.length / sampleRate,
    numberOfChannels: 1, getChannelData: () => samples,
  }
}
