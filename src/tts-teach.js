// 教学页使用同一播放器：真实振幅、取消控制与结束回调保持一致。
import { speak, stop } from './tts.js'

export function teachSpeak(text, onEnd) {
  speak(text, null, null, onEnd)
}

export function teachStop() {
  stop()
}
