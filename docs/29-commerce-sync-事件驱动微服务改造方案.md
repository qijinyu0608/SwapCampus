# Commerce Sync 事件驱动实现说明

## 1. 文档目的

本文档说明 SwapCampus 当前已经落地的 Vendure 异步同步基础设施，重点描述本地业务系统如何通过事件外发与独立工作进程，把外围电商同步从主请求链路中剥离出来。

本文聚焦三件事：

1. 当前 `commerce-sync` 已经实现了什么
2. 本地数据、Outbox 事件和 Vendure 之间如何协作
3. 当前边界和后续增强项分别是什么

## 2. 当前实现结论

当前项目已经完成一条可运行的 `commerce.sync` 异步同步链路，整体结构如下：

- `backend` 继续承担商品、订单、用户等主业务写库
- 业务事务在提交本地数据时，把电商同步事件写入 `OutboxEvent`
- 商品、订单、用户模型保留本地外部 ID 和同步状态字段
- 独立工作进程 `commerce-sync` 消费 `commerce.sync` 主题事件
- 消费者调用 `VendureService` 完成商品、客户、订单的追平，并把结果回写本地库

当前默认运行态下，`backend` 不直接消费 `commerce.sync` 事件，外围电商同步由独立 `commerce-sync` 容器负责。

## 3. 当前架构定位

当前系统已经明确区分了两层事实：

- 本地 MySQL 是商品、订单、用户状态的主事实源
- Vendure 是外围电商能力系统，承担商品变体、客户、订单等外部同步能力

这一定义非常重要。它意味着前端接口的成功与否，不再要求等待 Vendure 同步完成；只要本地事务成功提交，外围电商状态就可以通过异步消费者继续追平。对课程设计场景来说，这种做法既保留了微服务化的工程意义，也避免了为追求形式上的拆分而把主链路变脆。

## 4. 已落地的基础设施

### 4.1 本地数据模型

当前 Prisma 已经提供了和外部同步相关的完整字段：

- `ExternalSyncStatus`
- `Product.commerceSyncStatus`
- `Product.commerceSyncError`
- `User.commerceSyncStatus`
- `User.commerceSyncError`
- `Order.commerceSyncStatus`
- `Order.commerceSyncError`

同时，本地仍保留以下外部系统关联键：

- `Product.vendureProductId`
- `Product.vendureVariantId`
- `User.vendureCustomerId`
- `Order.vendureOrderId`
- `Order.vendureOrderCode`

这些字段保证了“同步是否完成”和“已同步到 Vendure 的哪个对象”都能在主库中直接查询。

### 4.2 事件外发表

电商同步同样复用了 `OutboxEvent` 基础设施。统一发布入口在 `backend/src/modules/outbox/outbox.service.ts`，当前已经提供：

- `publishProductCommerceSyncEvent()`
- `publishOrderCommerceSyncEvent()`
- `publishUserCommerceSyncEvent()`

其中前两类已经接入主链路，第三类已经完成事件类型与消费者支持，但当前还没有在默认业务路径中大量启用。

### 4.3 独立工作进程

当前仓库已经提供独立的 `commerce-sync` 入口：

- `backend/src/commerce-sync.main.ts`
- `backend/src/commerce-sync.module.ts`

同时已经配置以下脚本：

- `npm run start:commerce-sync`
- `npm run start:commerce-sync:dev`

根目录 `docker-compose.yml` 中也已经默认启用 `commerce-sync` 容器，消费开关由 `COMMERCE_SYNC_ENABLED` 等环境变量控制。

## 5. 当前事件模型与处理逻辑

### 5.1 主题与事件类型

电商同步当前统一使用主题 `commerce.sync`。已经定义的事件类型包括：

- `ProductPublished`
- `OrderCreated`
- `OrderCanceled`
- `OrderCompleted`
- `UserRegisteredForCommerce`

其中前四类已经进入默认主链路，`UserRegisteredForCommerce` 目前属于“消费者已支持、业务可接入”的预留能力。

### 5.2 商品同步

`ProductPublished` 事件由 `CommerceSyncOutboxConsumer` 处理时，会执行以下步骤：

1. 读取本地商品
2. 调用 `VendureService.ensureProductVariant()`
3. 把 `vendureProductId`、`vendureVariantId` 回写到本地商品
4. 将商品同步状态置为 `SYNCED`

因此，商品发布接口不需要等待 Vendure 返回成功，外部商品与变体由后台异步补齐。

### 5.3 订单同步

`OrderCreated` 事件会进入 `ensureVendureOrder()` 逻辑。当前实现会：

1. 读取本地订单、商品、买家
2. 若商品或客户尚未同步，先调用 Vendure 侧 `ensure` 能力
3. 调用 `createPlacedOrder()` 创建 Vendure 订单
4. 在同一事务中回写商品、用户、订单的外部 ID 和同步状态

`OrderCanceled` 与 `OrderCompleted` 事件则复用同一条订单追平链路，在确保本地已有对应 Vendure 订单后，再调用取消或结算动作。

### 5.4 用户同步

消费者当前已经支持 `UserRegisteredForCommerce`，处理逻辑会调用 `ensureCustomer()` 并回写 `vendureCustomerId`。不过就当前主链路而言，用户注册后并不会默认立即发布这类事件，更多是由订单同步过程中按需补齐买家客户信息。

## 6. 当前已接入的业务触发点

### 6.1 商品发布

`products.service.ts` 在商品创建事务内，已经把以下状态一次性写入：

- 本地商品记录
- `commerceSyncStatus = PENDING`
- `ProductPublished` 事件

这保证了商品先落本地，再异步追平 Vendure。

### 6.2 订单创建

`orders.service.ts` 在创建订单事务内，已经完成：

1. 创建本地订单
2. 将订单同步状态置为 `PENDING`
3. 更新商品预留状态
4. 写入 `OrderCreated` 事件
5. 创建或绑定交易会话、写入订单事件消息

外围电商同步已经从订单主请求链路中拆出，不需要再在接口返回前完成远端下单。

### 6.3 订单取消与完成

订单取消、完成时，系统也会同步回写本地同步状态并发出事件：

- 取消订单时发布 `OrderCanceled`
- 确认完成或自动完成时发布 `OrderCompleted`

这样 Vendure 侧的取消和结算都能走统一补偿链路，而不是散落在多个同步调用里。

## 7. 当前状态流转、重试与幂等

### 7.1 状态流转

`CommerceSyncOutboxConsumer` 当前会在处理前后同步更新实体状态：

- 开始处理时标记为 `PROCESSING`
- 处理成功后标记为 `SYNCED`
- 处理中失败但仍可重试时回退为 `PENDING`
- 超过最大重试次数后标记为 `FAILED`

错误信息会写入 `commerceSyncError`，便于后续排查。

### 7.2 失败重试

当前实现已经具备与搜索消费者一致的失败恢复机制：

- 轮询待处理事件
- 抢占事件并设置 `PROCESSING`
- 失败时记录 `lastError`
- 依据递增延迟重新投递
- 超过阈值后置为 `FAILED`
- 对超时停留在 `PROCESSING` 的事件执行回收

因此，Vendure 暂时不可用时，本地交易不会回滚，但事件仍会保留在系统中等待后续补偿。

### 7.3 幂等策略

当前幂等策略建立在“先查本地外部 ID，再决定是否补建”的原则上：

- 商品如果已有 `vendureProductId` 和 `vendureVariantId`，优先复用
- 用户如果已有 `vendureCustomerId`，不重复创建客户
- 订单如果已有 `vendureOrderId`，不会重复创建 Vendure 订单

这种策略与当前 `VendureService.ensureProductVariant()`、`ensureCustomer()` 的实现边界一致，能够满足现阶段的重复消费容忍需求。

## 8. 运行与验证

### 8.1 默认运行方式

当前默认运行态已包含 `commerce-sync`，常用命令为：

```bash
make start
make restart-commerce-sync
docker compose logs commerce-sync --tail=50
```

本地调试时，也可以在 `backend/` 目录中直接执行 `npm run start:commerce-sync:dev`。

### 8.2 当前验证口径

当前至少应验证以下场景：

1. 发布商品后，本地商品可异步获得 `vendureProductId` 与 `vendureVariantId`
2. 创建订单后，本地订单可异步获得 `vendureOrderId` 与 `vendureOrderCode`
3. 取消订单后，Vendure 侧订单状态能够被补偿取消
4. 完成订单后，Vendure 侧订单可执行对应结算动作
5. `commerce-sync` 停止期间，本地下单和商品发布仍可继续，恢复后可处理积压事件

## 9. 当前边界

当前实现已经形成完整的异步同步基础设施，但仍需明确以下边界：

- 本地 MySQL 仍是唯一主事实源，Vendure 采用最终一致
- 当前采用基于 MySQL 的 Outbox 轮询机制，没有引入专门消息中间件
- `commerce-sync` 已经独立为单独进程和容器，但仍与主后端共享同一仓库和数据库
- `UserRegisteredForCommerce` 已支持消费，但默认业务路径尚未把“注册即同步客户”作为强制动作
- 当前同步范围主要覆盖商品、客户、订单，不涉及更复杂的库存、履约、支付编排或对账能力
- 观测手段仍以日志和数据库字段为主，缺少更细粒度的同步看板和人工重放入口

## 10. 后续增强方向

后续如需继续完善，可按以下方向推进：

1. 为后台增加同步失败列表、人工重试和状态筛选能力
2. 明确用户注册后是否需要主动发布 `UserRegisteredForCommerce`
3. 继续补充订单完成后的更细粒度状态回写与对账信息
4. 在确有规模需要时，再评估把 Outbox 轮询升级为独立消息队列

## 11. 结论

从当前仓库现状看，`commerce-sync` 已经不是一份停留在建议层面的拆分草案，而是一条真实可运行的外围电商异步同步链路。它把 Vendure 相关副作用从主请求链路中抽离出来，使本地交易事实与外部系统状态的边界更加清楚，也为后续继续推进事件驱动改造打下了稳定基础。
