<template>
  <div class="culture-cards-panel">
    <div class="culture-cards-header">
      <div class="culture-cards-title">猜你想问</div>
      <div class="culture-cards-refresh" :class="{ locked: inputLocked }" @click="refresh">
        换一批
      </div>
    </div>
    <div class="culture-ask-grid">
      <div
        v-for="(q, i) in pills"
        :key="q + i"
        class="culture-ask-pill"
        :class="{ locked: inputLocked }"
        @click="onPillClick(q)"
      >
        {{ q }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { quickQuestion, inputLocked } from '../../composables/useCultureChat.js'

// 猜你想问：具体、可回答的常见问题（无 Emoji，纯文字胶囊）
const FAQ_QUESTIONS = [
  '苏绣的常用针法有哪些？',
  '四大名绣怎么区分？',
  '湘绣的狮虎绣有什么特点？',
  '蜀绣的代表作品有哪些？',
  '粤绣的金银线绣有什么讲究？',
  '苗绣的图腾纹样有什么寓意？',
  '双面绣是怎么绣出来的？',
  '新手学刺绣应该从哪种针法入手？',
  '顾绣和苏绣是什么关系？',
  '刺绣丝线和普通缝纫线有什么不同？',
  '如何保养和收藏刺绣作品？',
  '缂丝和刺绣有什么区别？',
  '平针绣和锁针绣有什么区别？',
  '乱针绣为什么看起来像油画？',
  '什么是打籽绣？',
  '什么是盘金绣？',
  '什么是发绣？',
  '什么是珠绣？',
  '苗绣主要流传在哪些地区？',
  '苗绣的破线绣有什么特点？',
  '苗族的锡绣有什么特别之处？',
  '水族马尾绣是什么？',
  '羌绣和苗绣有什么不同？',
  '汉绣是哪里的刺绣？',
  '京绣有什么特点？',
  '鲁绣和其他绣种有什么区别？',
  '汴绣和四大名绣有什么关系？',
  '刺绣的起源可以追溯到什么时候？',
  '刺绣需要准备哪些工具？',
  '绣绷和绣架有什么区别？',
  '如何选择合适的绣针？',
  '绣花线的劈丝是什么意思？',
  '哪些刺绣技艺入选了国家级非遗名录？',
  '十字绣算不算传统刺绣？',
  '什么是抽纱绣？',
  '如何分辨手工绣和机绣？',
]

function pickRandomPills() {
  return [...FAQ_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 6)
}

const pills = ref(pickRandomPills())

function refresh() {
  pills.value = pickRandomPills()
}

function onPillClick(q) {
  // 回复期间锁定：不能打断当前回复发送新问题（结束键才能解除）
  if (inputLocked.value) return
  quickQuestion(q)
}
</script>

<style scoped>
/* AI 回复期间锁定胶囊（与输入锁联动） */
.locked {
  pointer-events: none;
  opacity: 0.45;
}
</style>
