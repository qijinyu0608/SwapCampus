import { ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Space, Tag, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PageContainer,
  ProCard,
  ProDescriptions,
  ProTable,
  StatisticCard,
  type ActionType,
  type ProColumns
} from '@ant-design/pro-components';
import { BJFU_COLLEGES } from '../constants/colleges';
import { CAMPUS_SERVICE_CATEGORY_LABEL } from '../constants/campusServiceCategories';
import { useAuthState } from '../services/auth-state';
import {
  AdminCampusServiceAction,
  AdminCampusServiceItem,
  AdminOrderItem,
  AdminOverview,
  AuditLogItem,
  ModerationUserItem,
  ReportItem,
  fetchAdminCampusServices,
  fetchAdminOrders,
  fetchAdminOverview,
  fetchAuditLogs,
  fetchModerationUsers,
  fetchReports,
  getApiErrorMessage,
  resolveReport,
  updateAdminCampusServiceStatus,
  updateAdminOrderStatus,
  updateAdminProductStatus,
  updateUserBanStatus
} from '../services/api';
import { hasAdminAccess } from '../services/session';

const emptyOverview: AdminOverview = {
  onSaleProducts: 0,
  totalUsers: 0,
  reportCount: 0,
  activeOrders: 0,
  activeCampusServices: 0,
  recentProducts: [],
  recentReports: []
};

const productStatusMap: Record<string, string> = {
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
  OPEN: '可参与',
  BUSY: '名额已满',
  PAUSED: '已暂停',
  ENDED: '已结束',
  MATCHED: '进行中',
  DONE: '已完成',
  CANCELED: '已取消'
};

const userRiskMap: Record<ModerationUserItem['riskLevel'], { label: string; color: string }> = {
  LOW: { label: '低风险', color: 'green' },
  MEDIUM: { label: '观察', color: 'orange' },
  HIGH: { label: '高风险', color: 'red' }
};

type AdminTabKey = 'products' | 'orders' | 'services' | 'reports' | 'logs' | 'users';
type ProductTableRow = AdminOverview['recentProducts'][number];
type ProductFilters = {
  keyword?: string;
  status?: string;
};
type OrderFilters = {
  keyword?: string;
  status?: string;
};
type ServiceFilters = {
  keyword?: string;
  status?: string;
  category?: string;
};
type ReportFilters = {
  keyword?: string;
  status?: string;
  targetType?: string;
};
type LogFilters = {
  keyword?: string;
  action?: string;
};

function getTagColor(value: string) {
  if (value === 'COMPLETED' || value === 'DONE' || value === 'APPROVED' || value === 'ON_SALE') {
    return 'green';
  }

  if (value === 'CANCELED' || value === 'OFFLINE' || value === 'BANNED' || value === 'REJECTED') {
    return 'red';
  }

  return 'orange';
}

function normalizeKeyword(value?: string) {
  const next = value?.trim();
  return next ? next.toLowerCase() : '';
}

function containsValue(values: Array<string | number | null | undefined>, keyword?: string) {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) {
    return true;
  }

  return values.some((item) => String(item ?? '').toLowerCase().includes(normalized));
}

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

export function AdminPage() {
  const { currentUser } = useAuthState();
  const [activeTab, setActiveTab] = useState<AdminTabKey>('products');
  const [overview, setOverview] = useState<AdminOverview>(emptyOverview);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [campusServices, setCampusServices] = useState<AdminCampusServiceItem[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [moderationUsers, setModerationUsers] = useState<ModerationUserItem[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(8);
  const [collegeStats, setCollegeStats] = useState<Array<{ college: string; count: number }>>([]);
  const userActionRef = useRef<ActionType>();
  const resolutionNote = '已核查处理';

  const productStatusValueEnum = useMemo(
    () => ({
      ON_SALE: { text: '在售' },
      OFFLINE: { text: '已下架' },
      SOLD: { text: '已售' }
    }),
    []
  );

  const orderStatusValueEnum = useMemo(
    () => Object.fromEntries(Object.entries(orderStatusMap).map(([key, value]) => [key, { text: value }])),
    []
  );

  const campusServiceStatusValueEnum = useMemo(
    () => Object.fromEntries(Object.entries(campusServiceStatusMap).map(([key, value]) => [key, { text: value }])),
    []
  );

  const campusServiceCategoryValueEnum = useMemo(
    () => Object.fromEntries(
      Object.entries(CAMPUS_SERVICE_CATEGORY_LABEL).map(([key, value]) => [key, { text: value }])
    ),
    []
  );

  const reportStatusValueEnum = useMemo(
    () => ({
      OPEN: { text: '待处理' },
      RESOLVED: { text: '已处理' },
      REJECTED: { text: '已驳回' },
      OFFLINE_PRODUCT: { text: '商品下架' },
      BAN_USER: { text: '用户封禁' },
      UNBAN_USER: { text: '解除封禁' }
    }),
    []
  );

  const collegeValueEnum = useMemo(
    () =>
      Object.fromEntries(
        BJFU_COLLEGES.map((item) => [
          item,
          { text: item }
        ])
      ),
    []
  );

  const openReports = reports.filter((item) => item.status === 'OPEN').length;
  const bannedUsers = moderationUsers.filter((item) => item.isBanned).length;
  const verifiedUsers = moderationUsers.filter((item) => item.verificationStatus === 'APPROVED').length;
  const highRiskUsers = moderationUsers.filter((item) => item.riskLevel === 'HIGH').length;
  const watchedUsers = moderationUsers.filter((item) => item.riskLevel === 'MEDIUM').length;
  async function loadOverview() {
    setOverviewLoading(true);
    setLoadError('');
    try {
      const data = await fetchAdminOverview();
      setOverview(data);
    } catch (error) {
      setOverview(emptyOverview);
      setLoadError(getApiErrorMessage(error, '后台数据加载失败，请检查服务状态。'));
    } finally {
      setOverviewLoading(false);
    }
  }

  async function loadCollections() {
    setCollectionsLoading(true);
    try {
      const [reportList, logList, orderList, campusServiceList] = await Promise.all([
        fetchReports(),
        fetchAuditLogs(),
        fetchAdminOrders(),
        fetchAdminCampusServices()
      ]);
      setReports(reportList);
      setLogs(logList);
      setOrders(orderList);
      setCampusServices(campusServiceList);
    } catch (error) {
      setReports([]);
      setLogs([]);
      setOrders([]);
      setCampusServices([]);
      setLoadError(getApiErrorMessage(error, '后台数据加载失败，请检查服务状态。'));
    } finally {
      setCollectionsLoading(false);
    }
  }

  async function refreshDashboard() {
    await Promise.all([loadOverview(), loadCollections()]);
    await userActionRef.current?.reload();
  }

  useEffect(() => {
    if (!hasAdminAccess(currentUser)) {
      return;
    }

    void refreshDashboard();
  }, [currentUser?.id, currentUser?.role]);

  if (!hasAdminAccess(currentUser)) {
    return (
      <PageContainer title="运营后台">
        <Alert type="info" message="请先使用管理员账号登录" showIcon />
      </PageContainer>
    );
  }

  async function handleModeration(productId: number, status: 'ON_SALE' | 'OFFLINE') {
    if (!currentUser) {
      message.error('请先登录后再处理');
      return;
    }

    try {
      await updateAdminProductStatus(productId, status, { reason: resolutionNote });
      message.success(status === 'ON_SALE' ? '商品已恢复展示' : '商品已下架');
      await refreshDashboard();
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
      await refreshDashboard();
    } catch (error) {
      message.error(getApiErrorMessage(error, '订单状态更新失败，请稍后重试'));
    }
  }

  async function handleCampusServiceStatus(listingId: number, action: AdminCampusServiceAction) {
    if (!currentUser) {
      message.error('请先登录后再处理');
      return;
    }

    try {
      await updateAdminCampusServiceStatus(listingId, {
        action,
        reason: resolutionNote
      });
      message.success('校园服务状态已更新');
      await refreshDashboard();
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
      await refreshDashboard();
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
      await refreshDashboard();
      await userActionRef.current?.reload();
    } catch (error) {
      message.error(getApiErrorMessage(error, '用户状态更新失败，请稍后重试'));
    }
  }

  const recentProductColumns = useMemo<ProColumns<ProductTableRow>[]>(
    () => [
      {
        title: '关键字',
        dataIndex: 'keyword',
        hideInTable: true,
        fieldProps: {
          placeholder: '搜索商品名、ID、卖家'
        }
      },
      {
        title: '状态',
        dataIndex: 'status',
        hideInTable: true,
        valueType: 'select',
        valueEnum: productStatusValueEnum,
        fieldProps: {
          allowClear: true,
          placeholder: '全部状态'
        }
      },
      {
        title: 'ID',
        dataIndex: 'id',
        width: 88,
        search: false
      },
      {
        title: '商品',
        dataIndex: 'title',
        ellipsis: true,
        search: false
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        search: false,
        render: (_, record) => <Tag color={getTagColor(record.status)}>{productStatusMap[record.status] ?? record.status}</Tag>
      },
      {
        title: '卖家',
        dataIndex: 'sellerId',
        width: 120,
        search: false,
        render: (_, record) => `#${record.sellerId}`
      },
      {
        title: '操作',
        valueType: 'option',
        width: 110,
        render: (_, record) => [
          <Button key="offline" size="small" onClick={() => void handleModeration(record.id, 'OFFLINE')}>
            下架
          </Button>
        ]
      }
    ],
    [productStatusValueEnum]
  );

  const reportColumns = useMemo<ProColumns<ReportItem>[]>(
    () => [
      {
        title: '关键字',
        dataIndex: 'keyword',
        hideInTable: true,
        fieldProps: {
          placeholder: '搜索举报原因、商品 ID、用户 ID'
        }
      },
      {
        title: '状态',
        dataIndex: 'status',
        hideInTable: true,
        valueType: 'select',
        valueEnum: reportStatusValueEnum,
        fieldProps: {
          allowClear: true,
          placeholder: '全部状态'
        }
      },
      {
        title: '对象类型',
        dataIndex: 'targetType',
        hideInTable: true,
        valueType: 'select',
        valueEnum: {
          PRODUCT: { text: '商品' },
          USER: { text: '用户' }
        },
        fieldProps: {
          allowClear: true,
          placeholder: '全部对象'
        }
      },
      {
        title: 'ID',
        dataIndex: 'id',
        width: 88,
        search: false
      },
      {
        title: '对象',
        width: 140,
        search: false,
        render: (_, record) => {
          if (record.productId) {
            return `商品 #${record.productId}`;
          }
          if (record.targetUserId) {
            return `用户 #${record.targetUserId}`;
          }
          return '未知';
        }
      },
      {
        title: '原因',
        dataIndex: 'reason',
        ellipsis: true,
        copyable: true,
        search: false
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        search: false,
        render: (_, record) => <Tag color={record.status === 'OPEN' ? 'orange' : 'green'}>{record.status}</Tag>
      },
      {
        title: '时间',
        dataIndex: 'createdAt',
        valueType: 'dateTime',
        width: 170,
        search: false
      },
      {
        title: '操作',
        valueType: 'option',
        width: 260,
        render: (_, record) => {
          if (record.status !== 'OPEN') {
            return [<span key="done" className="meta-line">已完成</span>];
          }

          return [
            record.productId ? (
              <Button key="offline" size="small" type="primary" onClick={() => void handleResolveReport(record.id, 'OFFLINE_PRODUCT')}>
                下架商品
              </Button>
            ) : null,
            record.targetUserId ? (
              <Button key="ban" size="small" danger onClick={() => void handleResolveReport(record.id, 'BAN_USER')}>
                封禁用户
              </Button>
            ) : null,
            <Button key="resolved" size="small" onClick={() => void handleResolveReport(record.id, 'RESOLVED')}>
              已处理
            </Button>,
            <Button key="reject" size="small" onClick={() => void handleResolveReport(record.id, 'REJECTED')}>
              驳回
            </Button>
          ];
        }
      }
    ],
    [reportStatusValueEnum]
  );

  const orderColumns = useMemo<ProColumns<AdminOrderItem>[]>(
    () => [
      {
        title: '关键字',
        dataIndex: 'keyword',
        hideInTable: true,
        fieldProps: {
          placeholder: '搜索商品、买家、卖家、订单号'
        }
      },
      {
        title: '状态',
        dataIndex: 'status',
        hideInTable: true,
        valueType: 'select',
        valueEnum: orderStatusValueEnum,
        fieldProps: {
          allowClear: true,
          placeholder: '全部状态'
        }
      },
      {
        title: 'ID',
        dataIndex: 'id',
        width: 88,
        search: false
      },
      {
        title: '商品',
        dataIndex: 'productTitle',
        ellipsis: true,
        search: false
      },
      {
        title: '买家',
        width: 150,
        search: false,
        render: (_, record) => `${record.buyerName} #${record.buyerId}`
      },
      {
        title: '卖家',
        width: 150,
        search: false,
        render: (_, record) => `${record.sellerName} #${record.sellerId}`
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        search: false,
        render: (_, record) => <Tag color={getTagColor(record.status)}>{orderStatusMap[record.status] ?? record.status}</Tag>
      },
      {
        title: '更新',
        dataIndex: 'updatedAt',
        valueType: 'dateTime',
        width: 170,
        search: false
      },
      {
        title: '操作',
        valueType: 'option',
        width: 260,
        render: (_, record) => {
          if (record.status === 'COMPLETED' || record.status === 'CANCELED') {
            return [<span key="done" className="meta-line">已归档</span>];
          }

          return [
            record.status === 'PENDING' ? (
              <Button key="in-progress" size="small" onClick={() => void handleOrderStatus(record.id, 'IN_PROGRESS')}>
                进行中
              </Button>
            ) : null,
            record.status === 'IN_PROGRESS' ? (
              <Button key="review" size="small" onClick={() => void handleOrderStatus(record.id, 'WAITING_REVIEW')}>
                待评价
              </Button>
            ) : null,
            <Button key="complete" size="small" type="primary" onClick={() => void handleOrderStatus(record.id, 'COMPLETED')}>
              完成
            </Button>,
            <Button key="cancel" size="small" danger onClick={() => void handleOrderStatus(record.id, 'CANCELED')}>
              取消
            </Button>
          ];
        }
      }
    ],
    [orderStatusValueEnum]
  );

  const campusServiceColumns = useMemo<ProColumns<AdminCampusServiceItem>[]>(
    () => [
      {
        title: '关键字',
        dataIndex: 'keyword',
        hideInTable: true,
        fieldProps: {
          placeholder: '搜索任务、发布者、协作人、地点'
        }
      },
      {
        title: '状态',
        dataIndex: 'status',
        hideInTable: true,
        valueType: 'select',
        valueEnum: campusServiceStatusValueEnum,
        fieldProps: {
          allowClear: true,
          placeholder: '全部状态'
        }
      },
      {
        title: '分类',
        dataIndex: 'category',
        hideInTable: true,
        valueType: 'select',
        valueEnum: campusServiceCategoryValueEnum,
        fieldProps: {
          allowClear: true,
          placeholder: '全部分类'
        }
      },
      {
        title: 'ID',
        dataIndex: 'id',
        width: 88,
        search: false
      },
      {
        title: '任务',
        dataIndex: 'title',
        ellipsis: true,
        search: false
      },
      {
        title: '类型',
        dataIndex: 'category',
        width: 150,
        search: false,
        render: (_, record) => CAMPUS_SERVICE_CATEGORY_LABEL[record.category] ?? record.category
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        search: false,
        render: (_, record) => <Tag color={getTagColor(record.status)}>{campusServiceStatusMap[record.status] ?? record.status}</Tag>
      },
      {
        title: '赏金',
        dataIndex: 'reward',
        width: 120,
        search: false,
        render: (_, record) => `¥${record.reward}`
      },
      {
        title: '发布者',
        width: 160,
        search: false,
        render: (_, record) => `${record.publisherName} #${record.publisherId}`
      },
      {
        title: '协作人',
        width: 160,
        search: false,
        render: (_, record) => (record.participantId ? `${record.participantName} #${record.participantId}` : '暂无')
      },
      {
        title: '操作',
        valueType: 'option',
        width: 260,
        render: (_, record) => {
          if (record.status === 'CANCELED' || record.status === 'ENDED' || record.status === 'DONE') {
            return [<span key="done" className="meta-line">已归档</span>];
          }

          return [
            record.status === 'MATCHED' ? (
              <Button key="complete" size="small" type="primary" onClick={() => void handleCampusServiceStatus(record.id, 'FORCE_COMPLETE')}>
                完成
              </Button>
            ) : null,
            record.status === 'OPEN' ? (
              <Button key="match" size="small" onClick={() => void handleCampusServiceStatus(record.id, 'FORCE_MATCH')}>
                设为进行中
              </Button>
            ) : null,
            record.status === 'BUSY' || record.status === 'PAUSED' ? (
              <Button key="reopen" size="small" onClick={() => void handleCampusServiceStatus(record.id, 'REOPEN')}>
                恢复开放
              </Button>
            ) : null,
            <Button key="cancel" size="small" danger onClick={() => void handleCampusServiceStatus(record.id, 'CANCEL')}>
              取消
            </Button>
          ];
        }
      }
    ],
    [campusServiceCategoryValueEnum, campusServiceStatusValueEnum]
  );

  const logColumns = useMemo<ProColumns<AuditLogItem>[]>(
    () => [
      {
        title: '关键字',
        dataIndex: 'keyword',
        hideInTable: true,
        fieldProps: {
          placeholder: '搜索操作人、目标、说明'
        }
      },
      {
        title: '动作',
        dataIndex: 'action',
        hideInTable: true,
        valueType: 'select',
        valueEnum: Object.fromEntries(
          Array.from(new Set(logs.map((item) => item.action))).map((item) => [item, { text: item }])
        ),
        fieldProps: {
          allowClear: true,
          placeholder: '全部动作'
        }
      },
      {
        title: 'ID',
        dataIndex: 'id',
        width: 88,
        search: false
      },
      {
        title: '操作人',
        dataIndex: 'actorName',
        width: 140,
        search: false
      },
      {
        title: '动作',
        dataIndex: 'action',
        width: 140,
        search: false
      },
      {
        title: '目标',
        width: 160,
        search: false,
        render: (_, record) => `${record.targetType} #${record.targetId}`
      },
      {
        title: '说明',
        dataIndex: 'detail',
        ellipsis: true,
        search: false
      },
      {
        title: '时间',
        dataIndex: 'createdAt',
        valueType: 'dateTime',
        width: 170,
        search: false
      }
    ],
    [logs]
  );

  const moderationColumns = useMemo<ProColumns<ModerationUserItem>[]>(
    () => [
      {
        title: '关键字',
        dataIndex: 'keyword',
        hideInTable: true,
        fieldProps: {
          placeholder: '搜索姓名、学号、邮箱'
        }
      },
      {
        title: '学院',
        dataIndex: 'college',
        hideInTable: true,
        valueType: 'select',
        valueEnum: collegeValueEnum,
        fieldProps: {
          allowClear: true,
          showSearch: true,
          placeholder: '全部学院'
        }
      },
      {
        title: '用户',
        dataIndex: 'displayName',
        ellipsis: true,
        copyable: true,
        search: false,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <strong>{record.displayName}</strong>
            <span className="meta-line">{record.studentId || '未填写学号'}</span>
          </Space>
        )
      },
      {
        title: '学院',
        dataIndex: 'college',
        width: 120,
        search: false
      },
      {
        title: '联系',
        width: 220,
        search: false,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <span>{record.email}</span>
            <span className="meta-line">用户 #{record.id}</span>
          </Space>
        )
      },
      {
        title: '风险',
        dataIndex: 'riskLevel',
        width: 110,
        search: false,
        render: (_, record) => {
          const risk = userRiskMap[record.riskLevel] ?? userRiskMap.LOW;
          return <Tag color={risk.color}>{risk.label}</Tag>;
        }
      },
      {
        title: '实名',
        dataIndex: 'verificationStatus',
        width: 100,
        search: false,
        render: (_, record) => (
          <Tag color={record.verificationStatus === 'APPROVED' ? 'blue' : 'default'}>
            {record.verificationStatus === 'APPROVED' ? '已实名' : '待实名'}
          </Tag>
        )
      },
      {
        title: '封禁',
        dataIndex: 'isBanned',
        width: 100,
        search: false,
        render: (_, record) => <Tag color={record.isBanned ? 'red' : 'green'}>{record.isBanned ? '已封禁' : '正常'}</Tag>
      },
      {
        title: '信用分',
        dataIndex: 'creditScore',
        width: 100,
        search: false
      },
      {
        title: '商品',
        width: 130,
        search: false,
        render: (_, record) => `${record.activeProductCount}/${record.totalProductCount}`
      },
      {
        title: '举报',
        width: 130,
        search: false,
        render: (_, record) => `${record.openReportCount}/${record.reportCount}`
      },
      {
        title: '订单',
        width: 130,
        search: false,
        render: (_, record) => `${record.activeOrderCount}/${record.orderCount}`
      },
      {
        title: '操作',
        valueType: 'option',
        width: 120,
        render: (_, record) =>
          record.isBanned ? (
            <Button size="small" onClick={() => void handleUserBan(record, false)}>
              解除封禁
            </Button>
          ) : (
            <Button size="small" danger onClick={() => void handleUserBan(record, true)}>
              封禁
            </Button>
          )
      }
    ],
    [collegeValueEnum]
  );

  const userPageSummary = [
    { label: '封禁账号', value: bannedUsers },
    { label: '实名账号', value: verifiedUsers },
    { label: '高风险', value: highRiskUsers },
    { label: '观察中', value: watchedUsers }
  ];

  const filteredProducts = useMemo(
    () => async (params: ProductFilters) => {
      const data = overview.recentProducts.filter((item) => {
        if (params.status && item.status !== params.status) {
          return false;
        }

        return containsValue([item.id, item.title, item.sellerId], params.keyword);
      });

      return { data, success: true, total: data.length };
    },
    [overview.recentProducts]
  );

  const filteredOrders = useMemo(
    () => async (params: OrderFilters) => {
      const data = orders.filter((item) => {
        if (params.status && item.status !== params.status) {
          return false;
        }

        return containsValue(
          [item.id, item.productTitle, item.buyerName, item.sellerName, item.buyerId, item.sellerId],
          params.keyword
        );
      });

      return { data, success: true, total: data.length };
    },
    [orders]
  );

  const filteredServices = useMemo(
    () => async (params: ServiceFilters) => {
      const data = campusServices.filter((item) => {
        if (params.status && item.status !== params.status) {
          return false;
        }
        if (params.category && item.category !== params.category) {
          return false;
        }

        return containsValue(
          [item.id, item.title, item.publisherName, item.participantName, item.locationFrom, item.locationTo],
          params.keyword
        );
      });

      return { data, success: true, total: data.length };
    },
    [campusServices]
  );

  const filteredReports = useMemo(
    () => async (params: ReportFilters) => {
      const data = reports.filter((item) => {
        if (params.status && item.status !== params.status) {
          return false;
        }
        if (params.targetType === 'PRODUCT' && !item.productId) {
          return false;
        }
        if (params.targetType === 'USER' && !item.targetUserId) {
          return false;
        }

        return containsValue([item.id, item.reason, item.productId, item.targetUserId], params.keyword);
      });

      return { data, success: true, total: data.length };
    },
    [reports]
  );

  const filteredLogs = useMemo(
    () => async (params: LogFilters) => {
      const data = logs.filter((item) => {
        if (params.action && item.action !== params.action) {
          return false;
        }

        return containsValue([item.id, item.actorName, item.action, item.targetType, item.targetId, item.detail], params.keyword);
      });

      return { data, success: true, total: data.length };
    },
    [logs]
  );

  return (
    <PageContainer
      title="运营中心"
      extraContent={(
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void refreshDashboard()}>
            刷新全部
          </Button>
        </Space>
      )}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {loadError ? <Alert type="error" showIcon message="数据加载失败" description={loadError} /> : null}

        <div className="admin-overview-grid">
          <StatisticCard className="admin-overview-card" statistic={{ title: '在售商品', value: overview.onSaleProducts }} />
          <StatisticCard className="admin-overview-card" statistic={{ title: '未结举报', value: openReports }} />
          <StatisticCard className="admin-overview-card" statistic={{ title: '活跃订单', value: overview.activeOrders }} />
          <StatisticCard className="admin-overview-card" statistic={{ title: '服务任务', value: overview.activeCampusServices }} />
          <StatisticCard className="admin-overview-card" statistic={{ title: '封禁账号', value: bannedUsers }} />
          <StatisticCard className="admin-overview-card" statistic={{ title: '实名用户', value: verifiedUsers }} />
        </div>

        <ProCard
          bordered={false}
          className="admin-tabs-card"
          tabs={{
            type: 'line',
            activeKey: activeTab,
            onChange: (key) => setActiveTab(key as AdminTabKey),
            items: [
              {
                key: 'products',
                label: `商品审核 (${overview.recentProducts.length})`,
                children: (
                  <ProTable<ProductTableRow, ProductFilters>
                    rowKey="id"
                    options={false}
                    toolbar={{
                      search: false
                    }}
                    search={{
                      labelWidth: 72,
                      span: 8,
                      filterType: 'light'
                    }}
                    request={filteredProducts}
                    pagination={false}
                    columns={recentProductColumns}
                    scroll={{ x: 720 }}
                  />
                )
              },
              {
                key: 'orders',
                label: `订单治理 (${orders.length})`,
                children: (
                  <ProTable<AdminOrderItem, OrderFilters>
                    rowKey="id"
                    options={false}
                    toolbar={{
                      search: false
                    }}
                    search={{
                      labelWidth: 72,
                      span: 8,
                      filterType: 'light'
                    }}
                    request={filteredOrders}
                    pagination={false}
                    columns={orderColumns}
                    scroll={{ x: 1020 }}
                  />
                )
              },
              {
                key: 'services',
                label: `校园服务 (${campusServices.length})`,
                children: (
                  <ProTable<AdminCampusServiceItem, ServiceFilters>
                    rowKey="id"
                    options={false}
                    toolbar={{
                      search: false
                    }}
                    search={{
                      labelWidth: 72,
                      span: 8,
                      filterType: 'light'
                    }}
                    request={filteredServices}
                    pagination={false}
                    columns={campusServiceColumns}
                    scroll={{ x: 1080 }}
                  />
                )
              },
              {
                key: 'reports',
                label: `举报处理 (${reports.length})`,
                children: (
                  <ProTable<ReportItem, ReportFilters>
                    rowKey="id"
                    options={false}
                    toolbar={{
                      search: false
                    }}
                    search={{
                      labelWidth: 72,
                      span: 8,
                      filterType: 'light'
                    }}
                    request={filteredReports}
                    pagination={false}
                    columns={reportColumns}
                    scroll={{ x: 980 }}
                  />
                )
              },
              {
                key: 'logs',
                label: `最近操作 (${logs.length})`,
                children: (
                  <ProTable<AuditLogItem, LogFilters>
                    rowKey="id"
                    options={false}
                    toolbar={{
                      search: false
                    }}
                    search={{
                      labelWidth: 72,
                      span: 8,
                      filterType: 'light'
                    }}
                    request={filteredLogs}
                    pagination={false}
                    columns={logColumns}
                    scroll={{ x: 820 }}
                  />
                )
              },
              {
                key: 'users',
                label: `用户治理 (${userTotal})`,
                children: (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <div className="admin-overview-grid compact">
                      {userPageSummary.map((item, index) => (
                        <StatisticCard
                          key={item.label}
                          className="admin-overview-card"
                          statistic={{ title: item.label, value: item.value }}
                        />
                      ))}
                    </div>

                    <ProDescriptions
                      className="admin-college-card"
                      column={4}
                      bordered
                      dataSource={collegeStats.reduce<Record<string, number>>((acc, item) => {
                        acc[item.college] = item.count;
                        return acc;
                      }, {
                        全部学院: collegeStats.reduce((sum, item) => sum + item.count, 0)
                      })}
                      columns={[
                        { title: '全部学院', dataIndex: '全部学院', valueType: 'text' },
                        ...BJFU_COLLEGES.slice(0, 3).map((college) => ({
                          title: college,
                          dataIndex: college,
                          valueType: 'text' as const
                        }))
                      ]}
                    />

                    <ProTable<ModerationUserItem>
                      actionRef={userActionRef}
                      rowKey="id"
                      options={false}
                      toolbar={{
                        search: false
                      }}
                      search={{
                        labelWidth: 72,
                        span: 8,
                        filterType: 'light'
                      }}
                      pagination={{
                        pageSize: userPageSize,
                        current: userPage,
                        showSizeChanger: true,
                        pageSizeOptions: ['5', '8', '12', '20'],
                        onChange: (page, pageSize) => {
                          setUserPage(page);
                          setUserPageSize(pageSize);
                        }
                      }}
                      request={async (params) => {
                        const page = typeof params.current === 'number' ? params.current : 1;
                        const pageSize = typeof params.pageSize === 'number' ? params.pageSize : 8;
                        const college = typeof params.college === 'string' && params.college.trim() ? params.college : undefined;
                        const keyword = typeof params.keyword === 'string' && params.keyword.trim() ? params.keyword.trim() : undefined;

                        const response = await fetchModerationUsers({
                          page,
                          pageSize,
                          college,
                          keyword
                        });

                        setModerationUsers(response.items);
                        setUserTotal(response.pagination.total);
                        setUserPage(response.pagination.page);
                        setUserPageSize(response.pagination.pageSize);
                        setCollegeStats(response.collegeStats);

                        return {
                          data: response.items,
                          success: true,
                          total: response.pagination.total
                        };
                      }}
                      columns={moderationColumns}
                      scroll={{ x: 1680 }}
                    />
                  </Space>
                )
              }
            ]
          }}
          loading={overviewLoading || collectionsLoading}
        />
      </Space>
    </PageContainer>
  );
}
