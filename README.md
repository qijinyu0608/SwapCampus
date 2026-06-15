# SwapCampus 校园闲置物品交易平台

SwapCampus 是一个面向课程设计交付的校园闲置交易系统，围绕浏览、发布、沟通、下单和审核治理等主链路组织实现，并提供可复现的 Docker 部署方式。

## 项目概述

仓库采用 `React + NestJS` 的前后端分离架构，后端保持单体形态，便于在课程项目周期内稳定交付。项目的重点不是堆砌功能，而是把需求、设计、实现、测试、部署和文档对应起来，形成一套能够演示、复核和继续迭代的工程成果。

系统适合课程答辩、本地演示和小规模校内试用。

## 当前已完成功能

认证链路已经接入 `SuperTokens`，支持邮箱或学号登录、普通用户注册和封禁账号拦截。商品部分覆盖首页流、搜索、分类、详情、发布和后台审核；详情页可以展示图片、卖家信息、交易参考和同类推荐，也保留了举报入口与行为信号。订单链路支持创建、状态流转、取消、完成、评价和申诉，订单建立后会自动关联会话，保证交易留痕。

消息模块已支持会话列表、消息明细和文本发送，并接入 `Socket.IO` 做演示级实时追加。校园服务子模块围绕跑腿、代办、拼单和临时帮忙展开，已具备发布、接单、完成和消息联动能力。后台侧则覆盖商品审核、举报处理、用户封禁与解封等治理动作，同时保留操作留痕。商品与校园服务在发布前会先经过本地规则校验，再按配置决定是否进入 `DeepSeek` 二次审核。

仓库同时提供 `docker-compose.yml`、前后端 Dockerfile、Makefile 和基础 CI，便于本地复现和交付检查。

## 当前边界

消息能力目前仍以演示级实时推送为主，尚未补齐已读回执、在线状态和断线补偿。登录用户的收藏已经落库，游客侧仍保留本地临时想要。认证链路虽然已统一到 `SuperTokens session`，但 refresh 和 rotation 等会话治理还可以继续完善。MinIO、媒体上传和商品多图链路已经落地，生产化媒体治理仍有提升空间。自动化验证目前以后端 Jest 和前端构建为主，前端交互级测试还不够完整。

## 技术栈与架构现状

前端采用 React 18、TypeScript、Vite 和 Ant Design。后端采用 NestJS、TypeScript 和 Prisma。数据库使用 MySQL 8，对象存储使用 MinIO，实时通信通过 Socket.IO 完成，部署则通过 Docker Compose 和 Nginx 静态托管前端。

架构层面保留了前后端分离、单体后端按领域模块拆分、Prisma 统一数据访问、文档与代码同仓维护以及事件驱动能力预留等约束。

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

- `backend/src/modules`：按领域拆分的后端模块，承载当前业务核心
- `backend/prisma`：数据库模型、初始化、种子数据和补齐脚本
- `frontend/src/pages`：首页、详情、发布、消息、个人中心、校园服务、下单和后台等页面入口
- `frontend/src/services`：前端接口调用、登录态、收藏和行为埋点封装
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

- `db-init` 是一次性初始化任务，放在 `init` profile 下
- 首次启动或需要重置数据时，先执行 `db-init`
- `db-init` 只负责建表与基础初始化，不再自动写入商品、服务、用户演示数据
- 如需显式清库重置，执行 `make init-reset`
- 日常开发重启 `backend` 和 `frontend` 不会重复触发数据库 reset 和 seed
- 默认运行态服务是 `mysql`、`minio`、`meilisearch`、`supertokens-db`、`supertokens`、`vendure`、`backend`、`search-indexer`、`commerce-sync`、`frontend`
- 前端生产镜像使用 `nginx` 托管静态资源
- 默认认证 Core 使用容器内自托管 `http://supertokens:3567`
- SuperTokens 通过独立 PostgreSQL 容器持久化认证数据，容器重启后账号不会丢失
- `backend` 会等待 `supertokens` 健康后再启动，避免认证接口在默认开发环境下不可用
- `make start` 和 `make restart-auth` 会自动清理历史遗留容器 `swapcampus-supertokens-local`，避免占用 `3567` 端口
- 搜索索引消费默认由独立 `search-indexer` 负责，`backend` 默认不直接消费 `search.index` 主题事件
- 商品与订单的电商同步默认由独立 `commerce-sync` 负责，`backend` 默认不直接消费 `commerce.sync` 主题事件

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
docker compose logs search-indexer --tail=50
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
make restart-search-indexer
make restart-commerce-sync
make backfill-search-outbox
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
- 后端内置 worker 开关：`BACKEND_SEARCH_INDEX_OUTBOX_ENABLED`、`BACKEND_SEARCH_INDEXER_INITIALIZE_ON_STARTUP`、`BACKEND_COMMERCE_SYNC_ENABLED`
- 独立 worker 开关：`SEARCH_INDEX_OUTBOX_ENABLED`、`SEARCH_INDEXER_INITIALIZE_ON_STARTUP`、`COMMERCE_SYNC_ENABLED`
- 轮询参数：`SEARCH_INDEX_OUTBOX_POLL_MS`、`SEARCH_INDEX_OUTBOX_BATCH_SIZE`、`SEARCH_INDEX_OUTBOX_PROCESSING_TIMEOUT_MS`、`SEARCH_INDEX_OUTBOX_RETRY_DELAYS_MS`
- 前端构建时：`VITE_API_BASE_URL`、`VITE_API_DOMAIN`、`VITE_SOCKET_URL`、`VITE_WEBSITE_DOMAIN`
- 外部密钥：`SUPERTOKENS_API_KEY`、`VENDURE_ADMIN_TOKEN`、`DEEPSEEK_API_KEY`

注意：

- 修改 `VITE_*` 后需要重建前端镜像
- 仅修改后端变量时，重启相关容器即可
- 更完整的 AI 执行步骤和 ignore 文件分发说明见 [docs/27-AI部署启动与测试指南.md](/home/th1rt3en/dev/forge/SwapCampus/docs/27-AI部署启动与测试指南.md)

### 搜索索引迁移与回填

当 `OutboxEvent` 已建表、但历史商品和卖家还没有补投搜索事件时，可执行：

```bash
make backfill-search-outbox
```

默认命令会在 `search-indexer` 容器内执行已编译的回填脚本，更贴近实际部署环境，也避免宿主机本地 `tsx/Prisma` 执行链路差异带来的不确定性。

该脚本会为现存商品和卖家补写 `search.index` 主题事件，供独立 `search-indexer` 继续消费。补投策略按 `aggregateId + updatedAt` 去重，避免对已经完成过的新状态重复写入。

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
- 校园服务：[campus-services-final.png](/home/th1rt3en/dev/forge/SwapCampus/artifacts/screenshots/campus-services-final.png)
- 详情：[detail-final.png](/home/th1rt3en/dev/forge/SwapCampus/artifacts/screenshots/detail-final.png)
- 发布：[publish-final.png](/home/th1rt3en/dev/forge/SwapCampus/artifacts/screenshots/publish-final.png)
- 消息：[messages-final.png](/home/th1rt3en/dev/forge/SwapCampus/artifacts/screenshots/messages-final.png)
- 个人中心：[profile-final.png](/home/th1rt3en/dev/forge/SwapCampus/artifacts/screenshots/profile-final.png)
- 后台：[admin-final.png](/home/th1rt3en/dev/forge/SwapCampus/artifacts/screenshots/admin-final.png)
