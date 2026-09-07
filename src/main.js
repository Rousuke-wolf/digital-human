import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

// Vue 迁移完成：所有页面均已组件化，不再需要 window.* 全局桥接
createApp(App).use(router).mount('#app')
