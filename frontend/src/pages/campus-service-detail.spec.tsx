import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CampusServiceDetailPage } from './CampusServiceDetailPage';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  formInstance: {
    setFieldsValue: vi.fn(),
    validateFields: vi.fn(),
    resetFields: vi.fn()
  },
  fetchCampusServiceDetail: vi.fn(),
  addCampusServiceFavorite: vi.fn(),
  removeCampusServiceFavorite: vi.fn(),
  acceptCampusServiceListing: vi.fn(),
  cancelCampusServiceListing: vi.fn(),
  cancelCampusServiceOrder: vi.fn(),
  completeCampusServiceOrder: vi.fn(),
  confirmCampusServiceOrder: vi.fn(),
  createReport: vi.fn(),
  endCampusServiceListing: vi.fn(),
  executeToggleFollow: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  pauseCampusServiceListing: vi.fn(),
  rejectCampusServiceOrder: vi.fn(),
  reopenCampusServiceListing: vi.fn(),
  useAuthState: vi.fn(),
  loadFollowStateForTarget: vi.fn(),
  openReportForm: vi.fn(({ open }: any) => open()),
  submitReportForm: vi.fn(async ({ submit, onSuccess }: any) => {
    await submit('测试举报原因');
    onSuccess();
    return true;
  }),
  ensureTradingAccessOrNotify: vi.fn((_options?: any) => true)
}));

vi.mock('@leenguyen/react-flip-clock-countdown', () => ({
  default: () => <div>countdown</div>
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      error: mocks.error,
      success: mocks.success,
      info: mocks.info
    },
    Form: {
      ...actual.Form,
      useForm: () => [mocks.formInstance]
    }
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useParams: () => ({ id: '301' }),
    Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>
  };
});

vi.mock('../services/auth-state', () => ({
  useAuthState: () => mocks.useAuthState()
}));

vi.mock('../services/api', () => ({
  fetchCampusServiceDetail: (...args: any[]) => mocks.fetchCampusServiceDetail(...args),
  addCampusServiceFavorite: (...args: any[]) => mocks.addCampusServiceFavorite(...args),
  removeCampusServiceFavorite: (...args: any[]) => mocks.removeCampusServiceFavorite(...args),
  acceptCampusServiceListing: (...args: any[]) => mocks.acceptCampusServiceListing(...args),
  cancelCampusServiceListing: (...args: any[]) => mocks.cancelCampusServiceListing(...args),
  cancelCampusServiceOrder: (...args: any[]) => mocks.cancelCampusServiceOrder(...args),
  completeCampusServiceOrder: (...args: any[]) => mocks.completeCampusServiceOrder(...args),
  confirmCampusServiceOrder: (...args: any[]) => mocks.confirmCampusServiceOrder(...args),
  createReport: (...args: any[]) => mocks.createReport(...args),
  endCampusServiceListing: (...args: any[]) => mocks.endCampusServiceListing(...args),
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback),
  pauseCampusServiceListing: (...args: any[]) => mocks.pauseCampusServiceListing(...args),
  reopenCampusServiceListing: (...args: any[]) => mocks.reopenCampusServiceListing(...args),
  rejectCampusServiceOrder: (...args: any[]) => mocks.rejectCampusServiceOrder(...args)
}));

vi.mock('../utils/followActions', () => ({
  executeToggleFollow: (options: any) => mocks.executeToggleFollow(options)
}));

vi.mock('../utils/followState', () => ({
  loadFollowStateForTarget: (options: any) => mocks.loadFollowStateForTarget(options)
}));

vi.mock('../utils/reportForm', () => ({
  openReportForm: (options: any) => mocks.openReportForm(options),
  submitReportForm: (options: any) => mocks.submitReportForm(options)
}));

vi.mock('../utils/tradingAccess', () => ({
  ensureTradingAccessOrNotify: (options: any) => mocks.ensureTradingAccessOrNotify(options)
}));

vi.mock('../components/user/UserAvatar', () => ({
  UserAvatar: ({ alt, fallbackLabel }: any) => <span>{alt || fallbackLabel || 'avatar'}</span>
}));

vi.mock('../components/user/UserNameWithBadge', () => ({
  UserNameWithBadge: ({ as: Tag = 'span', name }: any) => <Tag>{name}</Tag>
}));

vi.mock('../components/ui', () => ({
  ConfirmReasonModal: ({ open, title, confirmText, onConfirm, onCancel, reason, onReasonChange }: any) => open ? (
    <div data-testid="confirm-reason-modal">
      <div>{title}</div>
      <input
        aria-label={`${title}-reason`}
        value={reason}
        onChange={(event) => onReasonChange?.(event.target.value)}
      />
      <button type="button" onClick={onConfirm}>{confirmText}</button>
      <button type="button" onClick={onCancel}>关闭确认</button>
    </div>
  ) : null,
  DetailContentBody: ({ title, description }: any) => <div><h2>{title}</h2><p>{description}</p></div>,
  DetailActionFooter: ({ actions, quietAction }: any) => <div>{actions}{quietAction}</div>,
  DetailInfoPanel: ({ top, body, footer }: any) => <div>{top}{body}{footer}</div>,
  DetailMediaGallery: ({ title }: any) => <div>{title} 图库</div>,
  DetailInfoTopSummary: ({ stats, favoriteButton, amount }: any) => <div>{stats.join(' / ')}{favoriteButton}{amount}</div>,
  DetailSellerStrip: ({ name, followButton }: any) => <div><span>{name}</span>{followButton}</div>,
  FormActionModal: ({ open, title, onSubmit, onCancel, okText, children }: any) => open ? (
    <div data-testid="form-action-modal">
      <div>{title}</div>
      {children}
      <button type="button" onClick={onSubmit}>{okText}</button>
      <button type="button" onClick={onCancel}>关闭表单</button>
    </div>
  ) : null,
  ReportFormModal: ({ open, onSubmit, onCancel }: any) => open ? <div><button type="button" onClick={onSubmit}>提交举报</button><button type="button" onClick={onCancel}>关闭举报</button></div> : null
}));

vi.mock('../components/layout', () => ({
  DetailShell: ({ mainMedia, sidePanel, bottomContent }: any) => <div>{mainMedia}{sidePanel}{bottomContent}</div>
}));

vi.mock('../components/listing', () => ({
  CampusServicePublisherOrderWorkbench: ({ onConfirmOrder, onRejectOrder, onCompleteOrder, onCancelOrder, onError }: any) => (
    <div>
      <div>publisher-workbench</div>
      <button
        type="button"
        onClick={() => onConfirmOrder({
          id: 701,
          title: '待确认订单',
          intent: 'REQUEST'
        })}
      >
        确认工单
      </button>
      <button
        type="button"
        onClick={() => onCompleteOrder({
          id: 702,
          title: '待完成订单',
          intent: 'OFFER'
        })}
      >
        完成工单
      </button>
      <button
        type="button"
        onClick={() => onRejectOrder({
          id: 703,
          title: '待拒绝订单',
          actionState: { canReject: true },
          actionLabels: { reject: '拒绝申请' }
        })}
      >
        拒绝工单
      </button>
      <button
        type="button"
        onClick={() => onCancelOrder({
          id: 704,
          title: '待取消订单',
          actionState: { canReject: false },
          actionLabels: { cancel: '取消协作' }
        })}
      >
        取消工单
      </button>
      <button type="button" onClick={() => onError('工单加载失败')}>工单报错</button>
    </div>
  ),
  ListingDetailMetaPanel: ({ detail }: any) => <div>{detail.title}</div>
}));

describe('CampusServiceDetailPage', () => {
  function createCampusServiceDetail(overrides: Record<string, any> = {}) {
    const base = {
      id: 301,
      title: '代取快递',
      description: '本人发布的服务',
      imageUrl: '/service.png',
      images: ['/service.png'],
      category: 'ERRAND',
      categoryLabel: '跑腿代办',
      intent: 'REQUEST',
      intentLabel: '我要购买服务',
      reward: 8,
      rewardLabel: '¥8',
      price: 8,
      priceMode: 'FIXED',
      status: 'OPEN',
      statusLabel: '进行中',
      deadlineLabel: '明天 18:00',
      locationFrom: '菜鸟驿站',
      locationTo: '3号宿舍楼',
      detailBase: {
        title: '代取快递',
        description: '本人发布的服务',
        amountLabel: '¥8.00',
        images: ['/service.png'],
        metaItems: [],
        summaryTags: [],
        timeline: []
      },
      publisher: {
        id: 51,
        displayName: '发布者本人',
        avatarUrl: null,
        avatarFrame: null,
        college: '信息学院',
        completedOrders: 4,
        averageRating: 4.9,
        creditScore: 90,
        verificationStatus: 'APPROVED',
        accountStatus: 'ACTIVE'
      },
      participant: null,
      stats: {
        wantCount: 2,
        favoriteCount: 3,
        reportCount: 0,
        viewCount: 12
      },
      isFavorited: false,
      actionState: {
        isPublisher: true,
        isParticipant: false,
        canAccept: false,
        canConfirm: false,
        canReject: false,
        canComplete: false,
        canPause: true,
        canReopen: false,
        canEnd: true,
        canCancel: false,
        canOpenConversation: false,
        canEdit: false
      },
      actionLabels: {
        accept: null,
        confirm: null,
        reject: null,
        complete: null,
        pause: '暂停开放',
        reopen: null,
        end: '结束当前发布',
        cancel: null,
        conversation: null
      },
      conversationId: null,
      actionOrderId: null,
      latestOrderId: null,
      activeOrderCount: 0,
      pendingOrderCount: 0,
      waitingCompleteOrderCount: 0,
      endedOrderCount: 0,
      totalOrderCount: 0,
      fulfillment: {
        validUntilAt: '2099-06-16T18:00:00.000Z',
        activeOrderCount: 0,
        totalOrderCount: 0,
        maxTotalOrders: null
      }
    };

    return {
      ...base,
      ...overrides,
      detailBase: { ...base.detailBase, ...(overrides.detailBase ?? {}) },
      publisher: { ...base.publisher, ...(overrides.publisher ?? {}) },
      stats: { ...base.stats, ...(overrides.stats ?? {}) },
      actionState: { ...base.actionState, ...(overrides.actionState ?? {}) },
      actionLabels: { ...base.actionLabels, ...(overrides.actionLabels ?? {}) },
      fulfillment: { ...base.fulfillment, ...(overrides.fulfillment ?? {}) }
    } as any;
  }

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/campus-services/301']}>
        <Routes>
          <Route path="/campus-services/:id" element={<CampusServiceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
  }

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.navigate.mockReset();
    mocks.error.mockReset();
    mocks.success.mockReset();
    mocks.info.mockReset();
    mocks.formInstance.setFieldsValue.mockReset();
    mocks.formInstance.validateFields.mockReset();
    mocks.formInstance.resetFields.mockReset();
    mocks.fetchCampusServiceDetail.mockReset();
    mocks.addCampusServiceFavorite.mockReset();
    mocks.removeCampusServiceFavorite.mockReset();
    mocks.acceptCampusServiceListing.mockReset();
    mocks.cancelCampusServiceListing.mockReset();
    mocks.cancelCampusServiceOrder.mockReset();
    mocks.completeCampusServiceOrder.mockReset();
    mocks.confirmCampusServiceOrder.mockReset();
    mocks.createReport.mockReset();
    mocks.endCampusServiceListing.mockReset();
    mocks.executeToggleFollow.mockReset();
    mocks.getApiErrorMessage.mockReset();
    mocks.pauseCampusServiceListing.mockReset();
    mocks.rejectCampusServiceOrder.mockReset();
    mocks.reopenCampusServiceListing.mockReset();
    mocks.useAuthState.mockReset();
    mocks.loadFollowStateForTarget.mockReset();
    mocks.openReportForm.mockReset();
    mocks.submitReportForm.mockReset();
    mocks.ensureTradingAccessOrNotify.mockReset();
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 51, displayName: '发布者本人', email: 'owner@example.com', role: 'USER', verificationStatus: 'APPROVED' }
    });
    mocks.addCampusServiceFavorite.mockResolvedValue({ isFavorited: true, favoriteCount: 4 });
    mocks.removeCampusServiceFavorite.mockResolvedValue({ isFavorited: false, favoriteCount: 2 });
    mocks.acceptCampusServiceListing.mockResolvedValue({});
    mocks.cancelCampusServiceListing.mockResolvedValue({});
    mocks.cancelCampusServiceOrder.mockResolvedValue({});
    mocks.completeCampusServiceOrder.mockResolvedValue({});
    mocks.confirmCampusServiceOrder.mockResolvedValue({});
    mocks.createReport.mockResolvedValue({});
    mocks.endCampusServiceListing.mockResolvedValue({});
    mocks.executeToggleFollow.mockImplementation(async ({ onSuccess, notifySuccess, onFinally }: any) => {
      onSuccess?.({ isFollowing: true });
      notifySuccess?.('已关注发布者');
      onFinally?.();
    });
    mocks.openReportForm.mockImplementation(({ open }: any) => open());
    mocks.submitReportForm.mockImplementation(async ({ submit, onSuccess }: any) => {
      await submit('测试举报原因');
      onSuccess();
      return true;
    });
    mocks.ensureTradingAccessOrNotify.mockImplementation((_options?: any) => true);
    mocks.loadFollowStateForTarget.mockImplementation(async ({ apply }: any) => apply(false));
    mocks.fetchCampusServiceDetail.mockResolvedValue(createCampusServiceDetail());
  });

  afterEach(() => {
    cleanup();
  });

  it('hides buyer-side actions on own listing detail', async () => {
    render(
      <MemoryRouter initialEntries={['/campus-services/301']}>
        <Routes>
          <Route path="/campus-services/:id" element={<CampusServiceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('发布者本人')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '收藏服务' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '聊一聊' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '报名接单' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂停开放' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '结束当前发布' })).toBeInTheDocument();
  });

  it('submits report with listing target only', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 88, displayName: '普通用户', email: 'user@example.com', role: 'USER', verificationStatus: 'APPROVED' }
    });

    render(
      <MemoryRouter initialEntries={['/campus-services/301']}>
        <Routes>
          <Route path="/campus-services/:id" element={<CampusServiceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('发布者本人');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '举报' }));
    await user.click(screen.getByRole('button', { name: '提交举报' }));

    expect(mocks.createReport).toHaveBeenCalledWith({
      campusServiceListingId: 301,
      reason: expect.any(String)
    });
  });

  it('handles favorite and follow interactions for non-publisher viewers', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 88, displayName: '普通用户', email: 'user@example.com', role: 'USER', verificationStatus: 'APPROVED' }
    });
    mocks.fetchCampusServiceDetail.mockResolvedValue(createCampusServiceDetail({
      publisher: { id: 51, displayName: '服务发布者' },
      isFavorited: false,
      stats: { favoriteCount: 3 },
      actionState: {
        isPublisher: false,
        canPause: false,
        canEnd: false,
        canOpenConversation: true
      },
      conversationId: 6001
    }));

    render(
      <MemoryRouter initialEntries={['/campus-services/301']}>
        <Routes>
          <Route path="/campus-services/:id" element={<CampusServiceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    const user = userEvent.setup();
    expect(await screen.findByText('服务发布者')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '关注' }));
    expect(mocks.executeToggleFollow).toHaveBeenCalledWith(expect.objectContaining({
      targetUserId: 51,
      isFollowing: false
    }));
    expect(mocks.success).toHaveBeenCalledWith('已关注发布者');
    expect(await screen.findByRole('button', { name: '已关注' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '收藏服务' }));
    await waitFor(() => {
      expect(mocks.addCampusServiceFavorite).toHaveBeenCalledWith(301);
    });
    expect(mocks.success).toHaveBeenCalledWith('已加入收藏');
    expect(await screen.findByRole('button', { name: '取消收藏' })).toBeInTheDocument();
    expect(screen.getByText(/4 收藏/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '聊一聊' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/messages?conversationId=6001');
  });

  it('shows invalid deadline fallback for malformed times', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 88, displayName: '普通用户', email: 'user@example.com', role: 'USER', verificationStatus: 'APPROVED' }
    });
    mocks.fetchCampusServiceDetail.mockResolvedValue(createCampusServiceDetail({
      actionState: { isPublisher: false, canPause: false, canEnd: false },
      fulfillment: { validUntilAt: 'invalid-time' }
    }));

    renderPage();
    expect(await screen.findByText('时间无效')).toBeInTheDocument();
  });

  it('shows expired deadline fallback for past-due listings', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 88, displayName: '普通用户', email: 'user@example.com', role: 'USER', verificationStatus: 'APPROVED' }
    });
    mocks.fetchCampusServiceDetail.mockResolvedValue(createCampusServiceDetail({
      actionState: { isPublisher: false, canPause: false, canEnd: false },
      deadlineLabel: '今天 09:00',
      fulfillment: { validUntilAt: '2000-01-01T00:00:00.000Z' }
    }));

    renderPage();
    expect(await screen.findByText('已过期')).toBeInTheDocument();
    expect(screen.getByText('今天 09:00 · 已过期')).toBeInTheDocument();
  });

  it('shows the missing-listing shell when detail loading fails', async () => {
    mocks.fetchCampusServiceDetail.mockRejectedValueOnce(new Error('missing'));

    renderPage();
    expect(await screen.findByText('服务不存在')).toBeInTheDocument();
  });

  it('starts checkout when a viewer can accept the listing', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 88, displayName: '普通用户', email: 'user@example.com', role: 'USER', verificationStatus: 'APPROVED' }
    });
    mocks.fetchCampusServiceDetail.mockResolvedValue(createCampusServiceDetail({
      actionState: {
        isPublisher: false,
        canAccept: true,
        canPause: false,
        canEnd: false,
        canOpenConversation: false
      }
    }));

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('button', { name: '报名接单' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '报名接单' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/orders/checkout?type=service&serviceId=301');
  });

  it('confirms a pending service order from the primary action button', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 88, displayName: '普通用户', email: 'user@example.com', role: 'USER', verificationStatus: 'APPROVED' }
    });
    mocks.fetchCampusServiceDetail.mockResolvedValue(createCampusServiceDetail({
      actionState: {
        isPublisher: false,
        canAccept: false,
        canConfirm: true,
        canPause: false,
        canEnd: false,
        canOpenConversation: false
      },
      actionOrderId: 901,
      actionLabels: { confirm: '确认申请' }
    }));

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('button', { name: '确认申请' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '确认申请' }));
    await waitFor(() => {
      expect(mocks.confirmCampusServiceOrder).toHaveBeenCalledWith(901);
    });
  });

  it('marks a service order complete from the primary action button', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 88, displayName: '普通用户', email: 'user@example.com', role: 'USER', verificationStatus: 'APPROVED' }
    });
    mocks.fetchCampusServiceDetail.mockResolvedValue(createCampusServiceDetail({
      actionState: {
        isPublisher: false,
        canAccept: false,
        canConfirm: false,
        canComplete: true,
        canPause: false,
        canEnd: false,
        canOpenConversation: false
      },
      actionOrderId: 902,
      actionLabels: { complete: '提交进度' }
    }));

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('button', { name: '提交进度' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '提交进度' }));
    await waitFor(() => {
      expect(mocks.completeCampusServiceOrder).toHaveBeenCalledWith(902);
    });
  });

  it('disables viewer actions when no trade action is available', async () => {
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 88, displayName: '普通用户', email: 'user@example.com', role: 'USER', verificationStatus: 'APPROVED' }
    });
    mocks.fetchCampusServiceDetail.mockResolvedValue(createCampusServiceDetail({
      actionState: {
        isPublisher: false,
        canAccept: false,
        canConfirm: false,
        canComplete: false,
        canPause: false,
        canEnd: false,
        canOpenConversation: false
      }
    }));

    renderPage();
    const disabledAction = await screen.findByRole('button', { name: '报名接单' });
    expect(disabledAction).toBeDisabled();
    expect(screen.getByRole('button', { name: '聊一聊' })).toBeDisabled();
  });

  it('runs publisher workbench actions and surfaces workbench errors', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('publisher-workbench')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '确认工单' }));
    await waitFor(() => {
      expect(mocks.confirmCampusServiceOrder).toHaveBeenCalledWith(701);
    });

    await user.click(screen.getByRole('button', { name: '完成工单' }));
    await waitFor(() => {
      expect(mocks.completeCampusServiceOrder).toHaveBeenCalledWith(702);
    });

    await user.click(screen.getByRole('button', { name: '拒绝工单' }));
    const rejectModal = await screen.findByTestId('confirm-reason-modal');
    await user.type(within(rejectModal).getByLabelText('拒绝申请-reason'), '不合适');
    await user.click(within(rejectModal).getByRole('button', { name: '拒绝申请' }));
    await waitFor(() => {
      expect(mocks.rejectCampusServiceOrder).toHaveBeenCalledWith(703, {
        reason: '不合适'
      });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-reason-modal')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '取消工单' }));
    const cancelOrderModal = await screen.findByTestId('confirm-reason-modal');
    await user.click(within(cancelOrderModal).getByRole('button', { name: '取消协作' }));
    await waitFor(() => {
      expect(mocks.cancelCampusServiceOrder).toHaveBeenCalledWith(704, {
        reason: undefined
      });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-reason-modal')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '工单报错' }));
    expect(await screen.findByText('工单加载失败')).toBeInTheDocument();
  });

  it('allows publishers to pause the listing', async () => {
    const user = userEvent.setup();

    renderPage();
    expect(await screen.findByRole('button', { name: '暂停开放' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '暂停开放' }));
    await waitFor(() => {
      expect(mocks.pauseCampusServiceListing).toHaveBeenCalledWith(301);
    });
  });

  it('allows publishers to reopen the listing', async () => {
    mocks.fetchCampusServiceDetail.mockResolvedValue(createCampusServiceDetail({
      actionState: {
        isPublisher: true,
        canPause: false,
        canReopen: true,
        canEnd: false,
        canCancel: false
      },
      actionLabels: {
        reopen: '重新开放'
      }
    }));

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('button', { name: '重新开放' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '重新开放' }));
    await waitFor(() => {
      expect(mocks.reopenCampusServiceListing).toHaveBeenCalledWith(301);
    });
  });

  it('allows publishers to end the listing with a reason', async () => {
    mocks.fetchCampusServiceDetail.mockResolvedValue(createCampusServiceDetail({
      actionState: {
        isPublisher: true,
        canPause: false,
        canReopen: false,
        canEnd: true,
        canCancel: false
      },
      actionLabels: {
        end: '结束当前发布'
      }
    }));

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('button', { name: '结束当前发布' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '结束当前发布' }));
    const modal = await screen.findByTestId('confirm-reason-modal');
    await user.type(within(modal).getByLabelText('关闭发布-reason'), '今日截止');
    await user.click(within(modal).getByRole('button', { name: '确认关闭' }));
    await waitFor(() => {
      expect(mocks.endCampusServiceListing).toHaveBeenCalledWith(301, {
        reason: '今日截止'
      });
    });
  });
});
