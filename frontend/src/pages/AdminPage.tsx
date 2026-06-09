import { Button, Input, Pagination, Tag, message } from 'antd';
import { useEffect, useState } from 'react';
import { AdminEntityActions, AdminEntityItem, MetricBarChart, StatStrip } from '../components/data-display';
import { FoldSection } from '../components/disclosure';
import { NoticePanel } from '../components/feedback';
import { PageCard } from '../components/layout';
import { useAuthState } from '../services/auth-state';
import {
  AdminCampusServiceItem,
  AdminOverview,
  AdminOrderItem,
  AuditLogItem,
  fetchAdminCampusServices,
  fetchAdminOverview,
  fetchAdminOrders,
  fetchAuditLogs,
  fetchModerationUsers,
  fetchReports,
  getApiErrorMessage,
  ModerationUserItem,
  ReportItem,
  resolveReport,
  updateAdminCampusServiceStatus,
  updateAdminOrderStatus,
  updateAdminProductStatus,
  updateUserBanStatus
} from '../services/api';
import { hasAdminAccess } from '../services/session';

const emptyOverview: AdminOverview = {
  pendingProducts: 0,
  totalUsers: 0,
  reportCount: 0,
  activeOrders: 0,
  activeCampusServices: 0,
  recentProducts: [],
  recentReports: []
};

const productStatusMap: Record<string, string> = {
  PENDING: '新上架',
  ON_SALE: '在售',
  OFFLINE: '已下架',
  SOLD: '已售'
};

const orderStatusMap: Record<string, string> = {
  PENDING: '待确认',
  IN_PROGRESS: '交易中',
  WAITING_REVIEW: '待评价',
  COMPLETED: '已完成',
  CANCELED: '已取消'
};

const campusServiceStatusMap: Record<string, string> = {
  OPEN: '待接单',
  MATCHED: '进行中',
  DONE: '已完成',
  CANCELED: '已取消'
};

const campusServiceCategoryMap: Record<string, string> = {
  ERRAND: '跑腿',
  AGENCY: '代办',
  GROUP_BUY: '拼团',
  HELP: '互助'
};

const collegeOptions = [
  '林学院',
  '水土保持学院',
  '生物科学与技术学院',
  '园林学院',
  '经济管理学院',
  '工学院',
  '材料科学与技术学院',
  '人文社会科学学院',
  '外语学院',
  '信息学院',
  '理学院',
  '生态与自然保护学院',
  '环境科学与工程学院',
  '艺术设计学院',
  '马克思主义学院',
  '草业与草原学院',
  '继续教育学院',
  '国际学院'
];

const userRiskMap: Record<ModerationUserItem['riskLevel'], { label: string; color: string }> = {
  LOW: { label: '低风险', color: 'green' },
  MEDIUM: { label: '观察', color: 'orange' },
  HIGH: { label: '高风险', color: 'red' }
};

function formatDateTime(value?: string) {
  if (!value) {
    return '暂无记录';
  }

  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getCollegeCount(stats: Array<{ college: string; count: number }>, college: string) {
  return stats.find((item) => item.college === college)?.count ?? 0;
}

export function AdminPage() {
  const { currentUser } = useAuthState();
  const [overview, setOverview] = useState<AdminOverview>(emptyOverview);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [users, setUsers] = useState<ModerationUserItem[]>([]);
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [campusServices, setCampusServices] = useState<AdminCampusServiceItem[]>([]);
  const [resolutionNote, setResolutionNote] = useState('已核查处理');
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(8);
  const [userTotal, setUserTotal] = useState(0);
  const [activeCollege, setActiveCollege] = useState('全部学院');
  const [userKeyword, setUserKeyword] = useState('');
  const [collegeStats, setCollegeStats] = useState<Array<{ college: string; count: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const openReports = reports.filter((item) => item.status === 'OPEN').length;
  const bannedUsers = users.filter((item) => item.isBanned).length;
  const verifiedUsers = users.filter((item) => item.verificationStatus === 'APPROVED').length;
  const highRiskUsers = users.filter((item) => item.riskLevel === 'HIGH').length;
  const watchedUsers = users.filter((item) => item.riskLevel === 'MEDIUM').length;
  const userActionSummary = `${highRiskUsers} 高风险 / ${watchedUsers} 观察`;
  const dashboardItems = [
    { label: '待处理商品', value: overview.pendingProducts, tone: 'amber' as const },
    { label: '未结举报', value: openReports, tone: 'blue' as const },
    { label: '活跃订单', value: overview.activeOrders, tone: 'green' as const },
    { label: '服务任务', value: overview.activeCampusServices, tone: 'amber' as const },
    { label: '封禁账号', value: bannedUsers, tone: 'blue' as const },
    { label: '实名用户', value: verifiedUsers, tone: 'green' as const }
  ];
  const summaryItems = [
    { key: 'pending-products', value: overview.pendingProducts, label: '待处理商品' },
    { key: 'open-reports', value: openReports, label: '未结举报' },
    { key: 'banned-users', value: bannedUsers, label: '封禁账号' },
    { key: 'active-orders', value: overview.activeOrders, label: '活跃订单' },
    { key: 'active-services', value: overview.activeCampusServices, label: '服务任务' },
    { key: 'total-users', value: overview.totalUsers || users.length, label: '用户总数' }
  ];

  async function loadOverview(next?: {
    page?: number;
    pageSize?: number;
    college?: string;
    keyword?: string;
  }) {
    setLoading(true);
    setLoadError('');
    const nextPage = next?.page ?? userPage;
    const nextPageSize = next?.pageSize ?? userPageSize;
    const nextCollege = next?.college ?? activeCollege;
    const nextKeyword = next?.keyword ?? userKeyword;
    try {
      const [data, reportList, logList, userData, orderList, campusServiceList] = await Promise.all([
        fetchAdminOverview(),
        fetchReports(),
        fetchAuditLogs(),
        fetchModerationUsers({
          page: nextPage,
          pageSize: nextPageSize,
          college: nextCollege === '全部学院' ? undefined : nextCollege,
          keyword: nextKeyword.trim() || undefined
        }),
        fetchAdminOrders(),
        fetchAdminCampusServices()
      ]);
      setOverview(data);
      setReports(reportList);
      setLogs(logList);
      setUsers(userData.items);
      setUserPage(userData.pagination.page);
      setUserPageSize(userData.pagination.pageSize);
      setUserTotal(userData.pagination.total);
      setCollegeStats(userData.collegeStats);
      setOrders(orderList);
      setCampusServices(campusServiceList);
    } catch (error) {
      setOverview(emptyOverview);
      setReports([]);
      setLogs([]);
      setUsers([]);
      setUserTotal(0);
      setOrders([]);
      setCampusServices([]);
      setLoadError(getApiErrorMessage(error, '后台数据加载失败，请检查服务状态。'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasAdminAccess(currentUser)) {
      return;
    }

    void loadOverview();
  }, []);

  if (!hasAdminAccess(currentUser)) {
    return (
      <div className="page-grid">
        <section className="page-topbar">
          <div className="page-topbar-copy">
            <h1>运营后台</h1>
            <span>登录后查看</span>
          </div>
        </section>

        <PageCard>
          <div className="bullet-points">
            <div>请先使用管理员账号登录</div>
          </div>
        </PageCard>
      </div>
    );
  }

  async function handleModeration(productId: number, status: 'ON_SALE' | 'OFFLINE') {
    if (!currentUser) {
      message.error('请先登录后再处理');
      return;
    }

    try {
      await updateAdminProductStatus(productId, status, {
        reason: resolutionNote
      });
      message.success(status === 'ON_SALE' ? '商品已恢复展示' : '商品已下架');
      await loadOverview();
    } catch (error) {
      message.error(getApiErrorMessage(error, '操作失败，请稍后重试。'));
    }
  }

  async function handleOrderStatus(
    orderId: number,
    status: 'PENDING' | 'IN_PROGRESS' | 'WAITING_REVIEW' | 'COMPLETED' | 'CANCELED'
  ) {
    if (!currentUser) {
      message.error('请先登录后再处理');
      return;
    }

    try {
      await updateAdminOrderStatus(orderId, {
        status,
        reason: resolutionNote
      });
      message.success('订单状态已更新');
      await loadOverview();
    } catch (error) {
      message.error(getApiErrorMessage(error, '订单状态更新失败，请稍后重试'));
    }
  }

  async function handleCampusServiceStatus(
    taskId: number,
    status: 'OPEN' | 'MATCHED' | 'DONE' | 'CANCELED'
  ) {
    if (!currentUser) {
      message.error('请先登录后再处理');
      return;
    }

    try {
      await updateAdminCampusServiceStatus(taskId, {
        status,
        reason: resolutionNote
      });
      message.success('校园服务状态已更新');
      await loadOverview();
    } catch (error) {
      message.error(getApiErrorMessage(error, '校园服务状态更新失败，请稍后重试'));
    }
  }

  async function handleResolveReport(
    reportId: number,
    nextStatus: 'RESOLVED' | 'REJECTED' | 'OFFLINE_PRODUCT' | 'BAN_USER' | 'UNBAN_USER'
  ) {
    if (!currentUser) {
      message.error('请先登录后再处理');
      return;
    }

    try {
      await resolveReport(reportId, {
        resolutionNote,
        nextStatus
      });
      message.success('举报已处理');
      await loadOverview();
    } catch (error) {
      message.error(getApiErrorMessage(error, '处理失败，请稍后重试'));
    }
  }

  async function handleUserBan(record: ModerationUserItem, banned: boolean) {
    if (!currentUser) {
      message.error('请先登录后再处理');
      return;
    }

    try {
      await updateUserBanStatus(record.id, {
        banned,
        reason: resolutionNote
      });
      message.success(banned ? '用户已封禁' : '用户已恢复');
      await loadOverview();
    } catch (error) {
      message.error(getApiErrorMessage(error, '用户状态更新失败，请稍后重试'));
    }
  }

  function handleCollegeChange(college: string) {
    setActiveCollege(college);
    void loadOverview({ page: 1, college });
  }

  function handleUserSearch(keyword: string) {
    setUserKeyword(keyword);
    void loadOverview({ page: 1, keyword });
  }

  function handleUserPageChange(page: number, pageSize: number) {
    void loadOverview({ page, pageSize });
  }

  return (
    <div className="page-grid">
      <section className="page-topbar">
        <div className="page-topbar-copy">
          <h1>运营中心</h1>
          <span>治理</span>
        </div>
        <div className="page-topbar-tags">
          <span>{overview.pendingProducts} 个待处理商品</span>
          <span>{overview.reportCount} 条未结举报</span>
          <span>{userActionSummary}</span>
        </div>
      </section>

      {loadError ? (
        <PageCard>
          <NoticePanel title="数据加载失败" description={loadError} tone="danger" className="admin-state-line">
            <Button size="small" onClick={() => void loadOverview()}>重试</Button>
          </NoticePanel>
        </PageCard>
      ) : null}

      {loading ? (
        <PageCard>
          <NoticePanel
            title="正在刷新运营数据"
            description="商品、举报、订单、用户治理队列同步加载中"
            className="admin-state-line"
          />
        </PageCard>
      ) : null}

      <StatStrip items={summaryItems} columns={6} className="admin-summary-strip" />

      <PageCard>
        <div className="dashboard-card compact">
          <div className="dashboard-card-head">
            <strong>运营看板</strong>
            <span>当前处理压力</span>
          </div>
          <MetricBarChart items={dashboardItems} />
        </div>
      </PageCard>

      <PageCard>
        <FoldSection title="商品列表" meta={`${overview.recentProducts.length} 条待审`}>
          <div className="admin-entity-list">
            {overview.recentProducts.map((item) => (
              <AdminEntityItem
                key={item.id}
                title={item.title}
                meta={(
                  <>
                    <span>商品 #{item.id}</span>
                    <span>发布者 #{item.sellerId}</span>
                  </>
                )}
                side={(
                  <>
                    <Tag color="orange">{productStatusMap[item.status] ?? item.status}</Tag>
                    <AdminEntityActions>
                      <Button size="small" type="primary" onClick={() => void handleModeration(item.id, 'ON_SALE')}>
                        恢复
                      </Button>
                      <Button size="small" onClick={() => void handleModeration(item.id, 'OFFLINE')}>
                        下架
                      </Button>
                    </AdminEntityActions>
                  </>
                )}
              />
            ))}
          </div>
        </FoldSection>
      </PageCard>

      <div className="two-col">
        <PageCard>
          <FoldSection title="订单管理" meta={`${orders.length} 条`}>
            <div className="admin-toolbar">
              <Input value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder="处理备注" />
            </div>
            <div className="admin-entity-list">
              {orders.map((item) => (
                <AdminEntityItem
                  key={item.id}
                  title={item.productTitle}
                  variant="report"
                  meta={(
                    <>
                      <span>订单 #{item.id}</span>
                      <span>买家 {item.buyerName} #{item.buyerId}</span>
                      <span>卖家 {item.sellerName} #{item.sellerId}</span>
                      {item.meetupLocation ? <span>{item.meetupLocation}</span> : null}
                    </>
                  )}
                  side={(
                    <>
                      <Tag color={item.status === 'CANCELED' ? 'default' : item.status === 'COMPLETED' ? 'green' : 'orange'}>
                        {orderStatusMap[item.status] ?? item.status}
                      </Tag>
                      {item.status !== 'COMPLETED' && item.status !== 'CANCELED' ? (
                        <AdminEntityActions wrap>
                          {item.status === 'PENDING' ? (
                            <Button size="small" onClick={() => void handleOrderStatus(item.id, 'IN_PROGRESS')}>
                              进行中
                            </Button>
                          ) : null}
                          {item.status === 'IN_PROGRESS' ? (
                            <Button size="small" onClick={() => void handleOrderStatus(item.id, 'WAITING_REVIEW')}>
                              待评价
                            </Button>
                          ) : null}
                          <Button size="small" type="primary" onClick={() => void handleOrderStatus(item.id, 'COMPLETED')}>
                            完成
                          </Button>
                          <Button size="small" danger onClick={() => void handleOrderStatus(item.id, 'CANCELED')}>
                            取消
                          </Button>
                        </AdminEntityActions>
                      ) : (
                        <span className="meta-line">已归档</span>
                      )}
                    </>
                  )}
                />
              ))}
            </div>
          </FoldSection>
        </PageCard>

        <PageCard>
          <FoldSection title="校园服务" meta={`${campusServices.length} 条`}>
            <div className="admin-entity-list">
              {campusServices.map((item) => (
                <AdminEntityItem
                  key={item.id}
                  title={item.title}
                  variant="report"
                  meta={(
                    <>
                      <span>{campusServiceCategoryMap[item.category] ?? item.category}</span>
                      <span>发布 {item.publisherName} #{item.publisherId}</span>
                      {item.accepterId ? <span>接单 {item.accepterName} #{item.accepterId}</span> : null}
                      <span>{item.locationFrom} 到 {item.locationTo}</span>
                    </>
                  )}
                  side={(
                    <>
                      <Tag color={item.status === 'CANCELED' ? 'default' : item.status === 'DONE' ? 'green' : 'orange'}>
                        {campusServiceStatusMap[item.status] ?? item.status}
                      </Tag>
                      {item.status === 'OPEN' || item.status === 'MATCHED' ? (
                        <AdminEntityActions wrap>
                          {item.status === 'MATCHED' ? (
                            <Button size="small" type="primary" onClick={() => void handleCampusServiceStatus(item.id, 'DONE')}>
                              完成
                            </Button>
                          ) : null}
                          <Button size="small" danger onClick={() => void handleCampusServiceStatus(item.id, 'CANCELED')}>
                            取消
                          </Button>
                        </AdminEntityActions>
                      ) : (
                        <span className="meta-line">已归档</span>
                      )}
                    </>
                  )}
                />
              ))}
            </div>
          </FoldSection>
        </PageCard>
      </div>

      <div className="two-col">
        <PageCard>
          <FoldSection title="举报列表" meta={`${reports.length} 条`}>
            <div className="admin-toolbar">
              <Input value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder="处理备注" />
            </div>
            <div className="admin-entity-list">
              {reports.map((item) => (
                <AdminEntityItem
                  key={item.id}
                  variant="report"
                  meta={(
                    <>
                      <span>举报 #{item.id}</span>
                      {item.productId ? <span>{`商品 #${item.productId}`}</span> : null}
                      {item.targetUserId ? <span>{`用户 #${item.targetUserId}`}</span> : null}
                    </>
                  )}
                  side={(
                    <>
                      <Tag color={item.status === 'OPEN' ? 'orange' : 'green'}>{item.status}</Tag>
                      {item.status === 'OPEN' ? (
                        <AdminEntityActions wrap>
                          {item.productId ? (
                            <Button size="small" type="primary" onClick={() => void handleResolveReport(item.id, 'OFFLINE_PRODUCT')}>
                              下架商品
                            </Button>
                          ) : null}
                          {item.targetUserId ? (
                            <Button size="small" type="primary" danger onClick={() => void handleResolveReport(item.id, 'BAN_USER')}>
                              封禁用户
                            </Button>
                          ) : null}
                          <Button size="small" onClick={() => void handleResolveReport(item.id, 'RESOLVED')}>
                            已处理
                          </Button>
                          <Button size="small" onClick={() => void handleResolveReport(item.id, 'REJECTED')}>
                            驳回
                          </Button>
                        </AdminEntityActions>
                      ) : (
                        <span className="meta-line">已完成</span>
                      )}
                    </>
                  )}
                >
                  <div className="admin-report-reason">
                    {item.reason.split('\n').map((line, index) => (
                      <span key={`${item.id}-${index}`}>{line}</span>
                    ))}
                  </div>
                </AdminEntityItem>
              ))}
            </div>
          </FoldSection>
        </PageCard>

        <PageCard>
          <FoldSection title="最近操作" meta={`${logs.length} 条`}>
            <div className="compact-list">
              {logs.map((item) => (
                <div key={item.id} className="compact-item admin-log-item">
                  <strong>{item.actorName} · {item.action}</strong>
                  <div className="meta-line">{item.targetType} #{item.targetId}</div>
                  <div className="meta-line">{item.detail}</div>
                </div>
              ))}
            </div>
          </FoldSection>
        </PageCard>
      </div>

      <PageCard>
        <FoldSection title="用户治理" meta={`${userTotal} 人 · ${userActionSummary}`}>
          <div className="admin-user-governance-head">
            <div>
              <strong>用户数据源</strong>
              <span>主表 User，关联实名学院、商品、举报、订单、服务任务和站内消息统计</span>
            </div>
            <Input.Search
              allowClear
              value={userKeyword}
              placeholder="搜索 qijinyu、学号、邮箱"
              onChange={(event) => setUserKeyword(event.target.value)}
              onSearch={handleUserSearch}
              style={{ maxWidth: 320 }}
            />
          </div>
          <div className="admin-college-filter">
            <button
              type="button"
              className={activeCollege === '全部学院' ? 'active' : ''}
              onClick={() => handleCollegeChange('全部学院')}
            >
              <strong>全部学院</strong>
              <span>{collegeStats.reduce((sum, item) => sum + item.count, 0)}</span>
            </button>
            {collegeOptions.map((item) => (
              <button
                key={item}
                type="button"
                className={activeCollege === item ? 'active' : ''}
                onClick={() => handleCollegeChange(item)}
              >
                <strong>{item}</strong>
                <span>{getCollegeCount(collegeStats, item)}</span>
              </button>
            ))}
          </div>
          {users.length ? (
            <div className="admin-user-queue">
              {users.map((item) => {
                const risk = userRiskMap[item.riskLevel] ?? userRiskMap.LOW;
                return (
                  <div key={item.id} className={`admin-user-card risk-${item.riskLevel.toLowerCase()}`}>
                    <div className="admin-user-head">
                      <div>
                        <strong>{item.displayName}</strong>
                        <span>{item.college} · {item.studentId} · 用户 #{item.id}</span>
                      </div>
                      <div className="admin-user-tags">
                        <Tag color={risk.color}>{risk.label} {item.riskScore}</Tag>
                        <Tag color={item.isBanned ? 'red' : 'green'}>{item.isBanned ? '已封禁' : '正常'}</Tag>
                        <Tag color={item.verificationStatus === 'APPROVED' ? 'blue' : 'default'}>
                          {item.verificationStatus === 'APPROVED' ? '已实名' : '待实名'}
                        </Tag>
                      </div>
                    </div>
                    <NoticePanel
                      title={item.suggestedAction}
                      description={`最近活跃 ${formatDateTime(item.lastActiveAt)} · 注册 ${formatDateTime(item.createdAt)}`}
                      className="admin-user-alert"
                    />
                    <div className="admin-user-metrics">
                      <div>
                        <strong>{item.creditScore}</strong>
                        <span>信用分</span>
                      </div>
                      <div>
                        <strong>{item.activeProductCount}/{item.totalProductCount}</strong>
                        <span>在售/总商品</span>
                      </div>
                      <div>
                        <strong>{item.openReportCount}/{item.reportCount}</strong>
                        <span>未结/累计举报</span>
                      </div>
                      <div>
                        <strong>{item.activeOrderCount}/{item.orderCount}</strong>
                        <span>活跃/总订单</span>
                      </div>
                      <div>
                        <strong>{item.activeCampusServiceCount}/{item.campusServiceCount}</strong>
                        <span>服务任务</span>
                      </div>
                      <div>
                        <strong>{item.messageCount}</strong>
                        <span>站内消息</span>
                      </div>
                    </div>
                    <div className="admin-user-foot">
                      <span className="meta-line">
                        {item.email} · 待审商品 {item.pendingProductCount} · 下架记录 {item.offlineProductCount} · 取消订单 {item.canceledOrderCount}
                      </span>
                      {item.isBanned ? (
                        <Button size="small" onClick={() => void handleUserBan(item, false)}>
                          解除封禁
                        </Button>
                      ) : (
                        <Button size="small" danger onClick={() => void handleUserBan(item, true)}>
                          封禁用户
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="admin-empty-state">
              <strong>暂无用户治理数据</strong>
              <span>{loadError || '当前筛选条件下没有用户。可以切换学院或搜索 qijinyu。'}</span>
            </div>
          )}
          <div className="admin-user-pagination">
            <span>
              第 {userPage} 页，每页 {userPageSize} 人，共 {userTotal} 人
            </span>
            <Pagination
              current={userPage}
              pageSize={userPageSize}
              total={userTotal}
              showSizeChanger
              pageSizeOptions={['5', '8', '12', '20']}
              onChange={handleUserPageChange}
            />
          </div>
        </FoldSection>
      </PageCard>
    </div>
  );
}
