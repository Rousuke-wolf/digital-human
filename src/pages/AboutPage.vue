<template>
  <div class="app-wrapper page-about" style="background:#F5F5F5;">
    <Navbar />

    <div class="about-page about-page-container">
      <div class="about-hero">
        <div class="about-hero-inner">
          <div class="about-badge">🧵 关于我们</div>
          <h1 class="about-title">智传非遗</h1>
          <p class="about-subtitle">用数字技术守护千年绣艺，让非物质文化遗产在当代焕发生机</p>
        </div>
        <div class="about-deco-circle about-deco-1"></div>
        <div class="about-deco-circle about-deco-2"></div>
      </div>

      <!-- 项目简介 + 使命（紧贴） -->
      <div class="about-section" style="margin:20px 0;">
        <div class="about-overview">
          <div style="flex:1; background:#fff; border:1px solid #eee; border-radius:16px; padding:24px;">
            <h3 style="margin:0 0 10px; color:#8b5a3b; font-size:18px;">📝 项目简介</h3>
            <p style="margin:0; line-height:1.6; font-size:14px;">
              本项目深度融合 AI 大模型、Live2D 数字人、3D 可视化技术，打造非遗刺绣沉浸式传承平台。
            </p>
          </div>
          <div style="flex:1; background:#fff; border:1px solid #eee; border-radius:16px; padding:24px;">
            <h3 style="margin:0 0 10px; color:#8b5a3b; font-size:18px;">🎯 项目使命</h3>
            <p style="margin:0; line-height:1.6; font-size:14px;">
              以科技为翼，守护非遗匠心，让传统刺绣轻量化、趣味化、普及化。
            </p>
          </div>
        </div>
      </div>

      <!-- 核心技术 + 项目特色（紧贴） -->
      <div class="about-section" style="margin:20px 0;">
        <div class="about-grid-2">
          <div>
            <h3 style="text-align:center; font-size:18px; color:#8b5a3b; margin-bottom:10px;">⚙️ 功能模块</h3>
            <div style="display:flex; flex-direction:column; gap:10px;">
              <div style="background:#fff; padding:16px; border-radius:12px;">
                🎤 数字人交互<br /><span style="font-size:12px;">Live2D 实时渲染</span>
              </div>
              <div style="background:#fff; padding:16px; border-radius:12px;">
                🤖 AI智能问答<br /><span style="font-size:12px;">千问大模型 + RAG</span>
              </div>
              <div style="background:#fff; padding:16px; border-radius:12px;">
                🪡 刺绣教学<br /><span style="font-size:12px;">针法动画可视化</span>
              </div>
              <div style="background:#fff; padding:16px; border-radius:12px;">
                🌐 3D沉浸体验<br /><span style="font-size:12px;">三维模型展示</span>
              </div>
            </div>
          </div>

          <div>
            <h3 style="text-align:center; font-size:18px; color:#8b5a3b; margin-bottom:10px;">✨ 项目技术实现</h3>
            <div style="display:flex; flex-direction:column; gap:10px;">
              <div style="background:#fff; padding:16px; border-radius:12px;">
                🎯 领域化问答<br /><span style="font-size:12px;">专业知识库</span>
              </div>
              <div style="background:#fff; padding:16px; border-radius:12px;">
                📌 可视化教学<br /><span style="font-size:12px;">针法动画拆解</span>
              </div>
              <div style="background:#fff; padding:16px; border-radius:12px;">
                🖼️ 3D数字展品<br /><span style="font-size:12px;">展品360°浏览</span>
              </div>
              <div style="background:#fff; padding:16px; border-radius:12px;">
                ☁️ 轻量化部署<br /><span style="font-size:12px;">浏览器即用</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 功能 + 场景（紧贴） -->
      <div class="about-section" style="margin:20px 0;">
        <div style="background:#fff; padding:24px; border-radius:16px;">
          <div class="about-grid-2 small-gap">
            <div>
              <h4 style="margin:0 0 10px; font-size:16px; color:#8b5a3b;">🧩 项目特色</h4>
              <div style="font-size:13px; line-height:1.5;">
                • 非遗数字化传承 • 沉浸式交互体验 • 低门槛轻量化 • 产学研一体化
              </div>
            </div>
            <div>
              <h4 style="margin:0 0 10px; font-size:16px; color:#8b5a3b;">📍 应用场景</h4>
              <div style="font-size:13px; line-height:1.5;">
                • 校园美育课堂 • 非遗线上传播 • 博物馆互动展陈 • 大众零基础学习
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部（紧贴） -->
      <div class="about-footer-note" style="text-align:center; padding:20px 0; font-size:12px; color:#666; border-top:1px solid #eee;"></div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import Navbar from '../components/Navbar.vue'
import { guideOnPageEnter } from '../utils/voiceGuide.js'
import '../page/about/index.css'

// 语音引导：首次进入播报「关于我们」页面介绍
onMounted(() => guideOnPageEnter('about'))
</script>
