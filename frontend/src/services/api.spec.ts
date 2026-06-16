import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  function createClient(name: string) {
    const client: any = {
      name,
      get: vi.fn(async (_url: string, _config?: any) => ({ data: { client: name, method: 'get', url: _url, config: _config } })),
      post: vi.fn(async (_url: string, _body?: any, _config?: any) => ({ data: { client: name, method: 'post', url: _url, body: _body, config: _config } })),
      patch: vi.fn(async (_url: string, _body?: any, _config?: any) => ({ data: { client: name, method: 'patch', url: _url, body: _body, config: _config } })),
      delete: vi.fn(async (_url: string, _config?: any) => ({ data: { client: name, method: 'delete', url: _url, config: _config } })),
      requestHandler: null as any,
      responseErrorHandler: null as any,
      interceptors: {
        request: {
          use: vi.fn((handler: any) => {
            client.requestHandler = handler;
          })
        },
        response: {
          use: vi.fn((_ok: any, onError: any) => {
            client.responseErrorHandler = onError;
          })
        }
      }
    };
    return client;
  }

  const apiClient = createClient('api');
  const authClient = createClient('auth');
  let createCount = 0;

  return {
    apiClient,
    authClient,
    create: vi.fn(() => (createCount += 1) === 1 ? apiClient : authClient),
    addAxiosInterceptors: vi.fn(),
    clearCurrentUserStorage: vi.fn(),
    getDevAuthToken: vi.fn<() => string | null>(() => null),
    saveDevAuthToken: vi.fn()
  };
});

vi.mock('axios', () => ({
  default: {
    create: mocks.create
  }
}));

vi.mock('supertokens-auth-react/recipe/session', () => ({
  default: {
    addAxiosInterceptors: mocks.addAxiosInterceptors
  }
}));

vi.mock('./session', () => ({
  clearCurrentUserStorage: mocks.clearCurrentUserStorage,
  getDevAuthToken: mocks.getDevAuthToken,
  saveDevAuthToken: mocks.saveDevAuthToken
}));

import * as api from './api';

beforeEach(() => {
  mocks.apiClient.get.mockClear();
  mocks.apiClient.post.mockClear();
  mocks.apiClient.patch.mockClear();
  mocks.apiClient.delete.mockClear();
  mocks.authClient.get.mockClear();
  mocks.authClient.post.mockClear();
  mocks.authClient.patch.mockClear();
  mocks.authClient.delete.mockClear();
  mocks.clearCurrentUserStorage.mockClear();
  mocks.getDevAuthToken.mockClear();
  mocks.saveDevAuthToken.mockClear();
  mocks.getDevAuthToken.mockReturnValue(null);
});

describe('api.ts wrappers', () => {
  it('registers axios/supertokens interceptors and auth hooks', async () => {
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.addAxiosInterceptors).toHaveBeenCalledTimes(2);

    mocks.getDevAuthToken.mockReturnValue('dev-user-1');
    const config = await mocks.apiClient.requestHandler({ headers: {} });
    expect(config.headers['x-dev-auth-user-id']).toBe('dev-user-1');

    await expect(mocks.apiClient.responseErrorHandler({ response: { status: 401 } })).rejects.toEqual({ response: { status: 401 } });
    expect(mocks.clearCurrentUserStorage).toHaveBeenCalledTimes(1);
  });

  it('extracts readable api error messages', () => {
    expect(api.getApiErrorMessage({ response: { data: { message: ['第一条', '第二条'] } } }, 'fallback')).toBe('第一条');
    expect(api.getApiErrorMessage({ response: { data: { message: '直接错误' } } }, 'fallback')).toBe('直接错误');
    expect(api.getApiErrorMessage(null, 'fallback')).toBe('fallback');
  });

  it('calls product and auth endpoints with normalized params', async () => {
    const productResult = await api.fetchProducts({ q: '键盘', ids: [1, 2], status: 'ON_SALE' });
    expect(productResult).toEqual(expect.objectContaining({ url: '/products', method: 'get' }));
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/products', {
      params: {
        q: '键盘',
        ids: '1,2',
        status: 'ON_SALE'
      }
    });

    await api.fetchHomeRecommendations();
    await api.fetchProductDetail(9);
    await api.recordProductContact(9);
    await api.fetchFavoriteList();
    await api.addFavorite(9);
    await api.removeFavorite(9);
    await api.fetchPublishingRules();
    await api.fetchDashboardStats();
    await api.fetchCurrentSession();
    await api.fetchBrowsingHistory({ page: 2, pageSize: 5 });
    await api.fetchFollowingUsers({ page: 1, pageSize: 10 });
    await api.followUser(2);
    await api.unfollowUser(2);

    expect(mocks.apiClient.get).toHaveBeenCalledWith('/products/home-recommendations');
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/products/9');
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/products/9/contact');
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/favorites');
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/favorites/9');
    expect(mocks.apiClient.delete).toHaveBeenCalledWith('/favorites/9');
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/products/publishing-rules');
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/products/dashboard');
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/auth/me');
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/users/me/history', { params: { page: 2, pageSize: 5 } });
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/users/me/following', { params: { page: 1, pageSize: 10 } });
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/users/2/follow');
    expect(mocks.apiClient.delete).toHaveBeenCalledWith('/users/2/follow');

    await api.registerUser({
      studentId: '202600001',
      displayName: '测试用户',
      email: 'test@example.com',
      college: '信息学院',
      graduationYear: 2028,
      avatarUrl: '/avatar.png',
      verificationCode: '123456',
      password: 'password'
    });
    expect(mocks.clearCurrentUserStorage).toHaveBeenCalled();
    expect(mocks.authClient.post).toHaveBeenCalledWith(
      '/auth/register',
      expect.any(FormData),
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    const authBody = mocks.authClient.post.mock.calls[0][1] as FormData;
    expect(authBody.get('studentId')).toBe('202600001');
    expect(authBody.get('displayName')).toBe('测试用户');
    expect(authBody.get('email')).toBe('test@example.com');
    expect(authBody.get('college')).toBe('信息学院');
    expect(authBody.get('graduationYear')).toBe('2028');
    expect(authBody.get('avatarUrl')).toBe('/avatar.png');

    const formData = new FormData();
    formData.append('studentId', '202600002');
    await api.registerUserMultipart(formData);
    expect(mocks.authClient.post).toHaveBeenCalledWith(
      '/auth/register',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    await api.loginUser({ account: '202600001', password: 'password' });
    expect(mocks.authClient.post).toHaveBeenCalledWith('/auth/login', { account: '202600001', password: 'password' });

    await api.logoutUser();
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/auth/logout');
  });

  it('calls order, admin, profile, credit center, report and campus-service endpoints', async () => {
    await api.createProduct({ title: '键盘' } as any);
    await api.fetchOrders({ page: 1, pageSize: 10 });
    await api.fetchOrderDetail(8);
    await api.createOrder({ productId: 8 } as any);
    await api.confirmOrderMeetup(8, { meetupLocation: '图书馆', note: '今晚' });
    await api.cancelOrder(8, { reason: '取消' });
    await api.completeOrderMeetup(8);
    await api.createOrderReview(8, { rating: 5, content: '很好' });
    await api.createOrderAppeal(8, { issueType: 'FAKE', reason: '有问题' });
    await api.fetchConversations();
    await api.createConversation({ productId: 8 });
    await api.fetchConversationMessages(3);
    await api.sendConversationMessage(3, { content: '你好' } as any);
    await api.fetchAdminOverview();
    await api.updateAdminProductStatus(1, 'OFFLINE', { reason: '违规' });
    await api.fetchAdminProductPreview(1);
    await api.fetchAdminOrders();
    await api.fetchAdminOrderAppeals();
    await api.updateAdminOrderStatus(1, { status: 'CANCELED', reason: '处理' });
    await api.resolveAdminOrderAppeal(1, { nextStatus: 'RESOLVED', resolutionNote: '已处理', penaltyLevel: 'NORMAL' });
    await api.fetchAdminCampusServices();
    await api.updateAdminCampusServiceStatus(1, { action: 'PAUSE', reason: '暂停' } as any);
    await api.fetchAdminCampusServicePreview(1);
    await api.fetchUserTrustSummary(1);
    await api.fetchUserReceivedReviews(1);
    await api.fetchUserProfile(1);
    await api.fetchCreditCenterSummary();
    await api.checkInCreditCenter();
    await api.fetchCreditCenterMissions();
    await api.claimCreditMission('DAILY_SIGNIN');
    await api.fetchCreditCenterLedger();
    await api.fetchCreditCenterRewards();
    await api.redeemCreditReward('PROFILE_FRAME_BLUE', { note: '备注' });
    await api.updateUserProfile(1, {
      displayName: '张三',
      email: 'zs@example.com',
      realName: '张三',
      college: '信息学院',
      graduationYear: 2028,
      phone: '123456'
    });
    await api.uploadImageAsset(new File(['x'], 'avatar.png', { type: 'image/png' }), 'avatar');
    await api.uploadMessageAttachment(new File(['x'], 'chat.png', { type: 'image/png' }));
    await api.fetchModerationUsers({ page: 1, pageSize: 20, keyword: '张三' });
    await api.updateUserBanStatus(1, { banned: true, reason: '违规' });
    await api.updateUserVerificationStatus(1, { status: 'APPROVED', reason: '通过' });
    await api.createReport({ productId: 1, reason: '举报' });
    await api.addCampusServiceFavorite(1);
    await api.removeCampusServiceFavorite(1);
    await api.fetchReports();
    await api.resolveReport(1, { resolutionNote: '已处理', nextStatus: 'RESOLVED', penaltyLevel: 'NORMAL' });
    await api.fetchAuditLogs();
    await api.fetchCampusServiceListings({ intent: 'REQUEST', categories: ['ERRAND' as any], page: 1, pageSize: 12 });
    await api.fetchCampusServiceDetail(1);
    await api.createCampusServiceListing({ title: '代取快递' } as any);
    await api.acceptCampusServiceListing(1, { initialMessage: '我来接' });
    await api.pauseCampusServiceListing(1);
    await api.reopenCampusServiceListing(1);
    await api.endCampusServiceListing(1, { reason: '结束' });
    await api.completeCampusServiceListing(1);
    await api.cancelCampusServiceListing(1, { reason: '取消' });
    await api.confirmCampusServiceOrder(1);
    await api.fetchCampusServiceOrderDetail(1);
    await api.rejectCampusServiceOrder(1, { reason: '不接' });
    await api.completeCampusServiceOrder(1);
    await api.cancelCampusServiceOrder(1, { reason: '取消' });
    await api.fetchCampusServiceOrders({ status: 'PENDING' as any });

    expect(mocks.apiClient.post).toHaveBeenCalledWith('/products', { title: '键盘' });
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/orders', { params: { page: 1, pageSize: 10 } });
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/orders/8');
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/orders', { productId: 8 });
    expect(mocks.apiClient.patch).toHaveBeenCalledWith('/orders/8/meetup', { meetupLocation: '图书馆', note: '今晚' });
    expect(mocks.apiClient.patch).toHaveBeenCalledWith('/orders/8/cancel', { reason: '取消' });
    expect(mocks.apiClient.patch).toHaveBeenCalledWith('/orders/8/complete', {});
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/orders/8/reviews', { rating: 5, content: '很好' });
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/orders/8/appeals', { issueType: 'FAKE', reason: '有问题' });
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/messages/conversations');
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/messages/conversations', { productId: 8 });
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/messages/conversations/3');
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/messages/conversations/3', { content: '你好' });
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/admin/overview');
    expect(mocks.apiClient.patch).toHaveBeenCalledWith('/admin/products/1/status', { status: 'OFFLINE', reason: '违规' });
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/admin/products/1/preview');
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/admin/orders');
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/admin/order-appeals');
    expect(mocks.apiClient.patch).toHaveBeenCalledWith('/admin/orders/1/status', { status: 'CANCELED', reason: '处理' });
    expect(mocks.apiClient.patch).toHaveBeenCalledWith('/admin/order-appeals/1/resolve', { nextStatus: 'RESOLVED', resolutionNote: '已处理', penaltyLevel: 'NORMAL' });
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/admin/campus-services');
    expect(mocks.apiClient.patch).toHaveBeenCalledWith('/admin/campus-services/1/status', { action: 'PAUSE', reason: '暂停' });
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/admin/campus-services/1/preview');
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/users/1/trust-summary');
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/users/1/reviews');
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/users/1/profile');
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/credit-center/summary');
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/credit-center/check-in', {});
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/credit-center/missions');
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/credit-center/missions/DAILY_SIGNIN/claim', {});
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/credit-center/ledger');
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/credit-center/rewards');
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/credit-center/rewards/PROFILE_FRAME_BLUE/redeem', { note: '备注' });
    expect(mocks.apiClient.patch).toHaveBeenCalledWith('/users/1/profile', expect.objectContaining({ displayName: '张三' }));
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/media/images', expect.any(FormData), { headers: { 'Content-Type': 'multipart/form-data' } });
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/media/messages', expect.any(FormData), { headers: { 'Content-Type': 'multipart/form-data' } });
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/users/moderation/list', { params: { page: 1, pageSize: 20, keyword: '张三' } });
    expect(mocks.apiClient.patch).toHaveBeenCalledWith('/users/1/ban-status', { banned: true, reason: '违规' });
    expect(mocks.apiClient.patch).toHaveBeenCalledWith('/users/1/verification-status', { status: 'APPROVED', reason: '通过' });
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/reports', { productId: 1, reason: '举报' });
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/campus-service-favorites/1');
    expect(mocks.apiClient.delete).toHaveBeenCalledWith('/campus-service-favorites/1');
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/reports');
    expect(mocks.apiClient.patch).toHaveBeenCalledWith('/reports/1/resolve', { resolutionNote: '已处理', nextStatus: 'RESOLVED', penaltyLevel: 'NORMAL' });
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/reports/logs');
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/campus-services', {
      params: { intent: 'REQUEST', categories: ['ERRAND'], page: 1, pageSize: 12 },
      paramsSerializer: { indexes: null }
    });
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/campus-services/1');
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/campus-services', { title: '代取快递' });
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/campus-services/1/orders', { initialMessage: '我来接' });
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/campus-services/1/pause', {});
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/campus-services/1/reopen', {});
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/campus-services/1/end', { reason: '结束' });
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/campus-services/1/complete', {});
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/campus-services/1/cancel', { reason: '取消' });
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/campus-service-orders/1/confirm', {});
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/campus-service-orders/1');
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/campus-service-orders/1/reject', { reason: '不接' });
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/campus-service-orders/1/complete', {});
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/campus-service-orders/1/cancel', { reason: '取消' });
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/campus-service-orders', { params: { status: 'PENDING' } });
  });
});
