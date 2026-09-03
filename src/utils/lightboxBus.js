// lightboxBus.js — 图片预览（Lightbox）跨组件通信
// 聊天组件调用 openImagePreview，Lightbox.vue 订阅此状态渲染
import { ref } from 'vue'

export const lightboxState = {
  visible: ref(false),
  src: ref(''),
}

export function openImagePreview(url) {
  lightboxState.src.value = url
  lightboxState.visible.value = true
}

export function closeImagePreview() {
  lightboxState.visible.value = false
}
