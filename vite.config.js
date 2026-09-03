import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // ── 后端 API（用户系统）────────────────────────
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // ── TTS 语音合成（本地 Express）─────────────────
      '/tts': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },

      // ── Meshy GLB 文件代理（解决模型加载跨域）──
      // 生产环境由 server/index.js 的同名路由处理
      '/meshy-glb': {
        target: 'https://assets.meshy.ai',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL('http://dummy' + path).searchParams.get('url')
          return url ? new URL(url).pathname + new URL(url).search : path
        }
      }
    }
  }
})
