// qwen.js — 通义千问对话 + 图片生成
// 所有 AI 请求统一走后端代理（server/routes/ai.js），
// 密钥只存在于服务端环境变量 DASHSCOPE_API_KEY，前端不持有任何 API Key

const systemPrompt = `
你是"绫韵"，刺绣文化数字人讲解员。只回答刺绣相关问题（历史、四大名绣、苗绣、针法、工具、非遗保护）。非刺绣话题请礼貌拒绝并引导回刺绣。回答亲切专业，100字以内为宜。

你必须严格返回如下格式的 JSON，不要输出任何其他内容：
{
  "message": "对话内容",
  "isGenerateImage": false,
  "imagePrompt": ""
}

isGenerateImage 规则（只有以下情况才设为 true）：
- 用户明确要求"看图""展示""生成图片""画一下"等
- 用户询问某种具体绣品、针法或纹样的视觉样式，图片能显著帮助理解
- 其他正常问答：isGenerateImage=false，imagePrompt 留空字符串

imagePrompt 规则（isGenerateImage=true 时填写）：
- 用中文写，15~30字，描述刺绣主题画面
- 格式示例："中国传统苏绣，精细丝线刺绣，牡丹花卉图案，金丝底布，工笔风格"
- 只输出 JSON，不要有任何前缀、后缀或 markdown 代码块
`;

// ─────────────────────────────────────────────
// 图片生成：后端代理通义万相（提交任务 → 轮询结果）
// 返回图片 URL 字符串，失败则返回 null
// ─────────────────────────────────────────────
export async function generateImage(prompt) {
  try {
    const res = await fetch('/api/ai/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('[qwen] 图片生成失败:', json.message || res.status);
      return null;
    }
    return json.url || null;
  } catch (e) {
    console.warn('[qwen] 图片生成请求异常:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────
// 对话（兼容旧流式接口）：返回 AsyncGenerator
// 每次 yield { __done: false, __message } 传递增量文字
// 结束时 yield { __done: true, message, isGenerateImage, imagePrompt }
// ─────────────────────────────────────────────
export async function* chatWithAIStream(historyMessages = [], userInput) {
  // ── 单次非流式调用 ───────────────────────────────────────────────────────
  // appendAIStream 内部本来就是"收完全部 token 再打字"，流式对用户体验无实际提升
  // 改为非流式可以直接用 response_format:json_object，彻底解决 JSON 解析问题
  // ──────────────────────────────────────────────────────────────────────────
  const messages = [
    ...historyMessages,
    { role: "user", content: userInput }
  ];

  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen-turbo',
        messages,
        response_format: { type: 'json_object' },
      }),
    });
    const completion = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(completion.message || `AI 请求失败 ${res.status}`);
    }

    const raw = completion.choices?.[0]?.message?.content ?? "";

    let data;
    try {
      data = JSON.parse(raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim());
    } catch {
      console.warn("[qwen] JSON解析失败，原文:", raw);
      // 兜底：把原文当 message
      data = { message: raw || "我刚才走神了，你说什么来着？", isGenerateImage: false, imagePrompt: "" };
    }

    const message = typeof data.message === "string" ? data.message : "";
    const isGenerateImage = data.isGenerateImage === true;
    const imagePrompt = typeof data.imagePrompt === "string" ? data.imagePrompt : "";
    const modelIndex = typeof data.modelIndex === "number" ? data.modelIndex : 0;
    const isShowModel = data.isShowModel === true;

    // 逐字 yield，供 appendAIStream 收集（与原流式接口兼容）
    for (const ch of message) {
      yield { __done: false, __message: ch };
    }

    yield { __done: true, message, isGenerateImage, imagePrompt, modelIndex, isShowModel };

  } catch (error) {
    console.error("[qwen] API调用失败:", error.message);
    const fallbackMsg = "系统有点问题，我们稍后再试～";
    for (const ch of fallbackMsg) {
      yield { __done: false, __message: ch };
    }
    yield { __done: true, message: fallbackMsg, isGenerateImage: false, imagePrompt: "", modelIndex: 0, isShowModel: false };
  }
}

export { systemPrompt };
