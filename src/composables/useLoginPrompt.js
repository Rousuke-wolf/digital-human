// useLoginPrompt.js — 全局登录引导弹窗（额度体系，必做项 4）
// 未登录用户触发需登录功能时调用 promptLogin(feature)；
// 弹窗实例挂在 App.vue 根节点（LoginPromptModal.vue），全站共用
import { reactive } from 'vue'

const state = reactive({
  visible: false,
  message: '',
})

const FEATURE_TEXT = {
  pattern: 'AI 纹样创作需要登录后体验，登录后每天可生成 10 张专属纹样',
  model3d: 'AI 3D 展品生成需要登录后体验，登录后即可把灵感变成 3D 展品',
  chat: '今日试用次数已用完，登录后每天可继续对话 60 次',
  image: 'AI 刺绣配图需要登录后体验，登录后每天可生成 10 张',
}

export function useLoginPrompt() {
  function promptLogin(feature = 'pattern') {
    state.message = FEATURE_TEXT[feature] || FEATURE_TEXT.pattern
    state.visible = true
  }

  function closeLoginPrompt() {
    state.visible = false
  }

  return { state, promptLogin, closeLoginPrompt }
}
