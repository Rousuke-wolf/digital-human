// ═══════════════════════════════════════════════════════
// 预置对话脚本（中 / 英 / 日）：答辩现场网络或 API 不稳定时的兜底路径
// 命中规则：数字人面板的问题快捷胶囊直接携带 preset 条目，
// 回答不经大模型、不经知识库，纯本地返回 + 本地 TTS，
// 保证「提问 → 回答 → 语音」完整链路 100% 可演示
// ═══════════════════════════════════════════════════════

export const PRESET_DIALOGS = {
  zh: [
    {
      id: 'suxiu-tech',
      q: '苏绣的乱针绣有什么特别之处？',
      a: '乱针绣是苏绣大师杨守玉开创的绝技——它打破传统排针规律，用长短交叉的丝线模拟光影，让绣面像油画一样有明暗层次。后来沈寿的仿真绣更进一步，能绣出以假乱真的肖像。这就是苏绣「精细雅洁」之外的先锋一面。',
    },
    {
      id: 'four-famous',
      q: '四大名绣各有什么绝活？',
      a: '苏绣精细雅洁，双面绣两面成画；湘绣的鬅毛针能让狮虎毫毛毕现；蜀绣有一百多种衣锦纹针，芙蓉鲤鱼活灵活现；粤绣用金银线垫绣，百鸟朝凤富丽堂皇。一针一线，都是各流派的看家绝活。',
    },
    {
      id: 'guardian',
      q: '数字人怎么帮助非遗传承？',
      a: '我们把针法变成三维动作数据，用人工智能整理纹样基因库，再用语音合成复刻传承人的声线——年轻人随时都能向「数字绣娘」学艺，让老手艺活在云端，传得更远。',
    },
  ],
  en: [
    {
      id: 'suxiu-en',
      q: 'What makes Su embroidery special?',
      a: 'Su embroidery is famous for its double-sided embroidery — the same stitch forms a perfect picture on both sides. Its random-stitch technique, created by Master Yang Shouyu, uses crossed silk threads to paint light and shadow like an oil painting.',
    },
    {
      id: 'project-en',
      q: 'How does your digital human help inheritors?',
      a: 'We digitize every stitch into 3D motion data, build an AI pattern database, and clone the voice of real masters — so young people can learn from a digital embroiderer anytime, and the old craft lives on in the cloud.',
    },
  ],
  ja: [
    {
      id: 'shishu-ja',
      q: '蘇繡の特徴を教えてください',
      a: '蘇繡の名物は両面繡です。一本の針で、表も裏も同じ美しい絵に仕上げます。楊守玉先生が生んだ乱針繡は、交差する絹糸で光と影を描き、まるで油絵のような刺繍です。',
    },
    {
      id: 'project-ja',
      q: 'デジタルヒューマンはどうやって伝承を助けますか',
      a: '私たちは針法を三次元モーションデータにし、AIで文様のデータベースを作り、伝承者の声をクローンします。若者はいつでもデジタル繡娘に学べ、古い技はクラウドの中で生き続けます。',
    },
  ],
  yue: [
    {
      id: 'suxiu-yue',
      q: '蘇繡有咩特別？',
      a: '蘇繡最出名係雙面繡，一針落去，正反兩面都係畫。亂針繡用交錯嘅絲線繡出光影，好似油畫一樣，係蘇繡大師楊守玉嘅絕技。',
    },
  ],
}
