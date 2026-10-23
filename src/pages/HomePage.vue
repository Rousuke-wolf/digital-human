<template>
  <div class="app-wrapper page-home">
    <Navbar />

    <div class="hero-section">
      <div class="hero-bg-dots"></div>
      <div class="hero-content">
        <div class="hero-badge">🧵 非物质文化遗产 · 中国传统刺绣</div>
        <h1 class="hero-title">绣美<span class="hero-accent">中华</span></h1>
        <p class="hero-subtitle">
          以数字之光，传承千年绣艺<br>让苏绣、湘绣、蜀绣、粤绣在指尖重焕生机
        </p>
        <div class="hero-btns">
          <button class="btn-primary" @click="router.push('/teaching')">开始体验</button>
          <button class="btn-outline" @click="router.push('/culture')">向绫韵提问</button>
        </div>
      </div>
    </div>

    <div class="home-features">
      <div class="home-feature-card" @click="router.push('/culture')">
        <div class="hf-icon">📖</div>
        <div class="hf-title">绫韵问答</div>
        <div class="hf-desc">和刺绣数字人绫韵聊天，问答之间了解四大名绣与针法技艺</div>
      </div>
      <div class="home-feature-card" @click="router.push('/teaching')">
        <div class="hf-icon">🎓</div>
        <div class="hf-title">动画体验</div>
        <div class="hf-desc">数字人引导员逐步讲解针法，动画演示全过程</div>
      </div>
      <div class="home-feature-card" @click="router.push('/3d')">
        <div class="hf-icon">🏛️</div>
        <div class="hf-title">3D展厅</div>
        <div class="hf-desc">沉浸式浏览精美刺绣成品的三维模型</div>
      </div>
      <div class="home-feature-card" @click="router.push('/about')">
        <div class="hf-icon">ℹ️</div>
        <div class="hf-title">关于我们</div>
        <div class="hf-desc">展示项目核心成果、团队理念与技术亮点，深入了解数字化非遗</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Navbar from '../components/Navbar.vue'
import { guideOnPageEnter } from '../utils/voiceGuide.js'

const router = useRouter()

// 语音引导：首次进入播报首页介绍
onMounted(() => guideOnPageEnter('home'))
</script>
