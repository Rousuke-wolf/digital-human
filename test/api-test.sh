#!/bin/bash
# ── 后端 API 自动化测试脚本 ──────────────────────────
# 用法：先启动后端（node server/index.js），再运行 bash test/api-test.sh
BASE="http://localhost:3001"
PASS=0; FAIL=0
EMAIL="test-$(date +%s)@example.com"

check() { # $1=名称 $2=期望值 $3=实际值
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  ✅ $1"; else FAIL=$((FAIL+1)); echo "  ❌ $1 (期望 $2, 实际 $3)"; fi
}

echo "===== 1. 健康检查 ====="
R=$(curl -s $BASE/api/health); check "health 返回 ok" "ok" "$(echo $R | grep -o '"status":"ok"' | head -1 | sed 's/"status":"//;s/"//')"

echo "===== 2. 用户系统 ====="
R=$(curl -s -X POST $BASE/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"testuser$(date +%s)\",\"email\":\"$EMAIL\",\"password\":\"123456\"}")
TOKEN=$(echo $R | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"//')
[ -n "$TOKEN" ] && check "注册返回 token" "Y" "Y" || check "注册返回 token" "Y" "N"

R=$(curl -s -X POST $BASE/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"other\",\"email\":\"$EMAIL\",\"password\":\"123456\"}")
check "重复注册 → 409" "409" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/register -H 'Content-Type: application/json' -d "{\"username\":\"other\",\"email\":\"$EMAIL\",\"password\":\"123456\"}")"

R=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"123456\"}")
TOKEN2=$(echo $R | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"//')
[ -n "$TOKEN2" ] && check "密码登录成功" "Y" "Y" || check "密码登录成功" "Y" "N"
TOKEN=${TOKEN2:-$TOKEN}

check "错误密码 → 401" "401" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"wrong\"}")"
check "me 带 token → 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/auth/me -H "Authorization: Bearer $TOKEN")"
check "me 无 token → 401" "401" "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/auth/me)"

R=$(curl -s -X POST $BASE/api/auth/change-password -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"oldPassword":"123456","newPassword":"654321"}')
check "修改密码成功" "密码修改成功" "$(echo $R | grep -o '密码修改成功')"
check "新密码可登录" "200" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"654321\"}")"

echo "===== 3. 验证码限流 ====="
C1=$(curl -s -X POST $BASE/api/auth/send-code -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"purpose\":\"login\"}")
C2=$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/send-code -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"purpose\":\"login\"}")
check "60 秒内二次发送 → 429" "429" "$C2"

echo "===== 4. TTS ====="
TTS=$(curl -s -X POST $BASE/tts -H "Content-Type: application/json" -d '{"text":"你好，我是绫韵"}' -o /tmp/tts-test.mp3 -w '%{http_code}|%{content_type}')
check "TTS 返回 200+audio/mpeg" "200|audio/mpeg" "$TTS"
SZ=$(stat -c%s /tmp/tts-test.mp3 2>/dev/null || echo 0)
[ "$SZ" -gt 1000 ] && check "TTS 输出有效音频(>1KB)" "Y" "Y" || check "TTS 输出有效音频(>1KB)" "Y" "N"
check "TTS 空文本 → 400" "400" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/tts -H 'Content-Type: application/json' -d '{"text":""}')"

echo "===== 5. AI 对话（后端代理）====="
check "AI 空 messages → 400" "400" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/ai/chat -H 'Content-Type: application/json' -d '{"messages":[]}')"
AI=$(curl -s -X POST $BASE/api/ai/chat -H "Content-Type: application/json" -d '{"model":"qwen-turbo","messages":[{"role":"system","content":"只输出JSON：{\"message\":\"你好\"} "},{"role":"user","content":"hi"}],"response_format":{"type":"json_object"}}')
echo "  AI 返回内容前100字符: $(echo $AI | head -c 100)"
check "AI JSON 模式返回 choices" "Y" "$(echo $AI | grep -o '"choices"' | head -1 | sed 's/"choices"/Y/')"

echo "===== 6. Meshy 代理链路（不消耗配额，只验证链路不崩溃）====="
# 本机到 api.meshy.ai 网络不通时会返回 502（超时保护），链路本身即验证通过
MC=$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/meshy/text-to-3d -H "Content-Type: application/json" -d '{}')
M=$(curl -s -X POST $BASE/api/meshy/text-to-3d -H "Content-Type: application/json" -d '{}')
if [ "$MC" = "200" ] || [ "$MC" = "400" ] || [ "$MC" = "422" ] || [ "$MC" = "502" ]; then
  check "Meshy 链路返回可处理状态码($MC)" "Y" "Y"
else
  check "Meshy 链路返回可处理状态码($MC)" "Y" "N"
fi
echo "  Meshy 返回: $(echo $M | head -c 120)"

echo "===== 7. /meshy-glb 安全校验 ====="
check "非 meshy 域名 → 400" "400" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/meshy-glb?url=https://evil.com/x.glb")"
check "缺 url → 400" "400" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/meshy-glb")"

echo ""
echo "===== 结果：通过 $PASS 项，失败 $FAIL 项 ====="
