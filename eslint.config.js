// ESLint 扁平配置（ESLint 10）
// 规则策略：保持既有代码风格，只拦截明显错误；遗留代码的告警留给逐步重构消化
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  // 忽略构建产物、依赖和外部模型文件
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'public/model/**', // Live2D/GLB 模型资源
      'src/assets/3d-model/**',
      'server/data/**',
    ],
  },

  js.configs.recommended,

  ...pluginVue.configs['flat/recommended'],

  // 关闭与 Prettier 冲突的格式类规则
  prettier,

  {
    files: ['**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        PIXI: 'readonly', // index.html 通过 CDN 加载的 pixi.js（Live2D 渲染依赖）
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off', // 遗留页面用 innerHTML 渲染，批次4重构后逐步收紧
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }], // 遗留代码有大量空 catch
      'no-console': 'off', // 项目用 console 做生命周期日志
    },
  },
]
