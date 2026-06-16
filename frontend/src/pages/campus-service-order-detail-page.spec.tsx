import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CampusServiceOrderDetailPage } from './CampusServiceOrderDetailPage';

const mocks = vi.hoisted(() => ({
  params: { id: '701' },
  navigate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  fetchCampusServiceOrderDetail: vi.fn(),
  confirmCampusServiceOrder: vi.fn(),
  completeCampusServiceOrder: vi.fn(),
  rejectCampusServiceOrder: vi.fn(),
  cancelCampusServiceOrder: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  executeCampusServiceOrderAction: vi.fn(async ({ run, onSuccess, onFinally, notifySuccess, successMessage }: any) => {
    const result = await run();
    notifySuccess?.(successMessage);
    await onSuccess?.(result);
    onFinally?.();
    return result;
  }),
  getCampusServiceOrderRejectOrCancelText: vi.fn(() => ({
    title: '处理当前协作',
    confirmText: '确认处理'
  })),
  getCampusServiceOrderRequestLabel: vi.fn(() => '协作申请'),
  getCampusServiceOrderStatusColor: vi.fn(() => 'blue')
}));

function createCampusServiceOrderDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 701,
    listingId: 401,
    title: '代取快递订单',
    description: '帮忙送到宿舍',
    price: 8,
    imageUrl: '/order.png',
    tags: ['快递'],
    status: 'PENDING_CONFIRMATION',
    statusLabel: '待确认',
    orderStatus: 'PENDING_CONFIRMATION',
    orderStatusLabel: '待确认',
    listingStatus: 'OPEN',
    listingStatusLabel: '可参与',
    intent: 'REQUEST',
    intentLabel: '需求',
    category: 'ERRAND',
    categoryLabel: '跑腿代办',
    reward: 8,
    rewardLabel: '¥8',
    route: { from: '菜鸟驿站', to: '宿舍楼', label: '菜鸟驿站 -> 宿舍楼' },
    deadlineLabel: '今天 18:00',
    estimatedMinutes: 20,
    role: 'PROVIDER',
    roleLabel: '接单方',
    summaryTags: ['跑腿', '接单'],
    actionState: {
      canComplete: false,
      canCancel: false,
      canOpenConversation: true,
      canConfirm: true,
      canReject: true
    },
    actionLabels: {
      confirm: '确认协作',
      reject: '拒绝申请',
      complete: '提交进度',
      cancel: '取消协作',
      conversation: '看消息'
    },
    conversationId: 990,
    counterpart: {
      id: 8,
      displayName: '李同学',
      avatarUrl: null,
      avatarFrame: null,
      trustedBadgeUnlocked: false,
      creditScore: 90,
      verificationStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      college: '园林学院',
      averageRating: 4.8,
      completedOrders: 6
    },
    publisher: {
      id: 8,
      displayName: '李同学',
      avatarUrl: null,
      avatarFrame: null,
      trustedBadgeUnlocked: false,
      creditScore: 90,
      verificationStatus: 'APPROVED',
      accountStatus: 'ACTIVE',
      college: '园林学院',
      averageRating: 4.8,
      completedOrders: 6
    },
    createdAt: '2026-06-16T10:00:00.000Z',
    updatedAt: '2026-06-16T10:00:00.000Z',
    cancelReason: null,
    note: '送到宿舍楼下',
    paymentIntent: null,
    serviceTime: '今晚 19:00',
    completedAt: null,
    canceledAt: null,
    confirmedAt: null,
    completionRequestedAt: null,
    completionRequestedById: null,
    timeline: [
      { label: '创建', value: '06-16 10:00' },
      { label: '待确认', value: '06-16 10:10' }
    ],
    detailBase: {
      title: '代取快递',
      description: '从菜鸟驿站送到宿舍楼',
      amountLabel: '¥8.00',
      images: ['/service.png'],
      metaItems: [],
      summaryTags: [],
      timeline: []
    },
    listingSnapshot: {
      title: '代取快递',
      description: '从菜鸟驿站送到宿舍楼',
      categoryLabel: '跑腿代办',
      intentLabel: '需求',
      rewardLabel: '¥8',
      routeLabel: '菜鸟驿站 -> 宿舍楼',
      deadlineLabel: '今天 18:00',
      estimatedMinutes: 20,
      imageUrl: '/service.png'
    },
    ...overrides
  } as any;
}

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      success: mocks.success,
      error: mocks.error
    }
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useParams: () => mocks.params,
    useNavigate: () => mocks.navigate
  };
});

vi.mock('../services/api', () => ({
  fetchCampusServiceOrderDetail: (id: number) => mocks.fetchCampusServiceOrderDetail(id),
  confirmCampusServiceOrder: (id: number) => mocks.confirmCampusServiceOrder(id),
  completeCampusServiceOrder: (id: number) => mocks.completeCampusServiceOrder(id),
  rejectCampusServiceOrder: (id: number) => mocks.rejectCampusServiceOrder(id),
  cancelCampusServiceOrder: (id: number) => mocks.cancelCampusServiceOrder(id),
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback)
}));

vi.mock('../utils/campusServiceOrderActions', () => ({
  executeCampusServiceOrderAction: (options: any) => mocks.executeCampusServiceOrderAction(options),
  getCampusServiceOrderRejectOrCancelText: (detail: any) => mocks.getCampusServiceOrderRejectOrCancelText(detail),
  getCampusServiceOrderRequestLabel: (detail: any) => mocks.getCampusServiceOrderRequestLabel(detail)
}));

vi.mock('../utils/orderStatus', () => ({
  getCampusServiceOrderStatusColor: (status: string) => mocks.getCampusServiceOrderStatusColor(status)
}));

vi.mock('../components/layout', () => ({
  SectionHeader: ({ title }: any) => <div><h1>{title}</h1></div>
}));

vi.mock('../components/ui', () => ({
  SectionCard: ({ children }: any) => <div>{children}</div>,
  ConfirmActionModal: ({ open, title, onConfirm, onCancel, confirmText }: any) => open ? (
    <div>
      <h2>{title}</h2>
      <button type="button" onClick={onConfirm}>{confirmText}</button>
      <button type="button" onClick={onCancel}>关闭操作</button>
    </div>
  ) : null,
  OrderDetailHeroSection: ({ title, counterpartName, amountLabel }: any) => <div><span>{title}</span><span>{counterpartName}</span><span>{amountLabel}</span></div>,
  OrderDetailToolbarSection: ({ children }: any) => <div>{children}</div>,
  OrderDetailDescriptionsSection: ({ title, items }: any) => <div><span>{title}</span>{items.map((item: any) => <span key={item.key}>{item.value}</span>)}</div>,
  OrderDetailEntrySection: ({ title, subtitle, meta, onClick }: any) => <button type="button" onClick={onClick}>{title}{subtitle}{meta}</button>
}));

vi.mock('../components/user/UserNameWithBadge', () => ({
  UserNameWithBadge: ({ as: Tag = 'span', name }: any) => <Tag>{name}</Tag>
}));

describe('CampusServiceOrderDetailPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.fetchCampusServiceOrderDetail.mockReset();
    mocks.confirmCampusServiceOrder.mockReset();
    mocks.completeCampusServiceOrder.mockReset();
    mocks.rejectCampusServiceOrder.mockReset();
    mocks.cancelCampusServiceOrder.mockReset();
    mocks.getApiErrorMessage.mockReset();
    mocks.executeCampusServiceOrderAction.mockClear();
    mocks.params = { id: '701' };
    mocks.fetchCampusServiceOrderDetail.mockImplementation(async () => createCampusServiceOrderDetail());
    mocks.confirmCampusServiceOrder.mockResolvedValue(undefined);
    mocks.completeCampusServiceOrder.mockResolvedValue(undefined);
    mocks.rejectCampusServiceOrder.mockResolvedValue(undefined);
    mocks.cancelCampusServiceOrder.mockResolvedValue(undefined);
    mocks.getApiErrorMessage.mockImplementation((_error, fallback) => fallback);
  });

  it('renders the order detail, opens messages and navigates to the listing', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CampusServiceOrderDetailPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('代取快递')).toBeInTheDocument();
    expect(screen.getByText('李同学')).toBeInTheDocument();
    expect(screen.getByText('¥8')).toBeInTheDocument();
    expect(screen.getByText('菜鸟驿站 -> 宿舍楼')).toBeInTheDocument();
    expect(screen.getByText('今晚 19:00')).toBeInTheDocument();
    expect(screen.getByText('送到宿舍楼下')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '看消息' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/messages?conversationId=990');

    await user.click(screen.getByRole('button', { name: /服务发布详情/ }));
    expect(mocks.navigate).toHaveBeenCalledWith('/campus-services/401');
  });

  it('handles confirm and complete actions with reloads', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CampusServiceOrderDetailPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('代取快递')).toBeInTheDocument();
    const baselineLoadCalls = mocks.fetchCampusServiceOrderDetail.mock.calls.length;

    mocks.fetchCampusServiceOrderDetail.mockImplementationOnce(async () => createCampusServiceOrderDetail({
      orderStatus: 'CONFIRMED',
      orderStatusLabel: '进行中',
      status: 'CONFIRMED',
      statusLabel: '进行中',
      actionState: {
        canComplete: true,
        canCancel: true,
        canOpenConversation: true,
        canConfirm: false,
        canReject: false
      },
      actionLabels: {
        confirm: null,
        reject: null,
        complete: '提交进度',
        cancel: '取消协作',
        conversation: '看消息'
      }
    }));

    await user.click(screen.getByRole('button', { name: '确认协作' }));
    await waitFor(() => {
      expect(mocks.confirmCampusServiceOrder).toHaveBeenCalledWith(701);
      expect(mocks.success).toHaveBeenCalledWith('已确认“代取快递订单”的协作申请。');
      expect(mocks.fetchCampusServiceOrderDetail.mock.calls.length).toBeGreaterThan(baselineLoadCalls);
    });

    expect(await screen.findByRole('button', { name: '提交进度' })).toBeInTheDocument();
    const loadCallsBeforeComplete = mocks.fetchCampusServiceOrderDetail.mock.calls.length;
    await user.click(screen.getByRole('button', { name: '提交进度' }));

    await waitFor(() => {
      expect(mocks.completeCampusServiceOrder).toHaveBeenCalledWith(701);
      expect(mocks.success).toHaveBeenCalledWith('“代取快递订单”已更新为最新进度。');
      expect(mocks.fetchCampusServiceOrderDetail.mock.calls.length).toBeGreaterThan(loadCallsBeforeComplete);
    });
  });

  it('handles reject action through the confirm modal', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CampusServiceOrderDetailPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('代取快递')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '拒绝申请' }));
    await user.click(screen.getByRole('button', { name: '确认处理' }));

    await waitFor(() => {
      expect(mocks.rejectCampusServiceOrder).toHaveBeenCalledWith(701);
      expect(mocks.success).toHaveBeenCalledWith('已拒绝“代取快递订单”的协作申请。');
    });
  });

  it('handles cancel action through the confirm modal', async () => {
    const user = userEvent.setup();
    mocks.fetchCampusServiceOrderDetail.mockImplementation(async () => createCampusServiceOrderDetail({
      status: 'CONFIRMED',
      statusLabel: '进行中',
      orderStatus: 'CONFIRMED',
      orderStatusLabel: '进行中',
      actionState: {
        canComplete: false,
        canCancel: true,
        canOpenConversation: true,
        canConfirm: false,
        canReject: false
      },
      actionLabels: {
        confirm: null,
        reject: null,
        complete: null,
        cancel: '取消协作',
        conversation: '看消息'
      }
    }));

    render(
      <MemoryRouter>
        <CampusServiceOrderDetailPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: '取消协作' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '取消协作' }));
    await user.click(screen.getByRole('button', { name: '确认处理' }));

    await waitFor(() => {
      expect(mocks.cancelCampusServiceOrder).toHaveBeenCalledWith(701);
      expect(mocks.success).toHaveBeenCalledWith('“代取快递订单”已取消。');
    });
  });

  it('shows error state for invalid ids and failed loads', async () => {
    mocks.params = { id: 'bad' };
    const { rerender } = render(
      <MemoryRouter>
        <CampusServiceOrderDetailPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('缺少有效服务单编号。')).toBeInTheDocument();
    expect(screen.getByText('未找到服务单信息')).toBeInTheDocument();

    mocks.params = { id: '702' };
    mocks.fetchCampusServiceOrderDetail.mockRejectedValueOnce(new Error('boom'));
    mocks.getApiErrorMessage.mockReturnValueOnce('服务单详情加载失败。');
    rerender(
      <MemoryRouter>
        <CampusServiceOrderDetailPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('服务单详情加载失败。')).toBeInTheDocument();
    expect(screen.getByText('未找到服务单信息')).toBeInTheDocument();
  });
});
