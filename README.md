# SwapCampus 校园闲置物品交易平台

> 一个面向课程设计交付的校园二手交易系统，当前已实现从浏览、发布、沟通、下单到审核治理的完整主链路，并支持 Docker 一键部署。

## 项目概述
- 当前形态：`React + NestJS` 前后端分离，后端仍是单体服务，不是微服务架构
- 交付目标：让老师和评审看到真实业务闭环、可复现部署方式和清晰的软件工程痕迹
- 适用场景：课程答辩、本地演示、小规模校内试用

## 当前已完成功能
- 认证与角色
  - 支持普通用户、管理员两类认证账号，以及未登录浏览态
  - 已接入 `SuperTokens`，支持邮箱或学号登录、普通用户注册、封禁账号拦截
- 商品浏览、筛选、发布、审核
  - 首页支持真实商品流、搜索、分类、折叠筛选和推荐流
  - 发布页支持分类、成色、价格、描述、规则提示和审核拦截
  - 管理员可审核商品上架、下架和处理违规内容
- 商品详情、举报、推荐
  - 详情页展示图片、交易参考、卖家可信度、同类推荐
  - 支持举报商品或用户，并在后台处理
  - 推荐模块已接入行为记录，支持浏览、想要、联系、下单等信号
- 订单闭环
  - 支持线下面交订单创建、状态流转、取消、完成和评价
  - 订单创建后会自动生成关联会话，形成完整交易留痕
- 消息会话与演示级实时推送
  - 支持会话列表、消息明细、文本发送
  - 支持基于 Socket.IO 的实时追加，握手与会话订阅已接入认证校验
- 校园服务子模块
  - 独立支持跑腿、代办、拼单、临时帮忙
  - 已实现任务发布、接单、完成和消息联动
- 后台治理
  - 支持商品审核、举报处理、用户封禁/解封、操作留痕
  - 管理后台可查看待审核、待处理举报和治理摘要
- 发布前 LLM 审核
  - 商品和校园服务发布前会先走本地规则，再走 DeepSeek 二次审核与分类建议
  - 通过环境变量配置 `DEEPSEEK_API_KEY`，未配置时自动跳过 LLM 审核
- Docker 化部署与 CI
  - 提供 `docker-compose.yml`、前后端 Dockerfile、Makefile
  - 提供 GitHub Actions 基础 CI：后端 Jest 测试、前端构建检查

## 当前不成熟 / 已知边界
- Socket.IO 目前只是演示级实时推送，缺少已读回执、在线状态、断线补偿等完整 IM 能力
- 登录用户的“想要/收藏”已接入后端 `Favorite` 表，游客仍保留本地临时想要
- 当前认证已统一到 `SuperTokens session`，但仍未补 refresh / rotation 等更完整的会话治理策略
- MinIO、媒体上传和商品多图链路已落地，后续仍可继续增强媒体治理和生产化能力
- 自动化验证目前以后端 Jest 和前端 build 为主，前端交互级测试还不充分

## 技术栈与架构现状
- Frontend：React 18 + TypeScript + Vite + Ant Design
- Backend：NestJS + TypeScript + Prisma
- Database：MySQL 8
- Object Storage：MinIO
- Realtime：Socket.IO
- Deploy：Docker Compose + Nginx 静态托管前端

当前架构关键词：
- 前后端分离
- 单体后端按领域模块拆分
- Prisma 统一数据访问
- Docs as Code
- IaC
- 事件驱动预留

## 文档与规范入口

- `README.md`
  - 项目总览、运行方式、目录入口
- `AGENT.md`
  - 给自动化 agent 的总入口，先看工程规范，再看课程文档
- `agent/`
  - 当前有效工程规范，涉及结构、领域、数据和 UI 的改动优先以这里为准
- `docs/00-文档目录.md`
  - 当前有效课程文档与专题分析索引
- `docs/archive/`
  - 历史过程材料、课程表单、已归档专题，不作为当前基线直接维护

## 当前项目结构
```text
SwapCampus
├── .github/workflows/ci.yml
├── Makefile
├── docker-compose.yml
├── README.md
├── AGENT.md
├── backend
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma
│   │   ├── schema.prisma
│   │   ├── init.ts
│   │   ├── remove-demo-data.ts
│   │   ├── seed-demo-data.ts
│   │   └── ...
│   └── src
│       ├── app.module.ts
│       ├── main.ts
│       ├── prisma/prisma.service.ts
│       └── modules
│           ├── admin
│           ├── auth
│           ├── campus-services
│           ├── credit-center
│           ├── favorites
│           ├── health
│           ├── media
│           ├── messages
│           ├── orders
│           ├── products
│           ├── recommendations
│           ├── reports
│           ├── search
│           └── users
├── frontend
│   ├── Dockerfile
│   ├── package.json
│   └── src
│       ├── components
│       ├── constants
│       ├── pages
│       ├── router
│       ├── services
│       ├── styles
│       ├── theme
│       ├── utils
│       └── ...
├── agent
│   ├── INDEX.md
│   ├── governance
│   ├── domain
│   ├── architecture
│   ├── data
│   └── ui
├── docs
│   ├── 00-文档目录.md
│   ├── 01-项目开题报告.md
│   ├── ...
│   └── archive
│       ├── README.md
│       ├── forms
│       ├── planning
│       ├── process
│       └── technical
├── infra
│   ├── architecture.md
│   ├── generate-screenshots.mjs
│   ├── load-test-plan.md
│   └── notes.md
├── db
│   └── seed-plan.md
└── artifacts
    └── screenshots
```

关键目录说明：
- `backend/src/modules`：按领域拆分的单体后端模块，当前业务核心都在这里
- `backend/prisma`：数据库模型、初始化、种子数据和补齐脚本
- `frontend/src/pages`：主要页面入口，包括首页、详情、发布、消息、个人中心、校园服务、下单和后台
- `frontend/src/services`：前端接口调用、登录态、收藏、行为埋点封装
- `agent`：当前有效工程规范入口
- `docs`：当前有效课程设计文档、专题分析和交付材料
- `docs/archive`：历史过程材料、课程表单和归档专题
- `infra`：架构说明、压测计划和辅助脚本
- `artifacts/screenshots`：页面截图和验收素材

## 本地部署与运行验证
### 环境要求
- Docker Desktop
- 如果只按 Docker 方式运行，不要求提前安装本地 MySQL

### 启动
```bash
make init
make start
```

说明：
- `db-init` 现在是一次性初始化任务，放在 `init` profile 下
- 首次启动或需要重置数据时，先执行 `db-init`
- `db-init` 只负责建表与基础初始化，不再自动写入商品、服务、用户演示数据
- 如需显式清库重置，执行 `make init-reset`
- 日常开发重启 `backend` / `frontend` 不会再重复触发数据库 reset 和 seed
- 默认运行态服务是 `mysql`、`minio`、`meilisearch`、`supertokens-db`、`supertokens`、`vendure`、`backend`、`frontend`
- 前端生产镜像使用 `nginx` 托管静态资源
- 默认认证 Core 使用容器内自托管 `http://supertokens:3567`
- SuperTokens 通过独立 PostgreSQL 容器持久化认证数据，容器重启后账号不会丢失
- `backend` 会等待 `supertokens` 健康后再启动，避免认证接口在默认开发环境下处于不可用状态
- `make start` / `make restart-auth` 会自动清理历史遗留容器 `swapcampus-supertokens-local`，避免占用 `3567` 端口

### 访问地址
- Frontend：`http://127.0.0.1:5178`
- Backend Health：`http://127.0.0.1:3001/api/health`
- Socket.IO：`http://127.0.0.1:3001`
- MinIO Console：`http://localhost:9001`

### 重置数据
```bash
docker compose down -v
make init
make start
```

如果只想强制重建数据库结构但不先手动 `down -v`：

```bash
make init-reset
make start
```

如果只想重建演示数据而不重建容器：

```bash
cd backend && npm run db:reset-and-seed-demo
```

### 基本验证命令
```bash
docker compose ps
docker compose logs backend --tail=50
curl http://127.0.0.1:3001/api/health
```

### 常用命令
```bash
make install
make init
make init-reset
make up
make start
make restart-auth
make restart-backend
make status
make health
make down
make logs
make backend-test
make frontend-build
```

### API 与环境变量单独配置

容器部署推荐在仓库根目录创建 `.env`，模板见 `.env.example`。

最常用的独立配置项：

- 后端运行时：`API_DOMAIN`、`WEBSITE_DOMAIN`
- 前端构建时：`VITE_API_BASE_URL`、`VITE_API_DOMAIN`、`VITE_SOCKET_URL`、`VITE_WEBSITE_DOMAIN`
- 外部密钥：`SUPERTOKENS_API_KEY`、`VENDURE_ADMIN_TOKEN`、`DEEPSEEK_API_KEY`

注意：

- 修改 `VITE_*` 后需要重建前端镜像
- 仅修改后端变量时，重启相关容器即可
- 更完整的 AI 执行步骤和 ignore 文件分发说明见 [docs/27-AI部署启动与测试指南.md](/home/th1rt3en/dev/forge/SwapCampus/docs/27-AI部署启动与测试指南.md)

## 演示路径
### 推荐演示路径
1. 打开 `http://127.0.0.1:5178`
2. 注册或登录普通用户
3. 发布商品、收藏、下单、发消息、进入校园服务和信用中心

## 后续微服务拆分建议
当前系统仍适合维持单体后端，不建议为了课程项目过早拆微服务。更合理的演进顺序如下：

### 阶段 1：先把单体模块边界做稳
- 继续按 `auth`、`products`、`orders`、`messages`、`admin`、`recommendations`、`campus-services` 分领域维护
- 先补完整鉴权、缓存层和领域事件发布接口
- 保持一个数据库，优先把测试、日志和监控补完整

### 阶段 2：优先拆高耦合但可独立演进的服务
- `messages`：可拆为独立消息服务，负责会话、消息、推送和在线状态
- `recommendations`：可拆为推荐服务，负责行为采集、召回、排序和批处理任务
- `admin-audit`：可拆为治理服务，负责审核、举报、封禁、审计日志

### 阶段 3：再视流量拆核心交易域
- 当商品查询和订单写入压力明显上升后，再考虑拆 `products` 和 `orders`
- 此阶段再引入 API Gateway、Redis、消息队列和统一鉴权
- 不建议在用户量和并发都较小的阶段提前上复杂微服务基础设施

## 数据库表设计与技术栈选择建议
### 当前技术栈选择
- 当前继续使用 `MySQL 8 + Prisma` 最合适
- 原因：
  - 数据模型以交易、订单、消息、举报、审核为主，强事务和结构化关系明显
  - Prisma 对 TypeScript 项目友好，课程项目迭代成本低
  - MySQL 8 对当前数据规模和并发目标完全够用

### 当前核心表
- `User`
- `StudentVerification`
- `Product`
- `ProductImage`
- `Favorite`
- `Order`
- `CampusServiceListing`
- `CampusServiceOrder`
- `Review`
- `Conversation`
- `Message`
- `Report`
- `AuditLog`
- `UserBehavior`

### 后续数据库演进建议
- 在高并发前，优先补索引、缓存、慢查询治理和读写分离，不建议过早换数据库类型
- 如果后续做更强搜索，可增加 Elasticsearch 作为搜索侧能力，不替换主交易库
- 如果后续做更强推荐和热点缓存，可增加 Redis，但 MySQL 仍应保留为主业务数据源
- 收藏、多端同步、审计查询等能力优先在现有表基础上渐进增强，不建议先做大规模重构

## 当前验证结果
- 后端测试命令：`npm test --prefix backend`
- 前端构建命令：`npm run build --prefix frontend`
- Docker 部署方式已按当前仓库结构设计为本地可复现模式

## 页面截图
- 首页：[home-final.png](/home/th1rt3en/dev/forge/SwapCampus/artifacts/screenshots/home-final.png)
- 登录：[login-final.png](/home/th1rt3en/dev/forge/SwapCampus/artifacts/screenshots/login-final.png)
- 详情：[detail-final.png](/home/th1rt3en/dev/forge/SwapCampus/artifacts/screenshots/detail-final.png)
- 发布：[publish-final.png](/home/th1rt3en/dev/forge/SwapCampus/artifacts/screenshots/publish-final.png)
- 消息：[messages-final.png](/home/th1rt3en/dev/forge/SwapCampus/artifacts/screenshots/messages-final.png)
- 个人中心：[profile-final.png](/home/th1rt3en/dev/forge/SwapCampus/artifacts/screenshots/profile-final.png)
- 后台：[admin-final.png](/home/th1rt3en/dev/forge/SwapCampus/artifacts/screenshots/admin-final.png)
