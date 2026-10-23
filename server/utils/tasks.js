// tasks.js — 每日任务定义与进度（成长体系，必做项 4 扩展）
// 任务奖励是「当日额度加成」：领取后当天生效，次日清零。
// 进度来源三种：
//   derive — 服务端从现有数据推导（chat 数对话用量，无需前端上报）
//   event  — 前端上报事件（graph 图谱探索 / share 分享作品）
//   button — 前端按钮触发即完成（checkin 签到）
import '../env.js'
import { query } from '../db.js'

// 本地日期键（UTC+8）：额度/任务按日重置的统一口径（quota.js 从本模块导入）
export function todayKey() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

// 任务定义：除签到外均为「阶段任务」——每个阶段有独立完成目标与奖励，
// 达标后可分别领取（写 user_task_claims，当日生效），阶段数值在此集中调整
export const TASKS = {
  checkin: {
    key: 'checkin', name: '每日签到', icon: '📅', source: 'button',
    desc: '每日点击签到即可领取，对话额度 +20',
    stages: [
      { label: '每日签到', target: 1, bonus: { chat: 20 } },
    ],
  },
  chat: {
    key: 'chat', name: '请教绫韵', icon: '💬', source: 'derive',
    desc: '去刺绣文化页与绫韵完成对话',
    stages: [
      { label: '对话 1 次', target: 1, bonus: { pattern: 2 } },
      { label: '对话 3 次', target: 3, bonus: { pattern: 3 } },
      { label: '对话 6 次', target: 6, bonus: { pattern: 4 } },
    ],
  },
  graph: {
    key: 'graph', name: '初探绣坊', icon: '🌟', source: 'event',
    desc: '去知识图谱页（2D/3D 均可）探索不同的节点',
    stages: [
      { label: '探索 1 个节点', target: 1, bonus: { chat: 10 } },
      { label: '探索 3 个节点', target: 3, bonus: { pattern: 3 } },
      { label: '探索 6 个节点', target: 6, bonus: { pattern: 4 } },
    ],
  },
  share: {
    key: 'share', name: '分享传艺', icon: '📤', source: 'event',
    desc: '在纹样共创页生成纹样并分享',
    stages: [
      { label: '分享 1 次', target: 1, bonus: { model3d: 1 } },
      { label: '分享 2 次', target: 2, bonus: { model3d: 2 } },
    ],
  },
}

// 上报事件的任务白名单（POST /api/user/tasks/event 用）
export const EVENT_TASKS = ['graph', 'share']

// 今日任务进度（各 key 的 0~target 计数）
export async function taskProgress(userId, day = todayKey()) {
  const progress = {}
  for (const t of Object.values(TASKS)) progress[t.key] = 0

  // derive：chat 从对话用量推导
  const [chatRows] = await query(
    'SELECT COUNT(*) as cnt FROM usage_events WHERE user_id = ? AND feature = ? AND day = ?',
    [userId, 'chat', day]
  )
  progress.chat = chatRows[0]?.cnt ?? 0

  // event：graph/share 数事件表
  const [evRows] = await query(
    'SELECT task_key, COUNT(*) as cnt FROM user_task_events WHERE user_id = ? AND day = ? GROUP BY task_key',
    [userId, day]
  )
  for (const r of evRows) {
    if (r.task_key in progress) progress[r.task_key] = r.cnt
  }

  return progress
}

// 当日已领取的任务 key 列表
export async function claimedTasks(userId, day = todayKey()) {
  const [rows] = await query(
    'SELECT task_key FROM user_task_claims WHERE user_id = ? AND day = ?',
    [userId, day]
  )
  return rows.map((r) => r.task_key)
}

// 当日任务加成汇总（额度计算用）：{ chat, pattern, model3d }
// 领取记录 task_key 形如 `${任务key}-s${阶段序号}`，逐阶段累加奖励
export async function taskBonus(userId, day = todayKey()) {
  const claimed = await claimedTasks(userId, day)
  const bonus = { chat: 0, pattern: 0, model3d: 0 }
  for (const key of claimed) {
    const [base, sIdx] = key.split('-s')
    const t = TASKS[base]
    const st = t?.stages?.[Number(sIdx)]
    if (!st?.bonus) continue
    for (const [f, amt] of Object.entries(st.bonus)) {
      bonus[f] = (bonus[f] ?? 0) + amt
    }
  }
  return bonus
}

// 任务状态列表（个人中心展示 + GET /api/user/usage 响应）
// 阶段任务：progress 为总进度、target 为最后阶段目标；每阶段独立 done/claimed
export async function taskList(userId, day = todayKey()) {
  const progress = await taskProgress(userId, day)
  const claimed = await claimedTasks(userId, day)
  return Object.values(TASKS).map((t) => {
    const stages = (t.stages ?? []).map((s, i) => ({
      label: s.label,
      target: s.target,
      bonus: s.bonus,
      done: (progress[t.key] ?? 0) >= s.target,
      claimed: claimed.includes(`${t.key}-s${i}`),
    }))
    const totalTarget = stages.length ? stages[stages.length - 1].target : 1
    // button 类任务（签到）以领取状态作为进度：已领即完成
    const isClaimed = claimed.includes(`${t.key}-s0`)
    const p = t.source === 'button'
      ? (isClaimed ? totalTarget : 0)
      : Math.min(progress[t.key] ?? 0, totalTarget)
    return {
      key: t.key,
      name: t.name,
      icon: t.icon,
      desc: t.desc,
      source: t.source,
      progress: p,
      target: totalTarget,
      done: p >= totalTarget,
      claimed: stages.length > 0 && stages.every((s) => s.claimed),
      stages,
    }
  })
}
