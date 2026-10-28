# 智传非遗 —— 基于 AI 的非遗文化沉浸式传承平台

以「非遗刺绣」为主题的 AI 教育平台：数字人「绫韵」担任虚拟非遗传承人，融合情感化陪伴、AIGC 纹样共创、可探索的 3D 知识图谱星图、文生 3D 数字展馆与成长激励体系。

## 功能总览

| 页面 | 路由 | 说明 |
|---|---|---|
| 首页 | `/` | 平台形象入口 |
| 绫韵问答（数字人） | `/culture` | 绫韵 Live2D 数字人：AI 问答、语音播报、情感化问候、图片生成 |
| 动画体验 | `/teaching` | Canvas 针法动画教学 + 刺绣小游戏 |
| 3D 展厅 | `/3d` | 预设展品 + Meshy 文生 3D 生成、AI 讲解朗读 |
| 纹样共创 | `/create` | AIGC 纹样生成（六类刺绣风格）+ 配色编辑 + 作品库 |
| 知识图谱 | `/graph` | 非遗知识星图：**2D 宣纸星图 / 3D 深空星图一键切换**，点击探索、兴趣推荐 |
| 个人中心 | `/profile` | 账号资料、每日额度、今日任务、会员中心（模拟支付）、我的作品、成长记录、语音引导设置 |
| 管理后台 | `/admin` | 运营统计 + 兑换码批量生成（admin 角色） |

## 数字人模型与交互

- 文化问答、教学与 3D 展厅统一使用 `sample/models/res1`、`res2` 的 Live2D 模型，运行资源放在 `public/model/res1`、`res2`；编辑器工程文件不参与部署。
- 点击人物区域的「切换形象」按钮在两个模型间切换，切换不打断正在播放的语音。
- 默认显示上半身；滚轮向下或点击「−」可缩小到完整全身，滚轮向上或「+」放大。缩放保持人物水平居中。
- 鼠标相对人物可见区域中心驱动小幅转头、眼神与身体跟随；使用按时间计算的临界阻尼和微小位移防抖，保持不同刷新率下的跟随节奏一致。关闭示例大幅动作，保留眨眼与轻微呼吸。
- 按完整音频曲线驱动口型，用稳定的扬声器输出时钟（含浏览器报告的输出延迟）对齐。模型绘制前直接采样，避免读取另一条 RAF 的旧振幅；门限防抖、短间隙连接、小幅波动抑制和速度连续的单调三次插值共同减少颤抖。正常停顿约 90ms 收口，暂停/停止立即闭嘴，不叠加逐渲染帧的口型平滑。
- 普通播报、教学和多语言入口统一使用后端默认音色 `guxiaoran_v3.1`（试用）；浏览器朗读兜底无法读取波形，只能使用近似节奏口型，**不代表新音色试听成功**。
- 自动化测试：`npm test`（口型曲线、播放生命周期、Live2D 资源及 TTS 协议；不调用付费 API）。

## 技术栈

- **前端**：Vue 3（`<script setup>`）+ Vite 8 + Vue Router；d3（2D 星图相机）、three.js（3D 星图）、Live2D（PIXI，CDN 引入）
- **后端**：Express 5 + better-sqlite3（自封装 mysql2 风格 `query()` 接口）
- **AI 服务**：阿里云百炼（通义千问对话 / 万相图片 / CosyVoice TTS）、Meshy 文生 3D
- **邮箱**：nodemailer（SMTP 验证码）

## 环境要求

- **Node.js ≥ 22**（vite 8 与 better-sqlite3 12 的要求；项目在 Node 24 上开发验证）
- Windows 用户安装 better-sqlite3 若遇到原生编译报错，确认已安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/zh-hans/downloads/)（C++ 桌面开发工具链）；网络受限时也可用项目自带的 `package-lock.json` 直接 `npm ci` 安装预编译版本

## 快速上手

```bash
# 1. 克隆仓库
git clone <仓库地址>
cd digital-human

# 2. 安装依赖（仅前端 + 后端依赖，无独立构建步骤）
npm install        # 或 npm ci（按 lock 文件精确安装）

# 3. 配置环境变量
#    将根目录 .env.example 复制为 server/.env，并填入真实密钥：
#    cp .env.example server/.env        （Windows: copy .env.example server\.env）

# 4. 启动开发服务（后端 :3001 + 前端 :5173 同时启动）
npm run dev
```

浏览器打开 **http://localhost:5173** 即可。前端通过 vite 代理访问同源后端（`/api`、`/tts`、`/meshy-glb`），无需额外配置。

## 环境变量（server/.env）

| 变量 | 必填 | 说明 |
|---|---|---|
| `DASHSCOPE_API_KEY` | ✅ | 阿里云百炼密钥：AI 对话 + 万相图片生成 |
| `DASHSCOPE_TTS_KEY` | ✅ | CosyVoice 语音合成（数字人播报） |
| `DASHSCOPE_TTS_MODEL` | ⭕ | 试用引擎，默认 `cosyvoice-v3-flash`；必须与音色及账号地域匹配 |
| `DASHSCOPE_TTS_VOICE` | ⭕ | 默认 `guxiaoran_v3.1`；所有播报入口共用，调用方显式传 voice 时除外 |
| `MESHY_API_KEY` | ⭕ | Meshy 文生 3D（不填则 3D 生成功能不可用，预设展品不受影响） |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` | ⭕ | 邮箱验证码（推荐 QQ/163 SMTP，授权码非登录密码）。**不配置时注册自动免验证码**，验证码登录 tab 禁用 |
| `JWT_SECRET` | ⭕ | 生产环境务必改为随机长字符串 |
| `DEV_MODE` | ⭕ | `true` 时验证码直接返回在接口里（本地调试免查邮件） |
| `QUOTA_CHAT` / `QUOTA_PATTERN` / `QUOTA_MODEL3D` / `GUEST_QUOTA_CHAT` / `VIP_MULTIPLIER` | ⭕ | 额度体系参数（默认 60/10/1/5/2），答辩演示现场可调 |

> 密钥只存在于 `server/.env`（已被 gitignore），前端不持有任何第三方密钥，全部经后端代理转发。

## 语音与口型试听

1. 在 `server/.env` 中填好可用的 `DASHSCOPE_TTS_KEY`。当前默认试用 `cosyvoice-v3-flash` + `guxiaoran_v3.1`；**该音色与引擎的可用配对/语言支持仍需在实际账号验证**，可用 `DASHSCOPE_TTS_MODEL`、`DASHSCOPE_TTS_VOICE` 覆盖。要对比旧音色，同时设置为 `cosyvoice-v2` + `longling_v2`。
2. 重启 `npm run dev`，进入 `/culture` 触发一次播报。开发者工具 Network 中 `/tts` 应返回 `200` 和 `audio/mpeg`；若出现 401 鉴权提示或「降级到浏览器朗读」，先修复密钥/地域/音色权限，不要把兜底声音当成新音色。
3. 用带停顿的句子试听，例如「你好，我是绫韵。我们先停一下，再继续介绍刺绣。」检查开口、句间闭嘴及最后一个字；再测试暂停/恢复、停止、快速换回答和播放中切换形象。
4. 在语音设置中对比低音量、静音和不同语速；口型应跟随实际合成后的音频进度，不应随运行时间逐渐错位。蓝牙设备未报告的额外延迟仍需人工试听确认。

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 同时启动后端 + 前端（日常开发） |
| `npm run dev:api` / `npm run dev:web` | 只启动后端 / 只启动前端 |
| `npm run build` | 构建前端到 `dist/` |
| `npm test` | 无网络自动化测试（Live2D / 口型 / 播放器 / TTS 路由） |
| `npm start` | 生产模式：Express 托管 `dist/` 并提供全部 API |
| `npm run lint` | ESLint（要求保持 0 错误 0 警告） |
| `bash test/api-test.sh` | 后端自动化测试（51 项断言；需先启动后端，Windows 用 Git Bash 运行） |
| `npm run format` / `format:check` | Prettier 格式化 / 只检查 |

## 项目结构

```
digital-human/
├── server/                  # 后端（Express 5 + SQLite）
│   ├── index.js             # 应用入口：路由挂载 / 静态托管 / GLB 代理
│   ├── db.js                # 数据库连接 + 建表（initDB）+ query() 接口
│   ├── routes/              # auth / ai / meshy / tts / user / admin
│   ├── middleware/auth.js   # requireAuth / optionalAuth / requireAdmin
│   └── utils/               # quota（额度链）/ tasks（每日任务）/ packages / email / password
│       └── data/            # SQLite 数据库 + 启动自动备份（保留 7 天）
├── src/
│   ├── pages/               # 页面组件（Home/Culture/Teaching/Show3D/Pattern/Graph/Profile/Login/Admin）
│   ├── page/                # 页面级模块（图谱数据与 2D/3D 引擎、Meshy 流程、教学动画引擎、各页样式）
│   ├── components/          # Navbar / ChatPanel / LoginPromptModal / ui/
│   ├── composables/         # useAuth / useCultureChat / useLive2D / useLoginPrompt
│   ├── api/                 # client.js（统一请求封装）/ qwen.js
│   └── utils/               # models / state / worksSync / guestId / navigation 等
├── public/model/            # Live2D 模型与 GLB 展品（大体积资源，只放 public/）
├── test/api-test.sh         # 后端 API 自动化测试
├── TEST_CHECKLIST.md        # 手动验证清单（含已知取舍）
└── .env.example             # 环境变量模板
```

## 账号与运营

- **注册**：SMTP 配置后注册需 6 位邮箱验证码（60 秒限流、5 分钟有效）；未配置 SMTP 则免验证码
- **额度体系**：登录用户每日额度 = 基础 × 会员倍数 + 当日任务加成 + 兑换额度包；游客可试用对话（默认 5 条/日），纹样/3D 生成需登录
- **管理员**：把任意账号提权为 admin 后重新登录（JWT 携带角色，需重登生效）。在项目根目录的 **Git Bash** 中运行：

```bash
node -e 'const D=require("better-sqlite3");const db=new D("server/data/database.db");db.prepare("UPDATE users SET role='"'"'admin'"'"' WHERE email=?").run("你的邮箱")'
```

- **兑换码**：admin 登录后访问 `/admin`，可批量生成会员天数/额度包兑换码（答辩演示时可提前发放给评委体验）

## 常见问题

- **Windows 下重启开发服务后端口被占**：`concurrently` 的子进程（node/vite）在父进程结束后可能残留。清理命令：

```bash
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { $c=$_.CommandLine; if ($c -match 'digital-human|server/index.js|vite') { taskkill /F /PID $_.ProcessId } }"
```

- **验证码邮件收不到**：先 `GET /api/debug/smtp-test` 确认 SMTP 连接；再看垃圾箱；本地调试可开 `DEV_MODE=true` 让验证码直接显示
- **3D 生成报 502**：本机到 `api.meshy.ai` 网络不通属常见情况（海外服务），链路本身正常；预设展品不受影响
- **纹样生成需登录**：这是额度体系设计（游客只能调参体验），登录后每日 10 张
- **开发约束**：`src/pages/PatternPage.vue` 不得 import `src/api/qwen.js`（vite8/Rolldown 已知 bug 会构建 panic）；新增环境变量需同步维护 `.env.example`
- **图片 URL 过期**：万相返回的图片为临时签名地址（演示期内有效），旧作品图长期后可能失效，属上游特性
