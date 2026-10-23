// ═══════════════════════════════════════════════════════
// 详情抽屉「视频鉴赏」B站视频源（以流派 id 为键）
// ⚠ TODO 答辩前必改：以下 bvid 为占位符（不存在的 BV 号），
//   请替换为各流派对应的真实 B 站刺绣技艺视频 BV 号；
//   占位符 BV 会触发 BilibiliPlayer 的「加载失败 → 前往B站观看」兜底，
//   恰好也能现场演示断网降级逻辑
// ═══════════════════════════════════════════════════════

export const BILIBILI_VIDEOS = {
  suxiu: { bvid: 'BV1xx411c7m1', title: '苏绣技艺 · 双面绣针法赏析' },
  xiangxiu: { bvid: 'BV1xx411c7m2', title: '湘绣技艺 · 鬅毛针狮虎赏析' },
  shuxiu: { bvid: 'BV1xx411c7m3', title: '蜀绣技艺 · 芙蓉鲤鱼针法赏析' },
  yuexiu: { bvid: 'BV1xx411c7m4', title: '粤绣技艺 · 金银线垫绣赏析' },
  jingxiu: { bvid: 'BV1xx411c7m5', title: '京绣技艺 · 宫廷盘金绣赏析' },
  bianxiu: { bvid: 'BV1xx411c7m6', title: '汴绣技艺 · 名画绣制赏析' },
  guxiu: { bvid: 'BV1xx411c7m7', title: '顾绣技艺 · 画绣针法赏析' },
  ouxiu: { bvid: 'BV1xx411c7m8', title: '瓯绣技艺 · 发绣针法赏析' },
  hanxiu: { bvid: 'BV1xx411c7m9', title: '汉绣技艺 · 荆楚纹样绣制赏析' },
  miaoxiu: { bvid: 'BV1xx411c7m0', title: '苗绣技艺 · 破线绣针法赏析' },
  qiangxiu: { bvid: 'BV1xx411c7ma', title: '羌绣技艺 · 挑花针法赏析' },
  mashuixiu: { bvid: 'BV1xx411c7mb', title: '马尾绣技艺 · 缠丝绣制赏析' },
}

/** 取某流派的视频条目；无映射时返回 null（抽屉隐藏视频区块） */
export function getBilibiliVideo(nodeId) {
  return BILIBILI_VIDEOS[nodeId] || null
}
