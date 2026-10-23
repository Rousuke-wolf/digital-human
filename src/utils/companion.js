// companion.js — 绫韵「情感化陪伴」逻辑
// 时间段问候 + 节日问候 + 进入页面的语音问好。
// 农历节日无法用 Date 直接计算，内置 2026-2027 年公历映射表
// （依据中国历法 UTC+8，与国务院节假日安排一致；到期后需补充后续年份）。

// ── 时间段问候 ──────────────────────────────────────
export function getTimeGreeting(date = new Date()) {
  const h = date.getHours()
  if (h >= 5 && h < 9) return '早上好呀～新的一天，适合从一针一线开始 🌅'
  if (h >= 9 && h < 12) return '上午好～绣绷已经备好，随时可以开始今天的刺绣之旅 🧵'
  if (h >= 12 && h < 14) return '中午好～记得休息一下，午后适合听我讲讲针法的故事'
  if (h >= 14 && h < 18) return '下午好～光线正好，正是练习针法的好时候 ✨'
  if (h >= 18 && h < 22) return '晚上好～忙碌了一天，来听个刺绣小知识放松一下吧'
  return '夜深了～注意休息，明天再来一起绣花哦 🌙'
}

// ── 农历节日（公历映射表，来源见文件头注释）──
const LUNAR_FESTIVALS = {
  '2026': {
    '02-16': { name: '除夕', greeting: '除夕快乐！今夜守岁，愿来年如锦上添花 🏮' },
    '02-17': { name: '春节', greeting: '新春快乐！绫韵祝您马年吉祥，针脚生花 🧧' },
    '03-03': { name: '元宵节', greeting: '元宵节快乐！月圆人团圆，愿生活像锁边针一样圆满 🏮' },
    '06-19': { name: '端午节', greeting: '端午安康！粽叶飘香，愿平安像回针一样扎实 🐉' },
    '08-19': { name: '七夕节', greeting: '七夕快乐～乞巧节正是展示绣艺的好日子，愿你心灵手巧 💕' },
    '09-25': { name: '中秋节', greeting: '中秋快乐！月满人团圆，如苏绣团扇般圆满 🥮' },
    '10-18': { name: '重阳节', greeting: '重阳安康！登高望远，菊纹绣样正应景 🌼' },
  },
  '2027': {
    '02-05': { name: '除夕', greeting: '除夕快乐！守岁迎新，来年绣出更多美好 🏮' },
    '02-06': { name: '春节', greeting: '新春快乐！绫韵祝您羊年顺遂，绣样吉祥 🧧' },
    '02-20': { name: '元宵节', greeting: '元宵节快乐！花灯如锦，团圆美满 🏮' },
    '06-09': { name: '端午节', greeting: '端午安康！粽香满院，平安如意 🐉' },
    '08-08': { name: '七夕节', greeting: '七夕快乐～乞巧之夜，愿绣艺精进 💕' },
    '09-15': { name: '中秋节', greeting: '中秋快乐！月圆绣圆，阖家团圆 🥮' },
    '10-08': { name: '重阳节', greeting: '重阳安康！登高赏菊，吉祥长久 🌼' },
  },
}

// ── 公历节日 ────────────────────────────────────────
const SOLAR_FESTIVALS = {
  '01-01': { name: '元旦', greeting: '元旦快乐！新的一年，从新的针脚开始 🎉' },
  '03-08': { name: '妇女节', greeting: '节日快乐！致敬每一位心灵手巧的她 💐' },
  '05-01': { name: '劳动节', greeting: '劳动节快乐！勤劳的双手最美丽 🧵' },
  '06-01': { name: '儿童节', greeting: '儿童节快乐～带小朋友来体验刺绣的乐趣吧 🎈' },
  '09-10': { name: '教师节', greeting: '教师节快乐！致敬传道授业的匠人精神 📚' },
  '10-01': { name: '国庆节', greeting: '国庆快乐！锦绣中华，绣美山河 🇨🇳' },
}

function mmdd(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${m}-${d}`
}

// 今天的节日（农历优先，其次公历）；无则 null
export function getFestival(date = new Date()) {
  const year = String(date.getFullYear())
  return LUNAR_FESTIVALS[year]?.[mmdd(date)] || SOLAR_FESTIVALS[mmdd(date)] || null
}

// ── 语音问好（进入页面时 TTS 播报，必须简短；节日优先）──
export function getVoiceGreeting(date = new Date()) {
  const fest = getFestival(date)
  if (fest) return `今天是${fest.name}噢，${fest.name}快乐！`
  const h = date.getHours()
  if (h >= 5 && h < 9) return '早上好呀～'
  if (h >= 9 && h < 12) return '上午好～'
  if (h >= 12 && h < 14) return '中午好～'
  if (h >= 14 && h < 18) return '下午好～'
  if (h >= 18 && h < 22) return '晚上好～'
  return '夜深了，注意休息哦～'
}
