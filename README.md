# TTPUB 交接部署指南

本仓库包含 bot9（公众号运营强哥）、bot12（小天爱黄金）、bot15（搞钱小财迷）的完整运行环境。

---

## 目录结构

```
.
├── openclaw.json.template    # 脱敏配置模板（部署第一步）
├── architecture.html         # 系统架构可视化
├── config/                   # MCP 全局配置
├── commercial/               # 商业化系统（Vue 前端 + Node 后端）
├── dashboard/                # 运营仪表盘
├── portfolio-service/        # A股模拟组合 MCP 服务
├── mem0/                     # 记忆向量化框架
├── extensions/               # 飞书等渠道扩展
├── shared/                   # 共享模块
├── vendor/                   # 依赖
├── scripts/                  # 运维脚本
├── docs/                     # 文档
├── tools/                    # 工具脚本
├── completions/              # Shell 补全
├── workspace/                # 通用 skill 模板 & 工具规范
│   ├── TOOLS_COMMON.md
│   ├── AGENTS_COMMON/
│   ├── mcp-servers/          # 内置 MCP（ddg-search, paddleocr）
│   └── skills/               # 通用 skill 库
│       ├── helm/             # ⛑️ 工种
│       ├── armor/            # 👔 职业能力
│       ├── accessory/        # 💍 内容风格
│       ├── research/         # ⚔️ 研究技能（29 个）
│       ├── utility/          # 🔧 通用工具（16 个）
│       ├── portfolio/        # 📊 组合管理
│       └── scheduled/        # ⏰ 定时任务
├── workspace-bot9/           # bot9 workspace
├── workspace-bot12/          # bot12 workspace
└── workspace-bot15/          # bot15 workspace
```

## 前置环境

| 依赖 | 版本 | 用途 |
|------|------|------|
| Node.js | >= 22 | OpenClaw 核心、commercial、dashboard |
| Python | >= 3.10 | portfolio-service、mem0、MCP servers |
| Go | >= 1.21 | xiaohongshu-mcp 编译（源码另给） |
| npm 或 pnpm | 最新 | |

## 启动整套系统

### 第 1 步：安装 OpenClaw

```bash
npm install -g openclaw@2026.2.26
openclaw onboard --install-daemon
```

### 第 2 步：部署本仓库

```bash
git clone git@github.com:FreYun/dfcfpublish.git ~/.openclaw
cd ~/.openclaw
```

### 第 3 步：配置 openclaw.json

```bash
cp openclaw.json.template openclaw.json
```

编辑 `openclaw.json`，替换所有 `<YOUR_...>` 占位符：

| 占位符 | 说明 | 获取方式 |
|--------|------|---------|
| `<YOUR_API_KEY>` | LLM provider API Key | 百炼/OpenAI/Anthropic 控制台 |
| `<YOUR_BASE_URL>` | LLM provider API 地址 | 同上 |
| `<YOUR_APP_SECRET>` | 飞书应用 App Secret | 飞书开放平台 |
| `<YOUR_GATEWAY_TOKEN>` | Gateway 认证 token | `openssl rand -hex 32` |
| `<YOUR_GATEWAY_REMOTE_URL>` | Gateway WebSocket 地址 | 如 `ws://127.0.0.1:18789` |
| `<YOUR_TUSHARE_TOKEN>` | Tushare API Token | tushare.pro 注册获取 |
| `<YOUR_OPENCLAW_DIR>` | 安装目录绝对路径 | 如 `/home/user/.openclaw` |

### 第 4 步：安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 第 5 步：部署 MCP 服务

按以下顺序启动各 MCP 服务：

#### 5.1 小红书 MCP（源码另给）

```bash
cd /path/to/xiaohongshu-mcp
go build -o xiaohongshu-mcp .

# 首次启动用有头模式登录小红书
./xiaohongshu-mcp --headless=false -port=:18060 -profiles-base=$HOME/.xhs-profiles
# 在浏览器中完成小红书登录后，Ctrl+C 停掉

# 正式启动（无头模式，后台运行）
nohup ./xiaohongshu-mcp --headless=true -port=:18060 -profiles-base=$HOME/.xhs-profiles > /tmp/xhs-mcp.log 2>&1 &
```

每个 bot 有独立的 Chrome profile 目录（`~/.xhs-profiles/botN/`），需要分别登录。

#### 5.2 Portfolio MCP

```bash
cd ~/.openclaw/portfolio-service
python -m venv venv && source venv/bin/activate
pip install -e .
export TUSHARE_TOKEN="你的tushare_token"
nohup python run_service.py --port 18070 > data/service.log 2>&1 &
```

#### 5.3 其他 MCP

以下 MCP 需要自行部署，确保端口与 mcporter.json 中一致：

| 服务 | 端口 | 说明 |
|------|------|------|
| image-gen-mcp | :18085 | 图片生成服务 |
| compliance-mcp | :18090 | 合规审核服务 |
| finance-data | :8000 | 金融数据服务 |
| research-mcp | 远程 | 替换 mcporter.json 中 `<YOUR_RESEARCH_MCP_HOST>` |

### 第 6 步：部署 Commercial 系统

```bash
cd ~/.openclaw/commercial

# 生成密钥文件
openssl rand -hex 32 > server/.jwt-secret
openssl rand -hex 32 > server/.research-approval-token

# 创建客户白名单
cat > white_id.json << 'EOF'
{
  "accounts": [
    {"username": "admin", "password": "修改为强密码", "display_name": "管理员", "company": ""}
  ]
}
EOF

# 前端构建
cd client && npm install && npm run build && cd ..

# 后端安装
cd server && npm install && cd ..

# 启动（端口 :18900）
./start.sh
```

### 第 7 步：部署 Dashboard

```bash
cd ~/.openclaw/dashboard
npm install
./start.sh   # 端口 :18888
```

### 第 8 步：部署 Mem0（可选）

```bash
cd ~/.openclaw/mem0
pip install mem0ai fastapi uvicorn qdrant-client openai
# 编辑 config.py 配置向量数据库地址和 embedding 模型
python server.py
```

### 第 9 步：启动 Gateway

```bash
openclaw gateway --port 18789
```

Gateway 启动后，bot 会自动连接飞书等渠道，开始工作。

## 端口清单

| 端口 | 服务 | 启动方式 |
|------|------|---------|
| 8000 | finance-data | 自行部署 |
| 18060 | xiaohongshu-mcp | `./xiaohongshu-mcp --headless=true -port=:18060` |
| 18070 | portfolio-mcp | `python run_service.py --port 18070` |
| 18085 | image-gen-mcp | 自行部署 |
| 18090 | compliance-mcp | 自行部署 |
| 18789 | openclaw gateway | `openclaw gateway --port 18789` |
| 18888 | dashboard | `cd dashboard && ./start.sh` |
| 18900 | commercial | `cd commercial && ./start.sh` |

## Bot Workspace 说明

| 文件 | 作用 |
|------|------|
| `IDENTITY.md` | 名字、人设、性格 |
| `SOUL.md` | 核心价值观、行为底线 |
| `AGENTS.md` | 工作流程、记忆系统、发布规则 |
| `TOOLS.md` | 工具配置（引用 workspace/TOOLS_COMMON.md） |
| `USER.md` | 运营方对该 bot 的要求 |
| `HEARTBEAT.md` | 空闲时巡检任务 |
| `EQUIPPED_SKILLS.md` | 已装备的 skill 清单 |
| `config/mcporter.json` | MCP 服务连接配置 |
| `skills/` | 技能目录（symlink 指向 workspace/skills/） |

## Skill 体系

通用 skill 在 `workspace/skills/` 下按分类管理，各 bot 通过 symlink 引用。
修改 `workspace/skills/` 下的源文件，所有 bot 自动生效。

| 分类 | 图标 | 说明 |
|------|------|------|
| `helm` | ⛑️ | 工种 — 决定 bot 角色定位 |
| `armor` | 👔 | 职业 — 主要工作能力 |
| `accessory` | 💍 | 风格 — 内容/画图风格 |
| `research` | ⚔️ | 研究 — 分析与通识参考 |
| `utility` | 🔧 | 通用 — 职能工具 |
| `portfolio` | 📊 | 组合 — 投顾相关 |
| `scheduled` | ⏰ | 定时 — 定时执行的任务 |

详见 `workspace/skills/META-SKILL-README.md` 和 `workspace/skills/SKILL-GUIDE.md`。

## 注意事项

- `openclaw.json` 包含所有密钥，**不要提交到 git**（已在 .gitignore 中）
- 小红书 MCP cookie 存在 Chrome profile 目录中，**不要强杀 Chrome 进程**（会丢 cookie）
- 重启 MCP 服务用 `lsof -ti:端口 | xargs kill`，**不要用 pkill**
- bot 的 `SOUL.md` 和 `IDENTITY.md` 定义了人设底线，修改需谨慎
- Skill 是 symlink 架构，改 `workspace/skills/` 下的源文件即可，无需手动同步到各 bot
