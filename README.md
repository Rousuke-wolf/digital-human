# 智传非遗 — 刺绣文化数字人教育平台

> 以数字之光，传承千年绣艺。让苏绣、湘绣、蜀绣、粤绣在指尖重焕生机。

一个面向「中国刺绣非物质文化遗产」的数字化传播与教育平台。核心是一名叫 **绫韵** 的 AI 数字人讲解员：她以 Live2D 形象呈现，能回答刺绣相关问题、语音播报（嘴型同步）、引导针法教学，并展示 3D 非遗展品。

## ✨ 功能特性

| 模块 | 说明 |
|---|---|
| 🎭 **数字人问答** | Live2D 数字人「绫韵」+ 通义千问大模型，只回答刺绣领域问题（历史/四大名绣/针法/工具/非遗保护），支持情绪切换、打字机效果、知识卡片快捷提问 |
| 🔊 **语音播报** | 阿里云 CosyVoice 语音合成，WebSocket 流式传输 → Web Audio 流式解码播放，**实时振幅驱动数字人嘴型**，支持暂停/继续/停止 |
| 🖼️ **AI 配图** | 数字人判断问题需要配图时，自动调用通义万相生成刺绣主题图片并展示 |
| 🎓 **教学体验** | 数字人逐步讲解刺绣针法，canvas 动画同步演示（起针/运针/收针），内置针法识别小游戏 |
| 🏛️ **3D 展厅** | three.js 展示非遗展品三维模型（兔儿爷/舞狮/香囊/脸谱/花瓶/中国结），支持 AI 展品介绍 + 语音朗读、Meshy 文生 3D 自定义展品 |
| 👤 **用户系统** | 邮箱验证码注册/登录/找回密码（SMTP 发送 + 60 秒限流）、JWT 鉴权、个人中心 |

## 🛠️ 技术栈

- **前端**：Vue 3（Composition API）+ Vue Router + Vite
- **3D/渲染**：three.js、Live2D（pixi-live2d-display）、model-viewer、Canvas 动画
- **后端**：Node.js + Express 5
- **数据库**：SQLite（better-sqlite3，封装了兼容 mysql2 的查询接口，可平滑迁移 MySQL）
- **AI 服务**：阿里云百炼 — 通义千问（对话）、通义万相（图片生成）、CosyVoice（语音合成）；Meshy（文生 3D）
- **工程化**：ESLint 10 + Prettier、环境变量管理、自动化 API 测试脚本

## 🏗️ 架构

```
浏览器 (Vue 3 SPA)
   │
   │  /api/auth  用户系统（注册/登录/JWT）
   │  /api/ai    对话 + 图片生成 ──代理──▶ 阿里云百炼 DashScope
   │  /api/meshy 文生 3D ────────代理──▶ Meshy API
   │  /tts       语音合成（WebSocket 流式转发）
   │  /meshy-glb 3D 模型资源代理
   ▼
Express 后端 (server/)
   │
   ├── SQLite（用户/验证码，启动自动备份）
   ├── SMTP（验证码邮件）
   └── 生产环境托管前端 dist 静态文件
```

**安全设计**：所有第三方 API 密钥只存在于服务端 `server/.env`（已 gitignore），前端通过同源后端代理访问，不暴露任何密钥。

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example server/.env
# 编辑 server/.env，填入 DASHSCOPE_API_KEY / DASHSCOPE_TTS_KEY / MESHY_API_KEY / SMTP 等

# 3. 开发模式（同时启动后端 + 前端热更新）
npm run dev

# 4. 生产模式
npm run build   # 构建前端到 dist/
npm start       # Express 托管 dist + 提供 API
```

> 未配置 SMTP 时注册不需要邮箱验证码（开发便利）；配置 SMTP 后自动启用验证码流程。
> 设 `DEV_MODE=true` 可让验证码直接显示在页面中（联调用）。

## 🧪 测试

```bash
# 启动后端后运行自动化 API 测试（18 项）
bash test/api-test.sh
```

完整测试清单（含浏览器手动验证项）见 [TEST_CHECKLIST.md](TEST_CHECKLIST.md)。

## 📁 目录结构

```
├── server/            # Express 后端
│   ├── index.js       # 入口（API 路由 + 生产静态托管）
│   ├── db.js          # SQLite 封装 + 自动备份
│   ├── env.js         # 统一环境变量加载
│   ├── middleware/    # JWT 鉴权
│   ├── routes/        # auth / ai / meshy / tts
│   └── utils/         # 邮件 / 密码
├── src/
│   ├── api/           # qwen.js（AI 客户端）、client.js（鉴权请求封装）
│   ├── components/    # 聊天面板 / Live2D 面板 / 导航 / 知识卡片
│   ├── pages/         # 页面级组件（路由）
│   ├── page/          # 遗留页面模块（字符串模板构建，逐步组件化迁移中）
│   ├── router/        # Vue Router + 登录守卫
│   └── composables/   # useAuth 等组合式函数
├── public/model/      # Live2D 模型资源
├── test/api-test.sh   # 自动化 API 测试
└── TEST_CHECKLIST.md  # 测试清单
```

## 📝 环境变量

| 变量 | 说明 |
|---|---|
| `DASHSCOPE_API_KEY` | 通义千问对话 + 万相图片生成 |
| `DASHSCOPE_TTS_KEY` | CosyVoice 语音合成 |
| `MESHY_API_KEY` | Meshy 文生 3D |
| `SMTP_HOST/PORT/USER/PASS` | 验证码邮件（未配置则跳过验证码） |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | 登录令牌签名 |
| `PORT` / `DEV_MODE` | 端口 / 开发模式 |

## 🚧 已知问题与后续计划

- 3D 展品模型（GLB）体积较大（5~29MB）：已实现按需加载 + 进度遮罩（`src/utils/viewerLoading.js`），Draco/meshopt 压缩仍待做（需 gltfpack 重新导出模型）
- Meshy API 为海外服务，国内网络直连不稳定，建议部署时配置代理
- 文化页已完全组件化（`src/composables/useCultureChat.js` / `useLive2D.js`）；首页/教学页/3D 展厅仍是 `src/page/` 字符串模板页面，待逐步迁移
- 前端为 JavaScript，计划渐进引入 TypeScript
