<template>
  <div class="app-wrapper page-culture" :class="{ 'voice-mode': voiceModeActive }">
    <Navbar />

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
import { onMounted, onBeforeUnmount } from 'vue'
import '../page/culture/index.css'
import Navbar from '../components/Navbar.vue'
import Live2DPanel from '../components/live2d/Live2DPanel.vue'
import ChatPanel from '../components/chat/ChatPanel.vue'
import KnowledgeCards from '../components/culture/KnowledgeCards.vue'
import Lightbox from '../components/ui/Lightbox.vue'
import VoiceOverlay from '../components/chat/VoiceOverlay.vue'
import { voiceModeActive } from '../composables/useCultureChat.js'
import { destroyLive2D } from '../composables/useLive2D.js'
import { guideOnPageEnter } from '../utils/voiceGuide.js'

// 语音引导：首次进入播报「绫韵问答」页面介绍（当次会替代页面自身的语音问好）
onMounted(() => guideOnPageEnter('culture'))

// 聊天记录由 useCultureChat 自动持久化（切页保留 + 刷新恢复），无需手动保存
onBeforeUnmount(() => {
  // 释放 Live2D（PIXI 实例 / ResizeObserver）
  destroyLive2D()
})
</script>
