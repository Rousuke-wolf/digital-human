// ═══════════════════════════════════════════════════════
// 刺绣图谱多语言资源（答辩演示：中文 / English / 日本語 / 粤语 / 藏语）
// 最小可用集 = 节点名称标签 + 数字人欢迎语 + 面板界面文案，
// 图谱节点点击后切换语言，标签与欢迎语同步变化（演示 2~3 种即可）
// 藏语说明：bo 词条为最小可用集，接入智达AI（藏语大模型）后由模型
//   生成完整藏文回答；⚠ TODO 以下藏文译文待藏族专家校对后再演示
// ═══════════════════════════════════════════════════════

export const NODE_NAMES = {
  suxiu: { en: 'Su Embroidery', ja: '蘇繡（そしゅう）', yue: '蘇繡' },
  xiangxiu: { en: 'Xiang Embroidery', ja: '湘繡（しょうしゅう）', yue: '湘繡' },
  shuxiu: { en: 'Shu Embroidery', ja: '蜀繡（しょくしゅう）', yue: '蜀繡' },
  yuexiu: { en: 'Yue Embroidery', ja: '粤繡（えつしゅう）', yue: '粵繡' },
  jingxiu: { en: 'Jing Embroidery', ja: '京繡（きょうしゅう）', yue: '京繡' },
  bianxiu: { en: 'Bian Embroidery', ja: '汴繡（べんしゅう）', yue: '汴繡' },
  guxiu: { en: 'Gu Embroidery', ja: '顧繡（こしゅう）', yue: '顧繡' },
  ouxiu: { en: 'Ou Embroidery', ja: '甌繡（おうしゅう）', yue: '甌繡' },
  hanxiu: { en: 'Han Embroidery', ja: '漢繡（かんしゅう）', yue: '漢繡' },
  miaoxiu: { en: 'Miao Embroidery', ja: '苗繡（ミャオしゅう）', yue: '苗繡' },
  qiangxiu: { en: 'Qiang Embroidery', ja: '羌繡（チャンしゅう）', yue: '羌繡' },
  mashuixiu: { en: 'Horsetail Embroidery', ja: '馬尾繡（ばびしゅう）', yue: '馬尾繡' },
}

// 数字人欢迎语：切换语言后立即用新语言播报，答辩时演示「欢迎语同步变化」
export const WELCOME = {
  zh: '您好，我是绣娘。这里是十二大刺绣流派的知识星图，点击任意星辰，让我为您讲一针一线的故事。',
  en: 'Hello, I am Xiu Niang, your embroidery guide. This is a star map of twelve great embroidery schools. Click any star, and let me tell you its story, stitch by stitch.',
  ja: 'こんにちは、刺繍案内人の「繡娘」です。ここは十二の刺繍流派の知識星図です。星をクリックすると、一針一糸の物語をお話しします。',
  yue: '你好，我係繡娘。呢度係十二大刺繡流派嘅知識星圖，撳任意一粒星，等我同你講一針一線嘅故事。',
  bo: 'བཀྲ་ཤིས་བདེ་ལེགས། ང་ནི་ཚེམ་འཁྲིས་ཀྱི་ལམ་སྟོན་པ་ཡིན། འདིར་ཚེམ་འཁྲིས་ཀྱི་ཞིང་ཆེན་བཅུ་གཉིས་ཀྱི་ཤེས་བྱའི་སྐར་རྒྱུད་ཡོད། སྐར་མ་གང་རུང་ལ་ནོན་དང་ངས་ཁྱེད་ལ་བཤད་ཆོག །',
}

// 数字人面板界面文案
export const UI_TEXT = {
  zh: {
    panelTitle: '绣娘',
    panelSubtitle: '非遗刺绣数字人',
    placeholder: '问我任何刺绣问题…',
    thinking: '绣娘正在翻阅绣谱…',
    talkWith: '与传承人对话',
  },
  en: {
    panelTitle: 'Xiu Niang',
    panelSubtitle: 'Embroidery Digital Human',
    placeholder: 'Ask me about embroidery…',
    thinking: 'Xiu Niang is turning the pages…',
    talkWith: 'Talk to the Master',
  },
  ja: {
    panelTitle: '繡娘',
    panelSubtitle: '刺繍デジタルヒューマン',
    placeholder: '刺繍について何でも聞いて…',
    thinking: '繡娘は刺繍の譜面をめくっています…',
    talkWith: '伝承人と話す',
  },
  yue: {
    panelTitle: '繡娘',
    panelSubtitle: '非遺刺繡數字人',
    placeholder: '問我任何刺繡問題…',
    thinking: '繡娘睇緊繡譜…',
    talkWith: '同傳承人傾偈',
  },
  bo: {
    panelTitle: 'ཚེམ་མཁན་མ།',
    panelSubtitle: 'རིག་གནས་ཤུལ་རྫས་ཀྱི་ཚེམ་འཁྲིས་མི་སྣ།',
    placeholder: 'ཚེམ་འཁྲིས་ཀྱི་གནས་ཚུལ་ལ་དྲིས།',
    thinking: 'ཤེས་བྱ་ལ་གཟིགས་བཤེར་བྱེད་བཞིན་ཡོད།',
    talkWith: 'རྒྱུད་འཛིན་མཁན་དང་སྐད་ཆ་བཤད།',
  },
}
