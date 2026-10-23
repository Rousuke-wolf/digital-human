#!/bin/bash
# ── 后端 API 自动化测试脚本 ──────────────────────────
# 用法：先启动后端（node server/index.js），再运行 bash test/api-test.sh
BASE="http://localhost:3001"
PASS=0; FAIL=0
EMAIL="test-$(date +%s)@example.com"

check() { # $1=名称 $2=期望值 $3=实际值
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  ✅ $1"; else FAIL=$((FAIL+1)); echo "  ❌ $1 (期望 $2, 实际 $3)"; fi
}

# 从 SQLite 读/写验证码（模拟用户查收邮件；SMTP 配置与否两种环境通用）
# 注册接口在 SMTP 配置后强制要求 6 位验证码，测试直接读取库中最新码
readcode() {
  node -e 'const D=require("better-sqlite3");const db=new D("server/data/database.db");const r=db.prepare("SELECT code FROM email_verifications WHERE email=? ORDER BY id DESC LIMIT 1").get(process.argv[1]);console.log(r?r.code:"")' "$1"
}
insertcode() {
  node -e 'const D=require("better-sqlite3");const db=new D("server/data/database.db");db.prepare("INSERT INTO email_verifications (email, code, expires_at) VALUES (?, ?, datetime('"'"'now'"'"', '"'"'+5 minutes'"'"'))").run(process.argv[1], process.argv[2])' "$1" "$2"
}

echo "===== 1. 健康检查 ====="
R=$(curl -s $BASE/api/health); check "health 返回 ok" "ok" "$(echo $R | grep -o '"status":"ok"' | head -1 | sed 's/"status":"//;s/"//')"

echo "===== 2. 用户系统 ====="
# 发送验证码（验证码会先入库，邮件是否真实送达不影响注册流程）
curl -s -X POST $BASE/api/auth/send-code -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"purpose\":\"register\"}" > /dev/null
CODE=$(readcode "$EMAIL")
[ -n "$CODE" ] && check "验证码入库" "Y" "Y" || check "验证码入库" "Y" "N"
R=$(curl -s -X POST $BASE/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"testuser$(date +%s)\",\"email\":\"$EMAIL\",\"password\":\"123456\",\"code\":\"$CODE\"}")
TOKEN=$(echo $R | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"//')
[ -n "$TOKEN" ] && check "注册返回 token" "Y" "Y" || check "注册返回 token" "Y" "N"

# 重复注册：向库中插入一枚新验证码（模拟再次收码），同名邮箱再注册 → 409
insertcode "$EMAIL" "888888" > /dev/null
check "重复注册 → 409" "409" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/auth/register -H 'Content-Type: application/json' -d "{\"username\":\"other\",\"email\":\"$EMAIL\",\"password\":\"123456\",\"code\":\"888888\"}")"

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
AI=$(curl -s -X POST $BASE/api/ai/chat -H "Content-Type: application/json" -H "X-Guest-Id: api-test-json-$(date +%s)" -d '{"model":"qwen3.8-flash","messages":[{"role":"system","content":"只输出JSON：{\"message\":\"你好\"} "},{"role":"user","content":"hi"}],"response_format":{"type":"json_object"}}')
echo "  AI 返回内容前100字符: $(echo $AI | head -c 100)"
check "AI JSON 模式返回 choices" "Y" "$(echo $AI | grep -o '"choices"' | head -1 | sed 's/"choices"/Y/')"

echo "===== 6. Meshy 代理链路（不消耗配额，只验证链路不崩溃）====="
# 未登录访问 → 401 LOGIN_REQUIRED（额度体系：3D 生成需登录）
M401=$(curl -s -X POST $BASE/api/meshy/text-to-3d -H "Content-Type: application/json" -d '{}')
check "Meshy 未登录 → 401+LOGIN_REQUIRED" "LOGIN_REQUIRED" "$(echo $M401 | grep -o 'LOGIN_REQUIRED')"
# 带 token：本机到 api.meshy.ai 网络不通时会返回 502（超时保护），链路本身即验证通过
MC=$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/meshy/text-to-3d -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{}')
M=$(curl -s -X POST $BASE/api/meshy/text-to-3d -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{}')
if [ "$MC" = "200" ] || [ "$MC" = "400" ] || [ "$MC" = "422" ] || [ "$MC" = "502" ]; then
  check "Meshy 链路返回可处理状态码($MC)" "Y" "Y"
else
  check "Meshy 链路返回可处理状态码($MC)" "Y" "N"
fi
echo "  Meshy 返回: $(echo $M | head -c 120)"

echo "===== 7. /meshy-glb 安全校验 ====="
check "非 meshy 域名 → 400" "400" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/meshy-glb?url=https://evil.com/x.glb")"
check "缺 url → 400" "400" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/meshy-glb")"

echo "===== 8. 额度体系与个人中心（必做项 4）====="
IMG401=$(curl -s -X POST $BASE/api/ai/image -H "Content-Type: application/json" -d '{"prompt":"测试纹样"}')
check "纹样生成未登录 → 401+LOGIN_REQUIRED" "LOGIN_REQUIRED" "$(echo $IMG401 | grep -o 'LOGIN_REQUIRED')"
U401=$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/user/usage)
check "额度查询未登录 → 401" "401" "$U401"
W401=$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/user/works)
check "作品查询未登录 → 401" "401" "$W401"

UG=$(curl -s $BASE/api/user/usage -H "Authorization: Bearer $TOKEN")
check "额度查询 → 含 4 项功能" "Y" "$(echo $UG | grep -o '"feature":"chat"' | head -1 | sed 's/.*/Y/')"

W1=$(curl -s -X POST $BASE/api/user/works -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"type":"pattern","name":"测试纹样","data":"http://test/1.png","payload":{"theme":"苗绣"}}')
check "新增作品 → 201" "201" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/user/works -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -d '{"type":"pattern","name":"测试纹样2","data":"http://test/2.png"}')"
WID=$(echo $W1 | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
W2=$(curl -s -X POST $BASE/api/user/works -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"type":"pattern","name":"测试纹样","data":"http://test/1.png","payload":{"theme":"苗绣"}}')
check "重复作品 → 去重 duplicated" "true" "$(echo $W2 | grep -o '"duplicated":true' | sed 's/"duplicated"://')"
check "作品列表含新作品" "Y" "$(curl -s $BASE/api/user/works -H "Authorization: Bearer $TOKEN" | grep -o 'http://test/1.png' | head -1 | sed 's/.*/Y/')"
WM=$(curl -s -X POST $BASE/api/user/works/merge -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"works":[{"type":"model3d","name":"测试模型","data":"http://test/m.glb","payload":{"prompt":"花瓶"}},{"type":"pattern","name":"测试纹样","data":"http://test/1.png"}]}')
check "合并作品 → 新增1件(去重1件)" "1" "$(echo $WM | grep -o '"added":[0-9]*' | grep -o '[0-9]*')"
check "删除作品 → ok" "true" "$(curl -s -X DELETE $BASE/api/user/works/$WID -H "Authorization: Bearer $TOKEN" | grep -o '"ok":true' | sed 's/"ok"://')"
check "删除他人/不存在作品 → 404" "404" "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE $BASE/api/user/works/999999 -H "Authorization: Bearer $TOKEN")"
# 游客对话走额度门禁（带游客标识请求一次，验证链路放行；真实 429 上限手动验证）
GID="api-test-guest-$(date +%s)"
GC=$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/ai/chat -H "Content-Type: application/json" -H "X-Guest-Id: $GID" -d '{"model":"qwen3.8-flash","messages":[{"role":"user","content":"你好"}]}')
if [ "$GC" = "200" ] || [ "$GC" = "502" ]; then
  check "游客对话经额度门禁放行($GC)" "Y" "Y"
else
  check "游客对话经额度门禁放行($GC)" "Y" "N"
fi
# 纹样解析标记：未登录带 quota_feature=pattern 应被拒（需登录）
PA=$(curl -s -X POST $BASE/api/ai/chat -H "Content-Type: application/json" -H "X-Guest-Id: $GID" -d '{"quota_feature":"pattern","messages":[{"role":"user","content":"你好"}]}')
check "游客带 pattern 标记 → LOGIN_REQUIRED" "LOGIN_REQUIRED" "$(echo $PA | grep -o 'LOGIN_REQUIRED')"

echo "===== 9. 成长体系：任务 / 会员 / 兑换码 ====="
# 注册第二个普通用户（403 鉴权与任务/兑换流程用）
EMAIL2="test2-$(date +%s)@example.com"
curl -s -X POST $BASE/api/auth/send-code -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL2\",\"purpose\":\"register\"}" > /dev/null
CODE2=$(readcode "$EMAIL2")
R2=$(curl -s -X POST $BASE/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"user2$(date +%s)\",\"email\":\"$EMAIL2\",\"password\":\"123456\",\"code\":\"$CODE2\"}")
TOKEN2=$(echo $R2 | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"//')
[ -n "$TOKEN2" ] && check "注册第二个用户" "Y" "Y" || check "注册第二个用户" "Y" "N"

check "普通用户访问管理接口 → 403" "403" "$(curl -s -o /dev/null -w '%{http_code}' $BASE/api/admin/stats -H "Authorization: Bearer $TOKEN2")"

# 任务（阶段制）：图谱探索事件 ×3 → 阶段0/阶段1 达标 → 分别领取
for i in 1 2 3; do
  curl -s -X POST $BASE/api/user/tasks/event -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN2" -d '{"task":"graph"}' > /dev/null
done
UG2=$(curl -s $BASE/api/user/usage -H "Authorization: Bearer $TOKEN2")
check "graph 总进度 3/6，阶段0/1 达标" "Y" "$(echo $UG2 | grep -o '"progress":3,"target":6' | head -1 | sed 's/.*/Y/')"
CL=$(curl -s -X POST $BASE/api/user/tasks/claim -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN2" -d '{"task":"graph","stage":1}')
check "领取 graph 阶段1（探索3→纹样+3）" "true" "$(echo $CL | grep -o '"ok":true' | sed 's/"ok"://')"
UG2B=$(curl -s $BASE/api/user/usage -H "Authorization: Bearer $TOKEN2")
check "纹样额度 10→13（阶段1加成）" "Y" "$(echo $UG2B | grep -o '"limit":13' | head -1 | sed 's/.*/Y/')"
CL0=$(curl -s -X POST $BASE/api/user/tasks/claim -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN2" -d '{"task":"graph","stage":0}')
check "领取 graph 阶段0（探索1→对话+10）" "true" "$(echo $CL0 | grep -o '"ok":true' | sed 's/"ok"://')"
check "重复领取幂等 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/user/tasks/claim -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN2" -d '{"task":"graph","stage":1}')"
check "未达标阶段领取 → 400" "400" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/user/tasks/claim -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN2" -d '{"task":"share","stage":1}')"
CK=$(curl -s -X POST $BASE/api/user/tasks/checkin -H "Authorization: Bearer $TOKEN2")
UG2C=$(curl -s $BASE/api/user/usage -H "Authorization: Bearer $TOKEN2")
check "签到后对话额度 90（+20 签到 +10 graph阶段0）" "Y" "$(echo $UG2C | grep -o '"feature":"chat"[^}]*"limit":90' | head -1 | sed 's/.*/Y/')"
check "签到任务进度 1/1" "Y" "$(echo $UG2C | grep -o '"progress":1,"target":1,"done":true' | head -1 | sed 's/.*/Y/')"

# 兑换码：用户1 提为 admin 并重新登录刷新角色 → 生成码 → 用户2 兑换
node -e 'const D=require("better-sqlite3");const db=new D("server/data/database.db");db.prepare("UPDATE users SET role='"'"'admin'"'"' WHERE email=?").run(process.argv[1])' "$EMAIL"
RADM=$(curl -s -X POST $BASE/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"654321\"}")
TOKEN=$(echo $RADM | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"//')
check "admin 登录拿到新 token" "Y" "$([ -n "$TOKEN" ] && echo Y || echo N)"
AD=$(curl -s -X POST $BASE/api/admin/codes -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"package":"VIP7","count":1,"batch":"api-test"}')
CODEVIP=$(echo $AD | grep -o '"codes":\["[^"]*"' | sed 's/"codes":\["//;s/"//')
check "admin 生成兑换码" "Y" "$([ -n "$CODEVIP" ] && echo Y || echo N)"
RD=$(curl -s -X POST $BASE/api/user/redeem -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN2" -d "{\"code\":\"$CODEVIP\"}")
check "兑换 VIP7" "true" "$(echo $RD | grep -o '"ok":true' | sed 's/"ok"://')"
UG2D=$(curl -s $BASE/api/user/usage -H "Authorization: Bearer $TOKEN2")
check "会员激活 vip.active" "true" "$(echo $UG2D | grep -o '"active":true' | head -1 | sed 's/"active"://')"
check "会员后纹样额度 23（10×2+3）" "Y" "$(echo $UG2D | grep -o '"limit":23' | head -1 | sed 's/.*/Y/')"
check "重复兑换 → 400" "400" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $BASE/api/user/redeem -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN2" -d "{\"code\":\"$CODEVIP\"}")"
AD2=$(curl -s -X POST $BASE/api/admin/codes -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"package":"PATTERN5","count":1,"batch":"api-test"}')
CODEP=$(echo $AD2 | grep -o '"codes":\["[^"]*"' | sed 's/"codes":\["//;s/"//')
curl -s -X POST $BASE/api/user/redeem -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN2" -d "{\"code\":\"$CODEP\"}" > /dev/null
UG2E=$(curl -s $BASE/api/user/usage -H "Authorization: Bearer $TOKEN2")
check "credits.pattern = 5（额度包）" "Y" "$(echo $UG2E | grep -o '"credits":{"chat":[0-9]*,"pattern":5' | head -1 | sed 's/.*/Y/')"
AD3=$(curl -s -X POST $BASE/api/admin/codes -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"package":"CHAT50","count":1,"batch":"api-test"}')
NEWID=$(curl -s $BASE/api/admin/codes -H "Authorization: Bearer $TOKEN" | grep -o '"id":[0-9]*,"code":"[^"]*","package":"CHAT50"' | head -1 | grep -o '"id":[0-9]*' | grep -o '[0-9]*')
check "作废未使用码" "true" "$(curl -s -X POST $BASE/api/admin/codes/$NEWID/revoke -H "Authorization: Bearer $TOKEN" | grep -o '"ok":true' | sed 's/"ok"://')"
VP=$(curl -s -X POST $BASE/api/user/vip/purchase -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN2" -d '{"plan":"week"}')
check "模拟购买周卡" "true" "$(echo $VP | grep -o '"ok":true' | sed 's/"ok"://')"
ST=$(curl -s $BASE/api/admin/stats -H "Authorization: Bearer $TOKEN")
check "admin 统计返回 userCount" "Y" "$(echo $ST | grep -o '"userCount"' | head -1 | sed 's/.*/Y/')"

echo ""
echo "===== 结果：通过 $PASS 项，失败 $FAIL 项 ====="
