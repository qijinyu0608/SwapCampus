import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCT_CATEGORY_NAMES, isProductCategoryName, normalizeProductCategoryName } from '../constants/productCategories';
import { formatProductConditionValue, parseProductConditionValue, PRODUCT_CONDITION_MAX } from '../constants/productConditions';
import {
  executeCampusServiceOrderAction,
  getCampusServiceOrderRejectOrCancelText,
  getCampusServiceOrderRequestLabel
} from './campusServiceOrderActions';
import { executeToggleFollow } from './followActions';
import { loadFollowStateForTarget } from './followState';
import { getListingStatusPresentation } from './listingStatus';
import { formatCurrencyAmount } from './price';
import {
  formatProductOrderStatus,
  getCampusServiceOrderStatusColor,
  getProductOrderStatusColor
} from './orderStatus';
import {
  buildProductCover,
  DEMO_PRODUCT_IMAGE,
  getProductImage,
  resolvePrimaryProductImage,
  resolveProductGallery
} from './productCover';
import { buildReportReason, openReportForm, submitReportForm } from './reportForm';
import { ensureTradingAccessOrNotify } from './tradingAccess';
import {
  getPublicIdentityLabel,
  getUserCollegeLabel,
  getUserCreditBadge,
  getUserDisplayName,
  getUserEmailLabel,
  getUserInitial,
  getUserPresentation,
  getVerificationLabel
} from './userPresentation';

vi.mock('../services/api', () => ({
  followUser: vi.fn(async () => ({ isFollowing: true })),
  unfollowUser: vi.fn(async () => ({ isFollowing: false })),
  fetchUserTrustSummary: vi.fn(async () => ({ isFollowing: true })),
  getApiErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback)
}));

describe('frontend utility coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('formats currency and product order statuses', () => {
    expect(formatCurrencyAmount(12)).toBe('¥12.00');
    expect(formatProductOrderStatus('PENDING')).toBe('待协商');
    expect(formatProductOrderStatus('UNKNOWN')).toBe('UNKNOWN');
    expect(getProductOrderStatusColor('COMPLETED')).toBe('green');
    expect(getProductOrderStatusColor('WAITING_REVIEW')).toBe('gold');
    expect(getProductOrderStatusColor('CANCELED')).toBe('default');
    expect(getProductOrderStatusColor('PENDING')).toBe('orange');
    expect(getCampusServiceOrderStatusColor('COMPLETED')).toBe('green');
    expect(getCampusServiceOrderStatusColor('WAITING_COMPLETE_CONFIRM')).toBe('gold');
    expect(getCampusServiceOrderStatusColor('REJECTED')).toBe('default');
    expect(getCampusServiceOrderStatusColor('CONFIRMED')).toBe('blue');
    expect(getCampusServiceOrderStatusColor('PENDING_CONFIRMATION')).toBe('orange');
  });

  it('formats and parses product condition labels', () => {
    expect(formatProductConditionValue(8)).toBe('八成');
    expect(formatProductConditionValue(8.6)).toBe('八六成');
    expect(formatProductConditionValue(PRODUCT_CONDITION_MAX)).toBe('全新');
    expect(parseProductConditionValue('全新')).toBe(10);
    expect(parseProductConditionValue('八点五成新')).toBe(8.5);
    expect(parseProductConditionValue('八五新')).toBe(8.5);
    expect(parseProductConditionValue('八五成')).toBe(8.5);
    expect(parseProductConditionValue('十成')).toBe(10);
    expect(parseProductConditionValue('8.5成新')).toBe(8.5);
    expect(parseProductConditionValue('85新')).toBe(8.5);
    expect(parseProductConditionValue('无效')).toBeNull();
  });

  it('normalizes category names and listing labels', () => {
    expect(PRODUCT_CATEGORY_NAMES).toContain('数码电子');
    expect(isProductCategoryName('数码电子')).toBe(true);
    expect(isProductCategoryName('未知')).toBe(false);
    expect(normalizeProductCategoryName('未知')).toBe('其他');
    expect(getListingStatusPresentation('ON_SALE')).toEqual({ label: '在售', tone: 'success' });
    expect(getListingStatusPresentation('UNKNOWN', '自定义')).toEqual({ label: '自定义', tone: 'default' });
  });

  it('builds product covers and resolves image fallbacks', () => {
    const cover = buildProductCover({
      title: 'Apple Watch Series 9',
      category: '数码电子',
      price: 1999,
      condition: '九成新',
      sellerName: '张三'
    });
    expect(cover.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(cover)).toContain('Apple Watc');

    const product = {
      title: '教材',
      category: '教材资料',
      price: 20,
      images: ['http://example.com/a.jpg', '/relative.png', 'data:image/svg+xml,123'],
      imageUrl: 'https://example.com/b.jpg'
    };

    expect(resolvePrimaryProductImage(product, 0)).toBe('http://example.com/a.jpg');
    expect(resolvePrimaryProductImage(product, 1)).toBe('/relative.png');
    expect(resolveProductGallery(product, 1, 3)).toEqual(['http://example.com/a.jpg', '/relative.png', 'https://example.com/b.jpg']);
    expect(getProductImage(product, 2)).toBe('https://example.com/b.jpg');
    expect(resolvePrimaryProductImage({
      title: '空',
      category: '其他',
      price: 0,
      images: [],
      imageUrl: 'data:image/svg+xml,abc'
    })).toBe(DEMO_PRODUCT_IMAGE);
  });

  it('builds report forms and submits validated reports', async () => {
    const setFieldsValue = vi.fn();
    const open = vi.fn();
    openReportForm({
      form: { setFieldsValue },
      currentUser: { verificationStatus: 'APPROVED' },
      defaultType: 'SPAM',
      open
    });
    expect(setFieldsValue).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SPAM',
      identityMode: 'REAL_NAME',
      contactConsent: 'YES'
    }));
    expect(open).toHaveBeenCalledTimes(1);

    const reason = buildReportReason({
      type: 'SPAM',
      identityMode: 'ANONYMOUS',
      contactConsent: 'NO',
      detail: '  违规内容  '
    } as any, { displayName: '李四', studentId: '202600001' });
    expect(reason).toContain('举报类型：SPAM');
    expect(reason).toContain('匿名展示');
    expect(reason).toContain('违规内容');

    const submit = vi.fn(async () => undefined);
    const onSuccess = vi.fn();
    const resetFields = vi.fn();
    const ok = await submitReportForm({
      form: {
        validateFields: vi.fn(async () => ({
          type: 'SPAM',
          identityMode: 'REAL_NAME' as const,
          contactConsent: 'YES' as const,
          detail: '测试'
        })),
        resetFields
      } as any,
      currentUser: { displayName: '王五', studentId: '202600002' },
      submit,
      onSuccess
    });
    expect(ok).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(resetFields).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);

    const failed = await submitReportForm({
      form: {
        validateFields: vi.fn(async () => Promise.reject(new Error('bad'))),
        resetFields: vi.fn()
      },
      submit,
      onSuccess
    });
    expect(failed).toBe(false);
  });

  it('enforces trading access and follow helpers', async () => {
    const navigate = vi.fn();
    const notifyError = vi.fn();
    expect(ensureTradingAccessOrNotify({
      currentUser: null,
      actionLabel: '发布',
      navigate,
      notifyError
    })).toBe(false);
    expect(notifyError).toHaveBeenLastCalledWith('请先登录后再发布');

    expect(ensureTradingAccessOrNotify({
      currentUser: { id: 1, displayName: '游客', role: 'GUEST' } as any,
      actionLabel: '下单',
      navigate,
      notifyError
    })).toBe(false);
    expect(notifyError).toHaveBeenLastCalledWith('浏览账号不可下单');

    expect(ensureTradingAccessOrNotify({
      currentUser: { id: 2, displayName: '管理员', role: 'ADMIN' } as any,
      actionLabel: '交易',
      navigate,
      notifyError
    })).toBe(false);
    expect(notifyError).toHaveBeenLastCalledWith('当前账号不可交易');

    expect(ensureTradingAccessOrNotify({
      currentUser: { id: 3, displayName: '用户', role: 'USER' } as any,
      actionLabel: '交易',
      navigate,
      notifyError
    })).toBe(true);

    const setPending = vi.fn();
    const onSuccess = vi.fn();
    const notifySuccess = vi.fn();
    const onFinally = vi.fn();
    await executeToggleFollow({
      targetUserId: 6,
      isFollowing: false,
      setPending,
      onSuccess,
      notifySuccess,
      notifyError,
      onFinally
    });
    expect(setPending).toHaveBeenCalledWith(true);
    expect(onSuccess).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith('已关注');
    expect(onFinally).toHaveBeenCalledTimes(1);

    await loadFollowStateForTarget({
      currentUser: { id: 9, displayName: '用户', role: 'USER' } as any,
      targetUserId: 10,
      reset: vi.fn(),
      apply: onSuccess
    });
    expect(onSuccess).toHaveBeenCalledWith(true);
  });

  it('skips follow loading for guests or self and handles request labels', async () => {
    const reset = vi.fn();
    const apply = vi.fn();
    await loadFollowStateForTarget({
      currentUser: { id: 9, displayName: '游客', role: 'GUEST' } as any,
      targetUserId: 10,
      reset,
      apply
    });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();

    expect(getCampusServiceOrderRequestLabel({ intent: 'REQUEST' } as any)).toBe('接单申请');
    expect(getCampusServiceOrderRequestLabel({ intent: 'OFFER' } as any)).toBe('预约申请');
    expect(getCampusServiceOrderRejectOrCancelText({
      actionState: { canReject: true },
      actionLabels: { reject: '驳回', cancel: '取消' }
    } as any)).toEqual({ title: '驳回', confirmText: '驳回' });
    expect(getCampusServiceOrderRejectOrCancelText({
      actionState: { canReject: false },
      actionLabels: { cancel: '结束协作' }
    } as any)).toEqual({ title: '结束协作', confirmText: '结束协作' });
    expect(getCampusServiceOrderRejectOrCancelText({
      actionState: { canReject: true },
      actionLabels: {}
    } as any)).toEqual({ title: '拒绝申请', confirmText: '确认拒绝' });
    expect(getCampusServiceOrderRejectOrCancelText({
      actionState: { canReject: false },
      actionLabels: {}
    } as any)).toEqual({ title: '取消当前协作', confirmText: '确认取消' });
  });

  it('wraps campus service order actions with success, error and finally handlers', async () => {
    const notifySuccess = vi.fn();
    const notifyError = vi.fn();
    const onSuccess = vi.fn(async () => undefined);
    const onFinally = vi.fn();

    await executeCampusServiceOrderAction({
      run: vi.fn(async () => undefined),
      onSuccess,
      onFinally,
      notifySuccess,
      notifyError,
      successMessage: '更新成功',
      fallbackErrorMessage: '更新失败'
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(notifySuccess).toHaveBeenCalledWith('更新成功');
    expect(notifyError).not.toHaveBeenCalled();
    expect(onFinally).toHaveBeenCalledTimes(1);

    const error = new Error('bad');
    await executeCampusServiceOrderAction({
      run: vi.fn(async () => Promise.reject(error)),
      onFinally,
      notifySuccess,
      notifyError,
      successMessage: '不会触发',
      fallbackErrorMessage: '更新失败'
    });

    expect(notifyError).toHaveBeenCalledWith('更新失败');
    expect(onFinally).toHaveBeenCalledTimes(2);
  });

  it('builds user presentation details', () => {
    expect(getUserCreditBadge(95)).toEqual({ label: '信用优秀', score: 95, tone: 'excellent' });
    expect(getUserCreditBadge(80)).toEqual({ label: '信用稳定', score: 80, tone: 'stable' });
    expect(getUserCreditBadge(65)).toEqual({ label: '信用正常', score: 65, tone: 'good' });
    expect(getUserCreditBadge(30)).toEqual({ label: '信用待提升', score: 30, tone: 'low' });
    expect(getVerificationLabel('APPROVED')).toBe('已实名');
    expect(getVerificationLabel('REJECTED')).toBe('认证驳回');
    expect(getVerificationLabel()).toBe('待实名');
    expect(getPublicIdentityLabel('APPROVED')).toBe('实名认证');
    expect(getPublicIdentityLabel('PENDING')).toBeNull();
    expect(getUserDisplayName({ displayName: '  小明  ' } as any)).toBe('小明');
    expect(getUserInitial({ displayName: '张三' } as any)).toBe('张');
    expect(getUserCollegeLabel({ college: '信息学院' } as any)).toBe('信息学院');
    expect(getUserEmailLabel({ email: 'a@b.com' } as any)).toBe('a@b.com');
    expect(getUserPresentation({
      displayName: 'Alice',
      email: 'alice@example.com',
      college: '信息学院',
      creditScore: 88,
      verificationStatus: 'APPROVED',
      avatarFrame: 'gold',
      avatarFrameUnlocked: true,
      trustedBadgeUnlocked: true
    } as any)).toEqual(expect.objectContaining({
      displayName: 'Alice',
      initial: 'A',
      avatarFrame: 'gold',
      trustedBadgeUnlocked: true,
      collegeLabel: '信息学院',
      emailLabel: 'alice@example.com',
      verificationLabel: '已实名',
      publicIdentityLabel: '实名认证'
    }));
  });
});
