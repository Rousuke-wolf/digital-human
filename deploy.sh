#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════
# 智传非遗 · 服务器一键部署脚本（Ubuntu 22/24/26，2 核 4G 即可）
# 用法（在阿里云 ECS 上以 root 执行）：
#   bash deploy.sh [Gitee 仓库地址] [服务端口] [--no-git]
# 首次部署前准备：
#   ① 本地把最新代码推送到 Gitee（服务器从 Gitee 拉取，国内更快）
#   ② 本地把密钥传上服务器（scp 前目录若不存在，先跑一次本脚本即可创建）：
#      scp server/.env root@<公网IP>:/opt/digital-human/server/.env
# 私有仓库（无法 curl/git 匿名拉取）用压缩包模式：
#   本地：tar -czf deploy-package.tar.gz --exclude=node_modules --exclude=dist --exclude=.git .
#         scp deploy-package.tar.gz root@<公网IP>:/root/
#   服务器：mkdir -p /opt/digital-human
#           tar -xzf /root/deploy-package.tar.gz -C /opt/digital-human
#           cd /opt/digital-human && bash deploy.sh --no-git
# 重复执行 = 更新部署（git pull + 重新构建 + 重启服务），可放心重跑
# ════════════════════════════════════════════════════════════
set -e

REPO="${1:-https://gitee.com/rosk/digital-human.git}"
PORT="${2:-3001}"
# 第三参 --no-git：压缩包上传模式（代码已解压到 APP_DIR，跳过 git 拉取）
SKIP_GIT="${3:-}"
APP_DIR=/opt/digital-human

echo '==> [1/7] 安装 Node 24 / git / 构建工具'
apt-get update -qq
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
fi
apt-get install -y nodejs git build-essential python3

NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "!! Node 版本过低（v$NODE_MAJOR < 22），请改用 NodeSource 安装 Node 24"
  exit 1
fi
echo "    Node $(node -v) OK"

echo '==> [2/7] 内存检查（<5G 时创建 2G swap，构建更稳）'
MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
if [ "$MEM_MB" -lt 5120 ] && [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '    已创建 2G swap'
else
  echo '    无需 swap'
fi

echo '==> [3/7] 拉取代码'
mkdir -p "$APP_DIR"
if [ "$SKIP_GIT" = '--no-git' ]; then
  # 压缩包上传模式：代码已在 APP_DIR（由 tar 解压），跳过 git 拉取
  :
else
  if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR" && git pull --ff-only
  else
    git clone "$REPO" "$APP_DIR"
  fi
fi
cd "$APP_DIR"

echo '==> [4/7] 检查 server/.env（不存在则中止：先用 scp 从本地上传）'
if [ ! -f server/.env ]; then
  echo '!! 缺少 server/.env，请先在本地执行：'
  echo "   scp server/.env root@<公网IP>:$APP_DIR/server/.env"
  echo '   然后重新运行本脚本'
  exit 1
fi

echo '==> [5/7] 安装依赖（国内镜像）+ 构建前端'
npm config set registry https://registry.npmmirror.com
npm ci
npm run build

echo "==> [6/7] 启动服务（pm2 保活，端口 $PORT）"
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
PORT="$PORT" pm2 start server/index.js --name zhichuan --update-env || PORT="$PORT" pm2 restart zhichuan --update-env
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

echo '==> [7/7] 部署完成！'
IP=$(curl -s --max-time 5 ifconfig.me || echo '<公网IP>')
echo "    访问地址: http://$IP:$PORT"
echo "    ⚠ 记得去阿里云控制台 → ECS → 安全组 → 入方向，放行 TCP $PORT 端口"
echo '    查看日志: pm2 logs zhichuan'
