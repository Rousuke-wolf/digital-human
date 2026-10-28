import { createLipSyncEnvelope, sampleLipSyncEnvelope } from './lipSync.js'

const TRANSITION_SECONDS = 0.09
const smoothstep = (value) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

function sampleSegment(segment, elapsed) {
  const raw = sampleLipSyncEnvelope(segment.envelope, elapsed + segment.offset)
  // 新块的归一化参考值可能改变，不能用重算的历史振幅替换已经播出的口型。
  // 从上一块真实尾值过渡，且只依赖音频时间，不依赖渲染帧率。
  const blend = segment.boundary === null ? 1 : smoothstep(elapsed / TRANSITION_SECONDS)
  return (segment.boundary ?? 0) * (1 - blend) + raw * blend
}

function pcmBuffer(channels, sampleRate) {
  return {
    sampleRate, length: channels[0].length, duration: channels[0].length / sampleRate,
    numberOfChannels: channels.length, getChannelData: (channel) => channels[channel],
  }
}

// 每个解码块独立排期，保留 250ms PCM 上下文跨块平滑；不用等待整句下载。
export function createStreamingLipSync() {
  const segments = []
  let history = null, lastSegment = null, endAt = null
  return {
    append(buffer, startAt) {
      const continuous = lastSegment && Math.abs(startAt - lastSegment.endAt) < 0.002
        && history.sampleRate === buffer.sampleRate && history.numberOfChannels === buffer.numberOfChannels
      const boundary = continuous
        ? sampleSegment(lastSegment, Math.max(0, lastSegment.duration - 1e-9))
        : null
      const prefixLength = continuous ? history.length : 0
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => {
        const data = new Float32Array(prefixLength + buffer.length)
        if (continuous) data.set(history.getChannelData(channel))
        data.set(buffer.getChannelData(channel), prefixLength)
        return data
      })
      const combined = pcmBuffer(channels, buffer.sampleRate)
      const offset = prefixLength / buffer.sampleRate
      lastSegment = {
        startAt, endAt: startAt + buffer.duration, duration: buffer.duration, offset, boundary,
        envelope: createLipSyncEnvelope(combined, { final: false }),
      }
      segments.push(lastSegment)
      history = pcmBuffer(channels.map((data) => data.slice(-Math.ceil(buffer.sampleRate * 0.25))), buffer.sampleRate)
    },
    end() {
      endAt = lastSegment?.endAt ?? null
    },
    sample(time) {
      if (!Number.isFinite(time)) return 0
      while (segments.length && time >= segments[0].endAt) segments.shift()
      const segment = segments[0]
      if (!segment || time < segment.startAt) return 0
      // EOF 收口按整条时间轴计算：最后一块不足 60ms 时也要跨块连续淡出。
      const tail = endAt === null ? 1 : smoothstep((endAt - time) / 0.06)
      return sampleSegment(segment, time - segment.startAt) * tail
    },
  }
}
