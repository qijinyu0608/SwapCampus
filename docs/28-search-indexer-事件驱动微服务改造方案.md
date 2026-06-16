# Search Indexer 事件驱动实现说明

## 1. 文档目的

本文档说明 SwapCampus 当前已经落地的搜索索引事件外发与独立消费实现，重点回答三个问题：

1. 搜索索引为什么适合采用事件驱动方式收敛
2. 当前仓库中哪些能力已经完成落地
3. 现阶段的边界、运维方式和后续增强方向是什么

本文基于当前源码、数据库模型和默认运行方式编写，不把尚未接入主链路的设想写成既成事实。

## 2. 当前实现结论

当前项目已经完成一套可运行的搜索事件外发链路，核心形态如下：

- `backend` 仍是唯一对前端提供业务接口的主服务
- 业务事务在提交本地数据时，同步写入 `OutboxEvent`
- 搜索相关事件统一使用主题 `search.index`
- 独立工作进程 `search-indexer` 轮询并消费待处理事件
- 消费者根据事件类型调用 `SearchService`，把商品或卖家相关搜索数据收敛到 Meilisearch

这意味着系统已经从“业务写库后顺带直接改搜索索引”，演进为“业务写库后发布事件，搜索索引异步追平”。默认 Docker 运行态中，`backend` 不直接消费 `search.index` 事件，独立 `search-indexer` 才是默认消费者。

## 3. 为什么优先把搜索索引做成事件驱动

搜索索引本身不是交易主事实。商品状态、用户状态、订单状态仍以 MySQL 为准，Meilisearch 承担的是检索加速和筛选体验，而不是业务裁定职责。因此，搜索结果允许存在短暂延迟，只要最终能与主库状态一致即可。

另一方面，搜索可见性会被多个业务模块同时影响。商品发布、下单预留、订单取消、订单完成、后台上下架、举报处理、用户封禁与实名状态变化，都会引起商品是否可搜、卖家信息是否需要重建。如果继续把这些动作散落在各个业务模块里做同步调用，主链路会被搜索依赖牵连，重复代码也难以治理。把这类副作用统一收口到事件外发层，是当前代码结构下最稳妥、收益也最直接的做法。

## 4. 已落地的基础设施

### 4.1 数据模型

当前 Prisma 模型已经包含搜索事件消费所需的基础结构：

- `OutboxEvent`
- `OutboxEventStatus`
- `OutboxAggregateType`

`OutboxEvent` 记录了 `topic`、`eventType`、`aggregateType`、`aggregateId`、`payload`、`status`、`availableAt`、`retryCount`、`lastError`、`processingStartedAt`、`processedAt` 等字段，足以支撑事件声明、轮询消费、失败重试和结果留痕。

### 4.2 统一发布入口

当前统一发布入口已经收口在 `backend/src/modules/outbox/outbox.service.ts`。搜索相关事件由以下方法写入：

- `publishProductSearchEvent()`
- `publishSellerSearchEvent()`

这些方法支持在 Prisma 事务客户端中使用，因此业务数据变更与事件写入可以处于同一个数据库事务内，避免“主数据已提交但事件丢失”的问题。

### 4.3 独立工作进程

当前仓库已经提供了独立的搜索消费入口：

- `backend/src/search-indexer.main.ts`
- `backend/src/search-indexer.module.ts`

同时已经配好运行脚本：

- `npm run start:search-indexer`
- `npm run start:search-indexer:dev`

在 Docker 侧，根目录 `docker-compose.yml` 已默认启动 `search-indexer` 容器，并通过 `SEARCH_INDEX_OUTBOX_ENABLED`、`SEARCH_INDEXER_INITIALIZE_ON_STARTUP` 等环境变量控制消费和索引初始化行为。

## 5. 当前事件模型

### 5.1 主题与事件类型

搜索事件当前统一使用主题 `search.index`。已经定义并接入消费者的事件类型包括：

- `ProductCreated`
- `ProductUpdated`
- `ProductStatusChanged`
- `ProductDeleted`
- `SellerStatusChanged`
- `SellerProfileChanged`

### 5.2 事件载荷

当前实现采用轻量载荷策略，事件只携带最小定位信息和来源说明，而不重复存整份商品快照。典型载荷包括：

```json
{
  "productId": 18,
  "changedBy": "orders",
  "reason": "ORDER_RESERVED"
}
```

```json
{
  "sellerId": 24,
  "changedBy": "users",
  "reason": "USER_PROFILE_UPDATED"
}
```

这种做法的好处是事件结构稳定、兼容成本低，消费者始终可以回到主库读取最新事实，避免旧快照覆盖新状态。

## 6. 当前已接入的业务触发点

### 6.1 商品模块

商品发布成功后，`products.service.ts` 会在事务内同时完成三件事：

1. 创建本地商品记录
2. 写入 `ProductPublished` 的电商同步事件
3. 写入 `ProductCreated` 的搜索同步事件

其中搜索侧事件用于把新商品纳入检索范围。

### 6.2 订单模块

订单模块已经把影响搜索可见性的关键状态接入事件外发：

- 创建订单后，商品被标记为预留下架，并发布 `ProductStatusChanged`
- 取消订单、恢复商品上架后，再次发布 `ProductStatusChanged`
- 完成订单、商品转为已售后，同样发布 `ProductStatusChanged`

这部分事件已经不再依赖在请求链路里直接调用搜索服务。

### 6.3 用户模块

用户模块当前已经接入两类搜索相关变更：

- 用户资料编辑、实名认证结果变更，发布 `SellerProfileChanged`
- 用户封禁、解封，发布 `SellerStatusChanged`

其中封禁卖家时，系统还会为受影响商品补发商品状态事件，保证搜索结果与卖家状态一起收敛。

### 6.4 举报与后台治理

举报处理、后台人工治理和申诉裁定也已经接入搜索事件外发，包括：

- 商品下架
- 后台取消订单并恢复商品状态
- 举报封禁用户
- 举报解除封禁
- 订单申诉中的封禁、解封、取消订单处理

这说明当前搜索事件并不是只覆盖“理想主链路”，而是已经进入治理与异常处理场景。

## 7. `search-indexer` 的当前处理流程

### 7.1 轮询与抢占

`SearchIndexOutboxConsumer` 当前采用 MySQL Outbox Pattern 的常见做法：

1. 轮询 `topic = search.index` 且 `status = PENDING` 的事件
2. 只领取 `availableAt <= now` 的记录
3. 通过状态更新把事件从 `PENDING` 抢占为 `PROCESSING`
4. 按 `availableAt` 和 `id` 顺序分批消费

### 7.2 事件处理映射

当前消费者的事件映射关系已经落地为：

- `ProductCreated` / `ProductUpdated` / `ProductStatusChanged`：调用 `syncProduct()`
- `ProductDeleted`：调用 `deleteProduct()`
- `SellerStatusChanged` / `SellerProfileChanged`：调用 `syncSellerProducts()`

这里沿用了现有 `SearchService` 的封装边界，没有额外引入新的搜索写入通道。

### 7.3 失败恢复与重试

当前实现已经具备以下失败处理能力：

- 处理成功后写回 `PROCESSED`
- 处理失败时记录 `lastError`
- 按配置递增 `retryCount`
- 使用 `availableAt` 实现延迟重试
- 超过最大重试次数后标记为 `FAILED`
- 对超时停留在 `PROCESSING` 的事件执行回收

默认重试间隔已在 `outbox.types.ts` 中定义为递增数组，可通过环境变量覆盖。

### 7.4 幂等策略

当前幂等策略并不依赖复杂去重表，而是依赖“读取主库最新事实，再覆盖写搜索索引”这一原则。即使同一事件被重复消费，只要主库状态没有继续变化，Meilisearch 最终仍会被收敛到正确状态。

## 8. 回填、运行与验证

### 8.1 历史数据回填

仓库已经提供 `backend/prisma/backfill-search-outbox.ts` 用于历史补投，命令如下：

```bash
make backfill-search-outbox
```

该脚本会为已有商品和卖家补写 `search.index` 主题事件，并按 `aggregateId + updatedAt` 的思路规避重复补投，适合在引入 Outbox 后为存量数据补齐索引同步入口。

### 8.2 默认运行方式

当前默认运行态包含 `search-indexer`，常用命令为：

```bash
make start
make restart-search-indexer
docker compose logs search-indexer --tail=50
```

如果只是本地调试，也可以在 `backend/` 目录下直接运行 `npm run start:search-indexer:dev`。

### 8.3 当前验证口径

当前至少应验证以下场景：

1. 发布商品后，搜索可检索到新商品
2. 下单预留后，商品从搜索结果中消失
3. 卖家封禁后，该卖家商品搜索结果被同步收敛
4. `search-indexer` 停止期间主业务仍可继续写库，恢复后可继续消费积压事件

## 9. 当前边界

当前实现已经具备完整的事件外发、独立消费和失败重试能力，但仍保留以下边界：

- 当前采用的是基于 MySQL 的轮询式 Outbox，而不是 Kafka、RabbitMQ 这类独立消息中间件
- `search-indexer` 已作为独立进程和容器运行，但仍与 `backend` 共用同一仓库和主数据库
- 搜索事件的观测仍以日志和数据库状态为主，缺少独立看板、指标报警和人工重放界面
- 当前覆盖的是商品与卖家搜索索引，校园服务等其他检索域尚未接入同一套事件链路

## 10. 后续增强方向

后续如果继续完善，可按以下顺序推进：

1. 增加事件积压、失败数、消费延迟等监控指标
2. 提供后台重放或人工补偿工具，减少手工改库排障
3. 为校园服务等新检索域补充独立主题或独立索引消费者
4. 在确有吞吐和解耦需要时，再评估切换到专门的消息队列

## 11. 结论

从当前仓库现状看，`search-indexer` 已经不是停留在建议层面的“拆分设想”，而是一条真实可运行的事件驱动实现。它把搜索副作用从主业务请求链路中剥离出来，在不改前端接口的前提下，完成了“单体主服务 + 独立异步消费者”的一次有效落地。
