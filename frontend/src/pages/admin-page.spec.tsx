import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdminPage } from './AdminPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
  useAuthState: vi.fn(),
  hasAdminAccess: vi.fn(),
  fetchAdminOverview: vi.fn(),
  fetchReports: vi.fn(),
  fetchAuditLogs: vi.fn(),
  fetchAdminOrders: vi.fn(),
  fetchAdminOrderAppeals: vi.fn(),
  fetchAdminCampusServices: vi.fn(),
  fetchModerationUsers: vi.fn(),
  fetchAdminProductPreview: vi.fn(),
  fetchAdminCampusServicePreview: vi.fn(),
  updateAdminProductStatus: vi.fn(),
  updateAdminOrderStatus: vi.fn(),
  updateAdminCampusServiceStatus: vi.fn(),
  resolveReport: vi.fn(),
  resolveAdminOrderAppeal: vi.fn(),
  updateUserBanStatus: vi.fn(),
  updateUserVerificationStatus: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback)
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');

  function MockTabs({ activeKey, onChange, items = [] }: any) {
    const currentKey = activeKey ?? items[0]?.key;
    const current = items.find((item: any) => item.key === currentKey) ?? items[0];

    return (
      <div>
        <div>
          {items.map((item: any) => (
            <button key={item.key} type="button" onClick={() => onChange?.(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
        <div key={currentKey}>{current?.children ?? null}</div>
      </div>
    );
  }

  function MockModal({ open, title, children, onCancel }: any) {
    if (!open) {
      return null;
    }

    return (
      <div>
        <div>{title}</div>
        <button type="button" onClick={onCancel}>关闭弹窗</button>
        {children}
      </div>
    );
  }

  const MockImage = ({ src, alt, width, height }: any) => (
    <img src={src} alt={alt} width={width} height={height} />
  );

  MockImage.PreviewGroup = ({ children }: any) => <div>{children}</div>;

  return {
    ...actual,
    Tabs: MockTabs,
    Modal: MockModal,
    Image: MockImage,
    message: {
      success: mocks.messageSuccess,
      error: mocks.messageError
    }
  };
});

vi.mock('@ant-design/pro-components', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const { useEffect, useRef, useState } = React;

  function MockPageContainer({ title, extraContent, children }: any) {
    return (
      <div>
        <h1>{title}</h1>
        {extraContent}
        {children}
      </div>
    );
  }

  function MockProCard({ tabs, children }: any) {
    if (!tabs) {
      return <div>{children}</div>;
    }

    const currentKey = tabs.activeKey ?? tabs.items?.[0]?.key;
    const current = tabs.items?.find((item: any) => item.key === currentKey) ?? tabs.items?.[0];

    return (
      <div>
        <div>
          {tabs.items?.map((item: any) => (
            <button key={item.key} type="button" onClick={() => tabs.onChange?.(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
        <div key={currentKey}>{current?.children ?? null}</div>
      </div>
    );
  }

  function MockProDescriptions({ dataSource = {}, columns = [] }: any) {
    return (
      <div>
        {columns.map((column: any) => (
          <div key={String(column.dataIndex)}>
            <span>{column.title}</span>
            <span>{String(dataSource[column.dataIndex] ?? '')}</span>
          </div>
        ))}
      </div>
    );
  }

  function MockStatisticCard({ statistic }: any) {
    return (
      <div>
        <span>{statistic?.title}</span>
        <strong>{String(statistic?.value ?? '')}</strong>
      </div>
    );
  }

  function MockProTable({ request, columns = [], rowKey = 'id', actionRef, pagination }: any) {
    const [rows, setRows] = useState<any[]>([]);
    const requestRef = useRef(request);
    const current = typeof pagination?.current === 'number' ? pagination.current : 1;
    const pageSize = typeof pagination?.pageSize === 'number' ? pagination.pageSize : 8;

    requestRef.current = request;

    async function load(params = { current, pageSize }) {
      if (!requestRef.current) {
        return;
      }

      const response = await requestRef.current(params, {}, {});
      setRows(Array.isArray(response?.data) ? response.data : []);
      return response;
    }

    useEffect(() => {
      void load();
    }, [current, pageSize]);

    useEffect(() => {
      if (actionRef) {
        actionRef.current = {
          reload: () => load()
        };
      }
    }, [actionRef, current, pageSize]);

    const visibleColumns = columns.filter((column: any) => !column.hideInTable);

    return (
      <div>
        {rows.map((row) => {
          const id = typeof rowKey === 'function' ? rowKey(row) : row[rowKey];
          return (
            <div key={id} data-testid={`row-${id}`}>
              {visibleColumns.map((column: any, index: number) => {
                const key = String(column.dataIndex ?? column.title ?? index);
                const cellValue = column.dataIndex ? row[column.dataIndex] : undefined;
                const content = column.render ? column.render(cellValue, row, index) : cellValue;
                return (
                  <div key={key}>
                    {typeof column.title === 'string' ? <span>{column.title}</span> : null}
                    {content}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  return {
    PageContainer: MockPageContainer,
    ProCard: MockProCard,
    ProDescriptions: MockProDescriptions,
    ProTable: MockProTable,
    StatisticCard: MockStatisticCard
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate
  };
});

vi.mock('../services/auth-state', () => ({
  useAuthState: () => mocks.useAuthState()
}));

vi.mock('../services/session', async () => {
  const actual = await vi.importActual<typeof import('../services/session')>('../services/session');
  return {
    ...actual,
    hasAdminAccess: (user: any) => mocks.hasAdminAccess(user)
  };
});

vi.mock('../services/api', () => ({
  fetchAdminOverview: () => mocks.fetchAdminOverview(),
  fetchReports: () => mocks.fetchReports(),
  fetchAuditLogs: () => mocks.fetchAuditLogs(),
  fetchAdminOrders: () => mocks.fetchAdminOrders(),
  fetchAdminOrderAppeals: () => mocks.fetchAdminOrderAppeals(),
  fetchAdminCampusServices: () => mocks.fetchAdminCampusServices(),
  fetchModerationUsers: (params?: unknown) => mocks.fetchModerationUsers(params),
  fetchAdminProductPreview: (id: number) => mocks.fetchAdminProductPreview(id),
  fetchAdminCampusServicePreview: (id: number) => mocks.fetchAdminCampusServicePreview(id),
  updateAdminProductStatus: (...args: any[]) => mocks.updateAdminProductStatus(...args),
  updateAdminOrderStatus: (...args: any[]) => mocks.updateAdminOrderStatus(...args),
  updateAdminCampusServiceStatus: (...args: any[]) => mocks.updateAdminCampusServiceStatus(...args),
  resolveReport: (...args: any[]) => mocks.resolveReport(...args),
  resolveAdminOrderAppeal: (...args: any[]) => mocks.resolveAdminOrderAppeal(...args),
  updateUserBanStatus: (...args: any[]) => mocks.updateUserBanStatus(...args),
  updateUserVerificationStatus: (...args: any[]) => mocks.updateUserVerificationStatus(...args),
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback)
}));

const overview = {
  onSaleProducts: 5,
  totalUsers: 42,
  reportCount: 2,
  appealCount: 1,
  activeOrders: 1,
  activeCampusServices: 3,
  recentProducts: [
    {
      id: 901,
      title: '二手台灯',
      status: 'ON_SALE',
      sellerId: 95
    }
  ],
  recentReports: [
    {
      id: 301,
      productId: 901,
      targetUserId: null,
      reason: '疑似异常价格',
      status: 'OPEN'
    }
  ]
};

const reports = [
  {
    id: 301,
    reporterId: 3,
    productId: 901,
    campusServiceListingId: null,
    targetUserId: null,
    reason: '疑似异常价格',
    status: 'OPEN',
    resolutionNote: null,
    handledBy: null,
    createdAt: '2026-06-16T10:00:00.000Z',
    updatedAt: '2026-06-16T10:00:00.000Z'
  }
];

const logs = [
  {
    id: 401,
    actorName: 'ADMIN',
    action: 'BAN_USER',
    targetType: 'USER',
    targetId: 1002,
    detail: '封禁高风险用户',
    createdAt: '2026-06-16T10:30:00.000Z'
  }
];

const orders = [
  {
    id: 501,
    productId: 901,
    productTitle: '二手台灯',
    productStatus: 'ON_SALE',
    buyerId: 95,
    buyerName: '林同学',
    sellerId: 96,
    sellerName: '信同学',
    status: 'IN_PROGRESS',
    meetupLocation: '图书馆',
    note: '今晚面交',
    createdAt: '2026-06-16T11:00:00.000Z',
    updatedAt: '2026-06-16T11:10:00.000Z'
  }
];

const appeals = [
  {
    id: 601,
    orderId: 501,
    appellantId: 95,
    appellantName: '林同学',
    respondentId: 96,
    respondentName: '信同学',
    issueType: 'NOT_AS_DESCRIBED',
    expectedAction: '退款',
    reason: '描述不符',
    status: 'OPEN',
    createdAt: '2026-06-16T12:00:00.000Z',
    updatedAt: '2026-06-16T12:00:00.000Z'
  }
];

const campusServices = [
  {
    id: 701,
    title: '人文学院展板送签',
    category: 'AGENCY',
    intent: 'REQUEST',
    intentLabel: '需求',
    reward: 9,
    publisherId: 132,
    publisherName: '文同学',
    participantId: null,
    participantName: null,
    status: 'OPEN',
    locationFrom: '社团办公室',
    locationTo: '学院窗口',
    deadlineLabel: '今天 17:00',
    createdAt: '2026-06-16T13:00:00.000Z',
    updatedAt: '2026-06-16T13:00:00.000Z'
  },
  {
    id: 702,
    title: '人文学院签到引导',
    category: 'EVENT',
    intent: 'OFFER',
    intentLabel: '服务',
    reward: 0,
    publisherId: 132,
    publisherName: '文同学',
    participantId: 95,
    participantName: '林同学',
    status: 'MATCHED',
    locationFrom: '报告厅',
    locationTo: '签到台',
    deadlineLabel: '明天 09:00',
    createdAt: '2026-06-16T13:20:00.000Z',
    updatedAt: '2026-06-16T13:20:00.000Z'
  }
];

const moderationUsers = [
  {
    id: 1001,
    displayName: '待审同学',
    email: 'pending@swapcampus.local',
    studentId: '20269991',
    avatarUrl: null,
    creditScore: 50,
    verificationStatus: 'PENDING',
    accountStatus: 'ACTIVE',
    isBanned: false,
    realName: '待审同学',
    college: '信息学院',
    graduationYear: 2028,
    phone: '13800000000',
    studentCardPhotoUrl: '/student-card.png',
    reportCount: 0,
    openReportCount: 0,
    activeProductCount: 1,
    totalProductCount: 1,
    offlineProductCount: 0,
    orderCount: 0,
    activeOrderCount: 0,
    completedOrderCount: 0,
    canceledOrderCount: 0,
    campusServiceCount: 1,
    activeCampusServiceCount: 1,
    messageCount: 0,
    lastActiveAt: '2026-06-16T09:00:00.000Z',
    createdAt: '2026-06-16T08:00:00.000Z',
    riskScore: 12,
    riskLevel: 'LOW',
    suggestedAction: '通过审核'
  },
  {
    id: 1002,
    displayName: '风险用户',
    email: 'risk@swapcampus.local',
    studentId: '20269992',
    avatarUrl: null,
    creditScore: 36,
    verificationStatus: 'APPROVED',
    accountStatus: 'ACTIVE',
    isBanned: false,
    realName: '风险用户',
    college: '外语学院',
    graduationYear: 2027,
    phone: '13900000000',
    studentCardPhotoUrl: null,
    reportCount: 3,
    openReportCount: 2,
    activeProductCount: 2,
    totalProductCount: 4,
    offlineProductCount: 2,
    orderCount: 5,
    activeOrderCount: 1,
    completedOrderCount: 2,
    canceledOrderCount: 2,
    campusServiceCount: 2,
    activeCampusServiceCount: 1,
    messageCount: 14,
    lastActiveAt: '2026-06-16T09:30:00.000Z',
    createdAt: '2026-06-10T08:00:00.000Z',
    riskScore: 92,
    riskLevel: 'HIGH',
    suggestedAction: '建议封禁'
  }
];

describe('AdminPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAuthState.mockReturnValue({
      currentUser: {
        id: 1,
        displayName: 'ADMIN',
        role: 'ADMIN'
      }
    });
    mocks.hasAdminAccess.mockImplementation((user: any) => user?.role === 'ADMIN');
    mocks.fetchAdminOverview.mockResolvedValue(overview);
    mocks.fetchReports.mockResolvedValue(reports);
    mocks.fetchAuditLogs.mockResolvedValue(logs);
    mocks.fetchAdminOrders.mockResolvedValue(orders);
    mocks.fetchAdminOrderAppeals.mockResolvedValue(appeals);
    mocks.fetchAdminCampusServices.mockResolvedValue(campusServices);
    mocks.fetchAdminProductPreview.mockResolvedValue({
      title: '二手台灯',
      category: '宿舍生活',
      description: '亮度稳定',
      images: ['/product-preview.png'],
      detailBase: {
        statusLabel: '在售',
        amountLabel: '¥36'
      },
      seller: {
        displayName: '林同学',
        creditScore: 92
      }
    });
    mocks.fetchAdminCampusServicePreview.mockResolvedValue({
      title: '人文学院展板送签',
      category: '代办服务',
      description: '社团活动展板和登记表需要顺路送到学院办事窗口。',
      images: ['/service-preview.png'],
      statusLabel: '可参与',
      intentLabel: '需求',
      rewardLabel: '¥9',
      publisher: {
        displayName: '文同学'
      }
    });
    mocks.fetchModerationUsers.mockImplementation(async (params: any = {}) => {
      const page = params.page ?? params.current ?? 1;
      const pageSize = params.pageSize ?? 8;
      return {
        items: moderationUsers,
        pagination: {
          page,
          pageSize,
          total: moderationUsers.length,
          totalPages: 1
        },
        collegeStats: [
          { college: '信息学院', count: 1 },
          { college: '外语学院', count: 1 }
        ]
      };
    });
    mocks.updateUserVerificationStatus.mockResolvedValue({});
    mocks.resolveReport.mockResolvedValue({});
    mocks.resolveAdminOrderAppeal.mockResolvedValue({});
    mocks.updateAdminCampusServiceStatus.mockResolvedValue({});
    mocks.updateUserBanStatus.mockResolvedValue({});
  });

  it('shows a login hint for non-admin users', () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: {
        id: 95,
        displayName: '林同学',
        role: 'USER'
      }
    });
    mocks.hasAdminAccess.mockReturnValue(false);

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    expect(screen.getByText('请先使用管理员账号登录')).toBeInTheDocument();
  });

  it('loads the dashboard, opens registration preview and approves a pending user', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: '运营中心' })).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.fetchAdminOverview).toHaveBeenCalledTimes(1);
      expect(mocks.fetchReports).toHaveBeenCalledTimes(1);
      expect(mocks.fetchModerationUsers).toHaveBeenCalled();
    });

    const row = await screen.findByTestId('row-1001');
    await user.click(within(row).getByRole('button', { name: '查看资料' }));

    expect(await screen.findByText('注册资料')).toBeInTheDocument();
    expect(screen.getAllByText('pending@swapcampus.local').length).toBeGreaterThan(0);

    await user.click(within(row).getByRole('button', { name: /通\s*过/ }));

    await waitFor(() => {
      expect(mocks.updateUserVerificationStatus).toHaveBeenCalledWith(1001, {
        status: 'APPROVED',
        reason: '已核查处理'
      });
      expect(mocks.messageSuccess).toHaveBeenCalledWith('审核已通过，信用分已设为 50');
    });
  });

  it('resolves reports and appeals through the admin actions', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: '运营中心' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '举报处理' }));
    const reportRow = await screen.findByTestId('row-301');
    await user.click(within(reportRow).getByRole('button', { name: '下架商品' }));

    await waitFor(() => {
      expect(mocks.resolveReport).toHaveBeenCalledWith(301, {
        resolutionNote: '已核查处理',
        penaltyLevel: 'NORMAL',
        nextStatus: 'OFFLINE_PRODUCT'
      });
      expect(mocks.messageSuccess).toHaveBeenCalledWith('举报已处理');
    });

    await user.click(screen.getByRole('button', { name: '申诉处理' }));
    const appealRow = await screen.findByTestId('row-601');
    await user.click(within(appealRow).getByRole('button', { name: '取消订单' }));

    await waitFor(() => {
      expect(mocks.resolveAdminOrderAppeal).toHaveBeenCalledWith(601, {
        nextStatus: 'CANCELED_ORDER',
        penaltyLevel: 'NORMAL',
        resolutionNote: '已核查处理'
      });
      expect(mocks.messageSuccess).toHaveBeenCalledWith('申诉已处理');
    });
  });

  it('refreshes report rows immediately after a governance action', async () => {
    const user = userEvent.setup();
    const mutableReports = [
      {
        ...reports[0]
      }
    ];

    mocks.fetchReports.mockImplementation(async () => mutableReports);
    mocks.resolveReport.mockImplementation(async () => {
      mutableReports[0] = {
        ...mutableReports[0],
        status: 'OFFLINE_PRODUCT',
        resolutionNote: '已核查处理'
      };
      return {};
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: '运营中心' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '举报处理' }));
    const reportRow = await screen.findByTestId('row-301');
    await user.click(within(reportRow).getByRole('button', { name: '下架商品' }));

    await waitFor(() => {
      expect(mocks.resolveReport).toHaveBeenCalledWith(301, {
        resolutionNote: '已核查处理',
        penaltyLevel: 'NORMAL',
        nextStatus: 'OFFLINE_PRODUCT'
      });
    });

    await waitFor(() => {
      const updatedRow = screen.getByTestId('row-301');
      expect(within(updatedRow).getByText('商品下架')).toBeInTheDocument();
      expect(within(updatedRow).getByText('已完成')).toBeInTheDocument();
    });
  });

  it('reviews campus services, bans risky users and supports dashboard refresh', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: '运营中心' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '发布审核' }));
    await user.click(screen.getByRole('button', { name: '服务 (2)' }));

    const serviceRow = await screen.findByTestId('row-701');
    await user.click(within(serviceRow).getByRole('button', { name: '查看资料' }));
    expect(await screen.findByText('服务资料')).toBeInTheDocument();
    expect(screen.getByText('社团活动展板和登记表需要顺路送到学院办事窗口。')).toBeInTheDocument();

    await user.click(within(serviceRow).getByRole('button', { name: /取\s*消/ }));

    await waitFor(() => {
      expect(mocks.updateAdminCampusServiceStatus).toHaveBeenCalledWith(701, {
        action: 'CANCEL',
        reason: '已核查处理'
      });
      expect(mocks.messageSuccess).toHaveBeenCalledWith('校园服务状态已更新');
    });

    await user.click(screen.getByRole('button', { name: '用户管理' }));
    const userRow = await screen.findByTestId('row-1002');
    await user.click(within(userRow).getByRole('button', { name: /封\s*禁/ }));

    await waitFor(() => {
      expect(mocks.updateUserBanStatus).toHaveBeenCalledWith(1002, {
        banned: true,
        reason: '已核查处理'
      });
      expect(mocks.messageSuccess).toHaveBeenCalledWith('用户已封禁');
    });

    await user.click(screen.getByRole('button', { name: /刷新全部/ }));

    await waitFor(() => {
      expect(mocks.fetchAdminOverview).toHaveBeenCalledTimes(4);
    });
  });
});
