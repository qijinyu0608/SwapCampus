import { cleanup, render, screen } from '@testing-library/react';
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
  createReport: vi.fn(),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
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
  createReport: (...args: any[]) => mocks.createReport(...args),
  getApiErrorMessage: (error: unknown, fallback: string) => mocks.getApiErrorMessage(error, fallback),
  acceptCampusServiceListing: vi.fn(),
  cancelCampusServiceListing: vi.fn(),
  cancelCampusServiceOrder: vi.fn(),
  completeCampusServiceOrder: vi.fn(),
  confirmCampusServiceOrder: vi.fn(),
  endCampusServiceListing: vi.fn(),
  pauseCampusServiceListing: vi.fn(),
  reopenCampusServiceListing: vi.fn(),
  rejectCampusServiceOrder: vi.fn()
}));

vi.mock('../utils/followActions', () => ({
  executeToggleFollow: vi.fn()
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
  ConfirmReasonModal: () => null,
  DetailContentBody: ({ title, description }: any) => <div><h2>{title}</h2><p>{description}</p></div>,
  DetailActionFooter: ({ actions, quietAction }: any) => <div>{actions}{quietAction}</div>,
  DetailInfoPanel: ({ top, body, footer }: any) => <div>{top}{body}{footer}</div>,
  DetailMediaGallery: ({ title }: any) => <div>{title} 图库</div>,
  DetailInfoTopSummary: ({ stats, favoriteButton, amount }: any) => <div>{stats.join(' / ')}{favoriteButton}{amount}</div>,
  DetailSellerStrip: ({ name, followButton }: any) => <div><span>{name}</span>{followButton}</div>,
  FormActionModal: () => null,
  ReportFormModal: ({ open, onSubmit, onCancel }: any) => open ? <div><button type="button" onClick={onSubmit}>提交举报</button><button type="button" onClick={onCancel}>关闭举报</button></div> : null
}));

vi.mock('../components/layout', () => ({
  DetailShell: ({ mainMedia, sidePanel, bottomContent }: any) => <div>{mainMedia}{sidePanel}{bottomContent}</div>
}));

vi.mock('../components/listing', () => ({
  CampusServicePublisherOrderWorkbench: () => <div>publisher-workbench</div>,
  ListingDetailMetaPanel: ({ detail }: any) => <div>{detail.title}</div>
}));

describe('CampusServiceDetailPage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.useAuthState.mockReturnValue({
      currentUser: { id: 51, displayName: '发布者本人', email: 'owner@example.com', role: 'USER', verificationStatus: 'APPROVED' }
    });
    mocks.loadFollowStateForTarget.mockImplementation(async ({ apply }: any) => apply(false));
    mocks.fetchCampusServiceDetail.mockResolvedValue({
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
        canOpenConversation: false
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
    });
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
});
