// lightboxBus.js — 图片预览（Lightbox）跨组件通信
// 聊天组件调用 openImagePreview，Lightbox.vue 订阅此状态渲染
import { ref } from 'vue'

export const lightboxState = {
  visible: ref(false),
  src: ref(''),
  filter: ref(''),   // 可选 CSS filter：放大查看时保留预览页的配色调整
}

export function openImagePreview(url, filter = '') {
  lightboxState.src.value = url
  lightboxState.filter.value = filter || ''
  lightboxState.visible.value = true
}

export function closeImagePreview() {
  lightboxState.visible.value = false
  lightboxState.filter.value = ''
}
