<template>
  <div class="app-wrapper page-culture" :class="{ 'voice-mode': voiceModeActive }">
    <div ref="navbarRef"></div>

    <div class="main-dashboard culture-dashboard">
      <Live2DPanel />
      <div class="right-panel culture-right">
        <ChatPanel />
        <KnowledgeCards />
      </div>
    </div>

    <Lightbox />
    <VoiceOverlay />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import '../page/culture/index.css'
import Live2DPanel from '../components/live2d/Live2DPanel.vue'
import ChatPanel from '../components/chat/ChatPanel.vue'
import KnowledgeCards from '../components/culture/KnowledgeCards.vue'
import Lightbox from '../components/ui/Lightbox.vue'
import VoiceOverlay from '../components/chat/VoiceOverlay.vue'
import { buildNavbar } from '../components/Navibar.js'
import { voiceModeActive, saveChatHTML, restoreChatHTML } from '../composables/useCultureChat.js'
import { destroyLive2D } from '../composables/useLive2D.js'

const navbarRef = ref(null)
let _savedChatHTML = null

onMounted(() => {
  navbarRef.value.innerHTML = buildNavbar('culture')

  // 恢复之前的聊天记录（切页后回来继续对话）
  restoreChatHTML(_savedChatHTML)
})

onBeforeUnmount(() => {
  // 保存聊天记录 + 释放 Live2D（PIXI 实例 / ResizeObserver）
  _savedChatHTML = saveChatHTML()
  destroyLive2D()
})
</script>
