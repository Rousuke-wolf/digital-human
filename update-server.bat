@echo off
chcp 65001 >nul
REM ════════════════════════════════════════════════════════════
REM 一键更新服务器（在项目根目录双击或在 CMD 运行）
REM 用法：
REM   update-server.bat <服务器公网IP>          ← 压缩包模式（私有仓库也适用）
REM   update-server.bat <服务器公网IP> git      ← git 模式（需仓库已公开）
REM 流程：打包 → 上传 → 服务器解压/拉取 → 重新构建 → pm2 重启
REM 会要求输入两次 root 密码（scp 一次、ssh 一次），盲打即可
REM ════════════════════════════════════════════════════════════
if "%~1"=="" (
  echo 用法: update-server.bat 服务器公网IP [git]
  exit /b 1
)
set IP=%1
set MODE=%2
cd /d "%~dp0"

if "%MODE%"=="git" (
  echo [1/2] 服务器 git 拉取 + 重新构建（输入 root 密码）...
  ssh root@%IP% "cd /opt/digital-human && bash deploy.sh"
  if errorlevel 1 (
    echo 更新失败：如果提示 git 认证失败，说明仓库还是私有，请改用压缩包模式：
    echo   update-server.bat %IP%
    exit /b 1
  )
  echo 更新完成！浏览器打开 http://%IP%:3001 验收
  exit /b 0
)

echo [1/3] 打包代码...
tar -czf "%USERPROFILE%\deploy-package.tar.gz" --exclude=node_modules --exclude=dist --exclude=.git --exclude=deploy-package.tar.gz .
if errorlevel 1 (
  echo 打包失败
  exit /b 1
)

echo [2/3] 上传到服务器（输入 root 密码）...
scp "%USERPROFILE%\deploy-package.tar.gz" root@%IP%:/root/
if errorlevel 1 (
  echo 上传失败：检查 IP 与密码
  exit /b 1
)

echo [3/3] 服务器解压 + 重新构建部署（再输入一次 root 密码）...
ssh root@%IP% "rm -rf /opt/digital-human/dist && tar -xzf /root/deploy-package.tar.gz -C /opt/digital-human && cd /opt/digital-human && bash deploy.sh --no-git"
if errorlevel 1 (
  echo 服务器更新失败，请查看上方输出
  exit /b 1
)

echo 更新完成！浏览器打开 http://%IP%:3001 验收
