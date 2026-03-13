# TOOLS.md - bot4 工具配置

> **首先 `Read ../workspace/TOOLS_COMMON.md` 获取统一工具规范，再看下面的 bot 专属配置。**

---

## Bot 专属配置

- **account_id**: `bot4`
- **小红书 MCP 端口**: 18064（共享实例，已配置在 mcporter.json）

## 技能地图

| 技能 | 触发词 | 说明 |
|------|--------|------|
| `/report-digest` | 上传研报、"帮我看看这份研报" | 研报速读拆解 |
| `/report-compare` | "对比一下"、上传多份研报 | 多研报交叉对比 |
| `/report-critique` | "靠谱吗"、"挑挑毛病" | 批判性审阅 |
| `/report-to-post` | "发一篇"、"写成小红书" | 研报转小红书内容 |

## 研报处理说明

- **研报存放目录**：`reports/`（workspace 根目录下）。用户上传的研报 PDF 统一存放在此目录
- 用户上传 PDF 时，使用 Read 工具分页阅读
- 大型 PDF（>20页）先读前 5 页判断类型，再按需读取关键章节
- 盈利预测表通常在研报末尾 2-3 页，务必不要遗漏
- 可用 `Glob("reports/**/*.pdf")` 查看已有研报列表
