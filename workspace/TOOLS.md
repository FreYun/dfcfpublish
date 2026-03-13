# TOOLS.md - MCP 工具使用指南

**重要：** 网关 exec 环境里可能没有全局 `mcporter`，一律用 **`npx mcporter`**，且需在 **workspace 目录**（`/home/rooot/.openclaw/workspace`）下执行，才能找到 `config/mcporter.json`。

---

## MCP 搜索工具

### dashscope_websearch（阿里云百炼）

**默认用这个！** API Key 已配置，直接调用。

```bash
# 基本搜索（默认 5 条结果）
npx mcporter call dashscope_websearch.bailian_web_search query="你想搜的内容"

# 指定结果数（最大 10）
npx mcporter call dashscope_websearch.bailian_web_search query="关键词" count=10
```

**特点：**
- ✅ 国内 API，速度快，不抽风
- ✅ 返回标题、URL、摘要、站点 logo
- ✅ 支持中英文搜索
- ✅ 阿里云百炼官方服务，稳定可靠

---

## MCP 图片识别工具

### 首选：image-recognition（阿里云百炼）

**默认用这个！** API Key 已配置。

```bash
# 识别图片 URL
npx mcporter call image-recognition.recognize_image image_url="https://example.com/image.jpg"

# 识别 base64 图片
npx mcporter call image-recognition.recognize_image image_data="data:image/png;base64,..."

# 自定义提示词
npx mcporter call image-recognition.recognize_image image_url="..." custom_prompt="提取这张名片的联系方式"
```

**特点：**
- ✅ 阿里云千问视觉模型，识别准确
- ✅ 支持 OCR、通用图片理解
- ✅ 支持自定义提示词

---

### 备用：paddleocr-mcp（本地 OCR，免费）

**本地 OCR，数据不出内网。**

```bash
# 识别图片 URL
npx mcporter call paddleocr-mcp.ocr_image image_url="https://example.com/image.jpg"

# 识别本地图片
npx mcporter call paddleocr-mcp.ocr_image image_path="/path/to/image.png"

# 识别 base64 图片
npx mcporter call paddleocr-mcp.ocr_image image_base64="data:image/png;base64,..."
```

**特点：**
- ✅ 百度 PaddleOCR v5，本地运行
- ✅ 支持中英文识别
- ✅ 返回文字内容 + 置信度 + 位置
- ✅ 无需 API Key，数据隐私好
- ⚠️ 首次运行需要下载模型（约 200MB）
- ⚠️ 比云服务慢

---

## Browser 浏览器操作准则

### 核心铁律：ref 只用一次
- **任何 ref（e1、e2、e67 等）只在生成它的那一次 snapshot 里有效**
- 页面一旦有明显变化（点进帖子、返回列表、tab切换、滚动刷新），ref 立即失效
- **不允许拿老 snapshot 的 ref 继续乱点**

### 页面变了以后的标准流程
1. 先 `browser snapshot` 或 `browser snapshot compact:true`
2. 用**这次 snapshot 里新出现的 ref** 去点、去 act
3. 同一轮操作只用「当前」这次 snapshot 的 ref，不混用老 snapshot

### 报错识别与处理
**看到以下关键词 = ref 过期，不是服务挂了：**
- "Unknown ref \"xxx\""
- "Element \"xxx\" not found or not visible"

**默认动作：**
- ❌ 不要再用这个 ref 重试
- ❌ 不要认为「browser 挂了」或「gateway 挂了」
- ✅ 先重新 `browser snapshot`，再根据最新 snapshot 选新的 ref

### 长时间刷流（如逛 5 分钟小红书）
- 连续点几次、或者感觉 feed 明显变了，就主动再来一次 `browser snapshot`
- 更新自己的 ref 视图，避免踩「旧 ref 已经指不到东西」的坑

### compact:true 和非 compact 的 snapshot
- **ref 编号完全不是一回事，不能混着用**
- snapshot A（compact）→ 用里面的 e1–e100
- snapshot B（非compact）→ 之后只能用 B 里的 ref，不再用 A

### 什么时候才考虑重启 gateway？
- `browser start` / `browser status` 连续多次失败
- 用户明确说「帮我重启 gateway / browser」

**其他情况一律优先「重新 snapshot + 换 ref」，而不是「重启一切」。**

### 广告与登录拦截处理

**1. 遇到页面广告导致无法点击时：**
- 必须先关闭广告（找关闭按钮/X），再继续操作
- 不要被广告卡住还继续乱点，会导致后续所有点击失效

**2. 遇到强制登录页面时：**
- **立刻停下操作**，不要尝试绕过或继续点击
- 请示用户，等待其完成登录后再继续
- 绝不擅自处理登录流程

### 收尾工作

**浏览器用完了必须关 tab！**

- 任务完成后，立即 `browser close` 关闭刚才打开的 tab
- 不要留着 tab 在那占着

```bash
browser close targetId="刚才那个 tab 的 ID"
```

---

## Gateway 重启权限
- **我不自己重启 gateway**
- 需要重启时告知用户，由用户来操作
