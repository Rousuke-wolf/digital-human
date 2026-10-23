// packages.js — 兑换码包与会员套餐定义（成长体系，必做项 4 扩展）
// 用户端兑换与管理员端生成共用同一份定义，避免两边不一致
export const REDEEM_PACKAGES = {
  VIP7:     { type: 'vip',     days: 7,                      label: '会员 7 天' },
  VIP30:    { type: 'vip',     days: 30,                     label: '会员 30 天' },
  PATTERN5: { type: 'credits', feature: 'pattern', amount: 5,  label: '纹样额度 +5 张' },
  CHAT50:   { type: 'credits', feature: 'chat',    amount: 50, label: '对话额度 +50 条' },
}

// 模拟付费会员套餐（演示环境，无真实支付）
export const VIP_PLANS = {
  week:  { days: 7,  amount: 6,  label: '周卡' },
  month: { days: 30, amount: 18, label: '月卡' },
}
