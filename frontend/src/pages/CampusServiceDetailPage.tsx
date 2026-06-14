import { StarFilled, StarOutlined } from '@ant-design/icons';
import FlipClockCountdown from '@leenguyen/react-flip-clock-countdown';
import { Button, Form, Input, Modal, Skeleton, Alert, message as antMessage } from 'antd';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DetailShell } from '../components/layout';
import {
  ConfirmReasonModal,
  DetailContentBody,
  DetailActionFooter,
  DetailInfoPanel,
  DetailMediaGallery,
  DetailInfoTopSummary,
  DetailSellerStrip,
  FormActionModal,
  ReportFormModal,
  type ReportFormValues
} from '../components/ui';
import {
  CampusServicePublisherOrderWorkbench,
  ListingDetailMetaPanel,
  ListingDetailTagPanel
} from '../components/listing';
import { type AvatarFrameKey } from '../components/user/UserAvatar';
import {
  acceptCampusServiceListing,
  addCampusServiceFavorite,
  cancelCampusServiceListing,
  cancelCampusServiceOrder,
  completeCampusServiceOrder,
  createReport,
  fetchUserTrustSummary,
  type CampusServiceOrderListItem,
  confirmCampusServiceOrder,
  endCampusServiceListing,
  fetchCampusServiceDetail,
  getApiErrorMessage,
  pauseCampusServiceListing,
  reopenCampusServiceListing,
  rejectCampusServiceOrder,
  removeCampusServiceFavorite,
  type CampusServiceDetailView
} from '../services/api';
import { useAuthState } from '../services/auth-state';
import { hasTradingAccess, isGuestUser } from '../services/session';
import { executeCampusServiceOrderAction, getCampusServiceOrderRequestLabel } from '../utils/campusServiceOrderActions';
import { executeToggleFollow } from '../utils/followActions';
import { loadFollowStateForTarget } from '../utils/followState';
import { resolveProductGallery } from '../utils/productCover';
import { openReportForm, submitReportForm } from '../utils/reportForm';
import { ensureTradingAccessOrNotify } from '../utils/tradingAccess';
import { getUserPresentation } from '../utils/userPresentation';

const reportTypeOptions = [
  '服务描述与实际不符',
  '疑似诈骗或诱导站外交易',
  '违禁或不适合校园服务',
  '发布者辱骂骚扰',
  '盗图或冒用他人信息',
  '其他问题'
];

function getCancelContext(listing: CampusServiceDetailView | null) {
  const fallback = {
    title: '结束服务',
    okText: '确认取消',
    success: '已取消'
  };

  if (!listing) {
    return fallback;
  }

  if (listing.actionState.canReject) {
    return {
      title: listing.actionLabels.reject ?? '拒绝申请',
      okText: listing.actionLabels.reject ?? '确认拒绝',
      success: '已拒绝'
    };
  }

  if (listing.actionState.isParticipant) {
    return {
      title: listing.intent === 'REQUEST' ? '退出接单' : '取消预约',
      okText: '确认退出',
      success: listing.intent === 'REQUEST' ? '已退出接单，服务已重新开放' : '已取消预约'
    };
  }

  if (listing.actionState.isPublisher && listing.status === 'OPEN') {
    return {
      title: listing.actionLabels.cancel ?? '关闭发布',
      okText: listing.actionLabels.cancel ?? '确认关闭',
      success: listing.intent === 'REQUEST' ? '已取消当前接单' : '已取消当前预约'
    };
  }

  if (listing.actionState.canEnd) {
    return {
      title: listing.actionLabels.end ?? '结束当前发布',
      okText: listing.actionLabels.end ?? '确认结束',
      success: '已结束当前发布'
    };
  }

  return fallback;
}

export function CampusServiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const listingId = Number(id);
  const [listing, setListing] = useState<CampusServiceDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingListingId, setActingListingId] = useState<number | null>(null);
  const [actingOrderId, setActingOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [acceptMessage, setAcceptMessage] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [orderCancelOpen, setOrderCancelOpen] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [orderCancelTarget, setOrderCancelTarget] = useState<CampusServiceOrderListItem | null>(null);
  const [publisherWorkbenchReloadVersion, setPublisherWorkbenchReloadVersion] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState<'accept' | 'report' | 'follow' | 'favorite' | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [sellerFollowing, setSellerFollowing] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [favoriteAnimating, setFavoriteAnimating] = useState(false);
  const [reportForm] = Form.useForm<ReportFormValues>();

  async function loadListing() {
    setLoading(true);
    try {
      const result = await fetchCampusServiceDetail(listingId);
      setListing(result);
      setActiveImage(0);
      setMessage(null);
    } catch (error) {
      setListing(null);
      setMessage({
        type: 'error',
        text: getApiErrorMessage(error, '校园服务加载失败，请确认 Docker 后端已启动。')
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(listingId)) {
      setLoading(false);
      setListing(null);
      return;
    }
    void loadListing();
  }, [currentUser, listingId]);

  useEffect(() => {
    let cancelled = false;

    async function loadFollowState() {
      await loadFollowStateForTarget({
        currentUser,
        targetUserId: listing?.publisher.id,
        reset: () => setSellerFollowing(false),
        apply: (isFollowing) => {
          if (!cancelled) {
            setSellerFollowing(isFollowing);
          }
        }
      });
    }

    void loadFollowState();
    return () => {
      cancelled = true;
    };
  }, [listing, currentUser]);

  function ensureTradingAccess(actionLabel: string) {
    return ensureTradingAccessOrNotify({
      currentUser,
      actionLabel,
      navigate,
      notifyError: (text) => antMessage.error(text)
    });
  }

  async function handleToggleFollow() {
    if (!listing) {
      return;
    }

    if (!ensureTradingAccess('关注发布者')) {
      return;
    }

    setSubmitting('follow');
    await executeToggleFollow({
      targetUserId: listing.publisher.id,
      isFollowing: sellerFollowing,
      setPending: setFollowPending,
      onSuccess: (result) => setSellerFollowing(result.isFollowing),
      notifySuccess: (text) => antMessage.success(text),
      notifyError: (text) => antMessage.error(text),
      successMessage: {
        follow: '已关注发布者',
        unfollow: '已取消关注'
      },
      onFinally: () => setSubmitting(null)
    });
  }

  function openReportModal() {
    if (!listing) {
      return;
    }

    if (!ensureTradingAccess('举报')) {
      return;
    }

    openReportForm({
      form: reportForm,
      currentUser,
      defaultType: reportTypeOptions[0],
      open: () => setReportOpen(true)
    });
  }

  async function handleReportSubmit() {
    if (!listing || !currentUser) {
      return;
    }

    setSubmitting('report');
    try {
      await submitReportForm({
        form: reportForm,
        currentUser,
        submit: (reason) => createReport({
          campusServiceListingId: listing.id,
          targetUserId: listing.publisher.id,
          reason
        }),
        onSuccess: () => {
          setReportOpen(false);
          antMessage.success('举报已提交');
        }
      });
    } catch (error) {
      antMessage.error(getApiErrorMessage(error, '举报提交失败'));
    } finally {
      setSubmitting(null);
    }
  }

  function handleOpenConversation() {
    if (!listing?.conversationId) {
      return;
    }

    void navigate(`/messages?conversationId=${listing.conversationId}`);
  }

  async function handleToggleFavorite() {
    if (!listing) {
      return;
    }

    if (!ensureTradingAccess('收藏')) {
      return;
    }

    setSubmitting('favorite');
    setFavoriteAnimating(false);

    try {
      const result = listing.isFavorited
        ? await removeCampusServiceFavorite(listing.id)
        : await addCampusServiceFavorite(listing.id);

      setListing((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          isFavorited: result.isFavorited,
          stats: {
            ...current.stats,
            favoriteCount: result.favoriteCount
          }
        };
      });

      if (result.isFavorited) {
        setFavoriteAnimating(true);
        window.setTimeout(() => setFavoriteAnimating(false), 520);
      }

      antMessage.success(result.isFavorited ? '已加入收藏' : '已取消收藏');
    } catch (error) {
      antMessage.error(getApiErrorMessage(error, '收藏操作失败'));
    } finally {
      setSubmitting(null);
    }
  }

  async function handleAcceptConfirm() {
    if (!listing) {
      return;
    }

    if (!hasTradingAccess(currentUser)) {
      antMessage.error(
        isGuestUser(currentUser)
          ? (listing.intent === 'REQUEST' ? '浏览账号不能报名接单。' : '浏览账号不能预约服务。')
          : (listing.intent === 'REQUEST' ? '请先登录普通用户账号后再报名接单。' : '请先登录普通用户账号后再预约服务。')
      );
      return;
    }

    setActingListingId(listing.id);
    setSubmitting('accept');
    try {
      await acceptCampusServiceListing(listing.id, {
        initialMessage: acceptMessage.trim() || undefined
      });
      setAcceptOpen(false);
      setAcceptMessage('');
      await loadListing();
      setPublisherWorkbenchReloadVersion((value) => value + 1);
      setMessage({
        type: 'success',
        text: `你已${listing.intent === 'REQUEST' ? '报名“' : '预约“'}${listing.title}”，消息会话已建立。`
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: getApiErrorMessage(error, listing.intent === 'REQUEST' ? '报名接单失败，请稍后重试。' : '预约服务失败，请稍后重试。')
      });
    } finally {
      setActingListingId(null);
      setSubmitting(null);
    }
  }

  function handleStartCheckout() {
    if (!listing) {
      return;
    }

    if (!ensureTradingAccess(listing.intent === 'REQUEST' ? '接单' : '预约')) {
      return;
    }

    void navigate(`/orders/checkout?type=service&serviceId=${listing.id}`);
  }

  async function handleCancelConfirm() {
    if (!listing) {
      return;
    }

    setActingListingId(listing.id);
    try {
      if (listing.actionState.canReject && listing.actionOrderId) {
        await rejectCampusServiceOrder(listing.actionOrderId, {
          reason: cancelReason.trim() || undefined
        });
      } else if (listing.actionState.isParticipant && listing.actionOrderId) {
        await cancelCampusServiceOrder(listing.actionOrderId, {
          reason: cancelReason.trim() || undefined
        });
      } else if (listing.actionState.canEnd && !listing.actionState.canCancel) {
        await endCampusServiceListing(listing.id, {
          reason: cancelReason.trim() || undefined
        });
      } else {
        await cancelCampusServiceListing(listing.id, {
          reason: cancelReason.trim() || undefined
        });
      }
      setCancelOpen(false);
      setCancelReason('');
      await loadListing();
      setPublisherWorkbenchReloadVersion((value) => value + 1);
      setMessage({ type: 'success', text: `“${listing.title}”${getCancelContext(listing).success}。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '取消协作失败，请稍后重试。') });
    } finally {
      setActingListingId(null);
    }
  }

  async function handlePause() {
    if (!listing) {
      return;
    }

    setActingListingId(listing.id);
    try {
      await pauseCampusServiceListing(listing.id);
      await loadListing();
      setPublisherWorkbenchReloadVersion((value) => value + 1);
      setMessage({ type: 'success', text: `“${listing.title}”已暂停开放新申请。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '暂停失败，请稍后重试。') });
    } finally {
      setActingListingId(null);
    }
  }

  async function handleReopen() {
    if (!listing) {
      return;
    }

    setActingListingId(listing.id);
    try {
      await reopenCampusServiceListing(listing.id);
      await loadListing();
      setPublisherWorkbenchReloadVersion((value) => value + 1);
      setMessage({ type: 'success', text: `“${listing.title}”已重新开放。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '重新开放失败，请稍后重试。') });
    } finally {
      setActingListingId(null);
    }
  }

  async function handleConfirmOrder() {
    if (!listing?.actionOrderId) {
      return;
    }

    setActingListingId(listing.id);
    await executeCampusServiceOrderAction({
      run: () => confirmCampusServiceOrder(listing.actionOrderId!),
      onSuccess: async () => {
        await loadListing();
        setPublisherWorkbenchReloadVersion((value) => value + 1);
      },
      onFinally: () => setActingListingId(null),
      notifySuccess: (text) => setMessage({ type: 'success', text }),
      notifyError: (text) => setMessage({ type: 'error', text }),
      successMessage: `已确认“${listing.title}”的${listing.intent === 'REQUEST' ? '接单申请' : '预约申请'}。`,
      fallbackErrorMessage: '确认申请失败，请稍后重试。'
    });
  }

  async function handleComplete() {
    if (!listing?.actionOrderId) {
      return;
    }

    setActingListingId(listing.id);
    await executeCampusServiceOrderAction({
      run: () => completeCampusServiceOrder(listing.actionOrderId!),
      onSuccess: async () => {
        await loadListing();
        setPublisherWorkbenchReloadVersion((value) => value + 1);
      },
      onFinally: () => setActingListingId(null),
      notifySuccess: (text) => setMessage({ type: 'success', text }),
      notifyError: (text) => setMessage({ type: 'error', text }),
      successMessage: `“${listing.title}”已标记完成。`,
      fallbackErrorMessage: '标记完成失败，请稍后重试。'
    });
  }

  async function handleOrderConfirm(order: CampusServiceOrderListItem) {
    setActingOrderId(order.id);
    await executeCampusServiceOrderAction({
      run: () => confirmCampusServiceOrder(order.id),
      onSuccess: async () => {
        await loadListing();
        setPublisherWorkbenchReloadVersion((value) => value + 1);
      },
      onFinally: () => setActingOrderId(null),
      notifySuccess: (text) => setMessage({ type: 'success', text }),
      notifyError: (text) => setMessage({ type: 'error', text }),
      successMessage: `已确认“${order.title}”的${getCampusServiceOrderRequestLabel(order)}。`,
      fallbackErrorMessage: '确认申请失败，请稍后重试。'
    });
  }

  async function handleOrderReject(order: CampusServiceOrderListItem) {
    setActingOrderId(order.id);
    await executeCampusServiceOrderAction({
      run: () => rejectCampusServiceOrder(order.id, {
        reason: cancelReason.trim() || undefined
      }),
      onSuccess: async () => {
        setCancelReason('');
        setOrderCancelOpen(false);
        setOrderCancelTarget(null);
        await loadListing();
        setPublisherWorkbenchReloadVersion((value) => value + 1);
      },
      onFinally: () => setActingOrderId(null),
      notifySuccess: (text) => setMessage({ type: 'success', text }),
      notifyError: (text) => setMessage({ type: 'error', text }),
      successMessage: `已拒绝“${order.title}”的服务申请。`,
      fallbackErrorMessage: '拒绝申请失败，请稍后重试。'
    });
  }

  async function handleOrderComplete(order: CampusServiceOrderListItem) {
    setActingOrderId(order.id);
    await executeCampusServiceOrderAction({
      run: () => completeCampusServiceOrder(order.id),
      onSuccess: async () => {
        await loadListing();
        setPublisherWorkbenchReloadVersion((value) => value + 1);
      },
      onFinally: () => setActingOrderId(null),
      notifySuccess: (text) => setMessage({ type: 'success', text }),
      notifyError: (text) => setMessage({ type: 'error', text }),
      successMessage: `“${order.title}”已更新为最新进度。`,
      fallbackErrorMessage: '更新协作进度失败，请稍后重试。'
    });
  }

  async function handleOrderCancel(order: CampusServiceOrderListItem) {
    setActingOrderId(order.id);
    await executeCampusServiceOrderAction({
      run: () => cancelCampusServiceOrder(order.id, {
        reason: cancelReason.trim() || undefined
      }),
      onSuccess: async () => {
        setCancelReason('');
        setOrderCancelOpen(false);
        setOrderCancelTarget(null);
        await loadListing();
        setPublisherWorkbenchReloadVersion((value) => value + 1);
      },
      onFinally: () => setActingOrderId(null),
      notifySuccess: (text) => setMessage({ type: 'success', text }),
      notifyError: (text) => setMessage({ type: 'error', text }),
      successMessage: `“${order.title}”已取消。`,
      fallbackErrorMessage: '取消协作失败，请稍后重试。'
    });
  }

  const cancelContext = useMemo(() => getCancelContext(listing), [listing]);
  const publisherPresentation = listing ? getUserPresentation(listing.publisher) : null;

  if (loading) {
    return <Skeleton active paragraph={{ rows: 14 }} />;
  }

  if (!listing) {
    return (
      <div className="page-grid">
        <section className="hero-panel">
          <div className="hero-chip-row">
            <span className="hero-chip">校园服务</span>
            <span className="hero-chip">同校协作</span>
          </div>
          <h1 className="hero-title">服务不存在</h1>
        </section>
      </div>
    );
  }

  const detailImages = resolveProductGallery({
    title: listing.title,
    category: listing.categoryLabel,
    price: listing.reward,
    imageUrl: listing.imageUrl,
    images: listing.images ?? listing.detailBase.images,
    sellerName: listing.publisher.displayName
  }, listing.id, 6);
  const sellerStats = [
    publisherPresentation?.collegeLabel ?? '同校用户',
    `信用 ${listing.publisher.creditScore}`,
    listing.intentLabel
  ];
  const primaryActionLabel = listing.intent === 'REQUEST' ? '报名接单' : '立即预约';
  const detailDescription = listing.detailBase.description;
  const deadlineDate = new Date(listing.fulfillment.validUntilAt);
  const deadlineValid = !Number.isNaN(deadlineDate.getTime());
  const deadlineExpired = deadlineValid && deadlineDate.getTime() <= Date.now();
  const compactMetaItems = listing.detailBase.metaItems.filter((item) => ![
    'intent',
    'route',
    'deadline',
    'fulfillment',
    'capacity',
    'publisher',
    'trust-note'
  ].includes(item.key));

  return (
    <div className="detail-page">
      {message ? <Alert type={message.type} showIcon message={message.text} closable onClose={() => setMessage(null)} /> : null}

      <DetailSellerStrip
        userId={listing.publisher.id}
        name={listing.publisher.displayName}
        avatarUrl={listing.publisher.avatarUrl}
        avatarFrame={(listing.publisher.avatarFrame as AvatarFrameKey | null) ?? undefined}
        trustedBadgeUnlocked={publisherPresentation?.trustedBadgeUnlocked}
        creditTone={publisherPresentation?.creditBadge.tone ?? 'stable'}
        creditLabel={publisherPresentation?.creditBadge.label ?? '信用稳定'}
        stats={sellerStats}
        followButton={currentUser?.id !== listing.publisher.id ? (
          <button
            type="button"
            className={`detail-seller-follow${sellerFollowing ? ' is-following' : ''}`}
            onClick={() => void handleToggleFollow()}
            disabled={followPending}
          >
            {sellerFollowing ? '已关注' : '关注'}
          </button>
        ) : undefined}
      />

      <DetailShell
        className="service-detail-shell"
        mainMedia={(
          <DetailMediaGallery
            images={detailImages}
            activeIndex={activeImage}
            onSelect={setActiveImage}
            title={listing.title}
            galleryKey={listing.id}
          />
        )}
        sidePanel={(
          <DetailInfoPanel
            top={(
              <DetailInfoTopSummary
                stats={[
                  `${listing.stats.wantCount} 人想要`,
                  `${listing.stats.favoriteCount} 收藏`,
                  `${listing.stats.viewCount} 浏览`
                ]}
                favoriteButton={(
                  <button
                    type="button"
                    aria-label={listing.isFavorited ? '取消收藏' : '收藏服务'}
                    className={[
                      'detail-favorite-star',
                      listing.isFavorited ? 'active' : '',
                      favoriteAnimating ? 'is-popping' : ''
                    ].filter(Boolean).join(' ')}
                    onClick={() => void handleToggleFavorite()}
                    disabled={submitting === 'favorite'}
                  >
                    {listing.isFavorited ? <StarFilled /> : <StarOutlined />}
                  </button>
                )}
                amount={<strong>{listing.detailBase.amountLabel}</strong>}
              />
            )}
            body={(
              <DetailContentBody
                title={listing.detailBase.title}
                description={detailDescription}
              />
            )}
            footer={(
              <DetailActionFooter
                actions={(
                  <>
                    <Button type="primary" size="large" onClick={handleOpenConversation}>
                      聊一聊
                    </Button>
                    <Button
                      size="large"
                      onClick={() => {
                        if (listing.actionState.canAccept) {
                          handleStartCheckout();
                          return;
                        }
                        if (listing.actionState.canConfirm) {
                          void handleConfirmOrder();
                          return;
                        }
                        if (listing.actionState.canComplete) {
                          void handleComplete();
                          return;
                        }
                        if (listing.actionState.canOpenConversation) {
                          handleOpenConversation();
                        } else {
                          antMessage.info(listing.intent === 'REQUEST' ? '当前求助暂时不可报名接单' : '当前服务暂时不可预约');
                        }
                      }}
                      loading={actingListingId === listing.id && submitting === 'accept'}
                    >
                      {listing.actionState.canAccept
                        ? primaryActionLabel
                        : listing.actionState.canConfirm
                          ? (listing.actionLabels.confirm ?? '确认')
                          : listing.actionState.canComplete
                            ? (listing.actionLabels.complete ?? '提交进度')
                            : primaryActionLabel}
                    </Button>
                  </>
                )}
                quietAction={(
                  <button type="button" className="detail-quiet-action warn" onClick={openReportModal}>
                    {submitting === 'report' ? '提交中...' : '举报'}
                  </button>
                )}
              />
            )}
          />
        )}
        bottomContent={(
          <div className="service-detail-bottom-stack">
            <ListingDetailMetaPanel
              detail={{
                ...listing.detailBase,
                metaItems: compactMetaItems
              }}
            />

            <div className="service-detail-summary-grid">
              <section className="service-detail-summary-card is-deadline">
                <div className="service-detail-summary-head">
                  <span>有效期</span>
                  <strong>{deadlineExpired ? `${listing.deadlineLabel} · 已过期` : listing.deadlineLabel}</strong>
                </div>
                <div className="service-detail-deadline-clock">
                  {deadlineValid ? (
                    deadlineExpired ? (
                      <strong className="service-detail-summary-fallback is-expired">已过期</strong>
                    ) : (
                      <FlipClockCountdown
                        to={deadlineDate.getTime()}
                        labels={['天', '时', '分', '秒']}
                        showLabels
                        showSeparators={false}
                        digitBlockStyle={{
                          width: 38,
                          height: 50,
                          fontSize: 24,
                          fontWeight: 700,
                          borderRadius: 10,
                          background: '#111827',
                          color: '#f9fafb'
                        }}
                        labelStyle={{
                          marginTop: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#6b7280'
                        }}
                        spacing={{ clock: 8, digitBlock: 4 }}
                      />
                    )
                  ) : (
                    <strong className="service-detail-summary-fallback">时间无效</strong>
                  )}
                </div>
              </section>

              <section className="service-detail-summary-card">
                <div className="service-detail-summary-head">
                  <span>容量</span>
                </div>
                <div className="service-detail-capacity-signals">
                  <div className="service-detail-capacity-item">
                    <span>进行中</span>
                    <strong>{listing.fulfillment.activeOrderCount}</strong>
                  </div>
                  <div className="service-detail-capacity-item">
                    <span>总计</span>
                    <strong>{listing.fulfillment.totalOrderCount}</strong>
                  </div>
                  <div className="service-detail-capacity-item">
                    <span>上限</span>
                    <strong>{listing.fulfillment.maxTotalOrders ?? '不限'}</strong>
                  </div>
                </div>
              </section>
            </div>

            <div className="service-detail-actions">
              <Button onClick={() => navigate('/campus-services')}>返回列表</Button>
              {listing.actionState.canPause ? <Button onClick={() => void handlePause()} loading={actingListingId === listing.id}>{listing.actionLabels.pause ?? '暂停开放'}</Button> : null}
              {listing.actionState.canReopen ? <Button onClick={() => void handleReopen()} loading={actingListingId === listing.id}>{listing.actionLabels.reopen ?? '重新开放'}</Button> : null}
              {listing.actionState.canEnd ? <Button danger onClick={() => setCancelOpen(true)}>{listing.actionLabels.end ?? '结束当前发布'}</Button> : null}
              {listing.actionState.canCancel ? <Button danger onClick={() => setCancelOpen(true)}>{listing.actionLabels.cancel ?? '取消'}</Button> : null}
              {listing.actionState.canReject ? <Button danger onClick={() => setCancelOpen(true)}>{listing.actionLabels.reject ?? '拒绝'}</Button> : null}
            </div>

            {listing.actionState.isPublisher ? (
              <CampusServicePublisherOrderWorkbench
                listing={listing}
                reloadVersion={publisherWorkbenchReloadVersion}
                onError={(nextMessage) => setMessage({ type: 'error', text: nextMessage })}
                onConfirmOrder={(order) => void handleOrderConfirm(order)}
                onRejectOrder={(order) => {
                  setOrderCancelTarget(order);
                  setOrderCancelOpen(true);
                }}
                onCompleteOrder={(order) => void handleOrderComplete(order)}
                onCancelOrder={(order) => {
                  setOrderCancelTarget(order);
                  setOrderCancelOpen(true);
                }}
                actingOrderId={actingOrderId}
              />
            ) : null}
          </div>
        )}
      />

      <FormActionModal
        open={acceptOpen}
        title={listing?.actionLabels.accept ?? '处理服务'}
        onCancel={() => {
          setAcceptOpen(false);
          setAcceptMessage('');
        }}
        onSubmit={() => void handleAcceptConfirm()}
        okText={listing?.actionLabels.accept ?? '确认'}
        loading={listing ? actingListingId === listing.id : false}
      >
        <Input.TextArea rows={4} value={acceptMessage} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setAcceptMessage(event.target.value)} />
      </FormActionModal>

      <ConfirmReasonModal
        open={cancelOpen}
        title={cancelContext.title}
        onCancel={() => {
          setCancelOpen(false);
          setCancelReason('');
        }}
        onConfirm={() => void handleCancelConfirm()}
        confirmText={listing?.actionState.canReject ? (listing.actionLabels.reject ?? '确认拒绝') : cancelContext.okText}
        danger
        loading={listing ? actingListingId === listing.id : false}
        reason={cancelReason}
        onReasonChange={setCancelReason}
      />

      <ConfirmReasonModal
        open={orderCancelOpen}
        title={orderCancelTarget?.actionState.canReject ? (orderCancelTarget.actionLabels.reject ?? '拒绝申请') : (orderCancelTarget?.actionLabels.cancel ?? '取消当前协作')}
        onCancel={() => {
          setOrderCancelOpen(false);
          setOrderCancelTarget(null);
          setCancelReason('');
        }}
        onConfirm={() => {
          if (!orderCancelTarget) {
            return;
          }
          void (orderCancelTarget.actionState.canReject ? handleOrderReject(orderCancelTarget) : handleOrderCancel(orderCancelTarget));
        }}
        confirmText={orderCancelTarget?.actionState.canReject ? (orderCancelTarget.actionLabels.reject ?? '确认拒绝') : (orderCancelTarget?.actionLabels.cancel ?? '确认取消')}
        danger
        loading={orderCancelTarget ? actingOrderId === orderCancelTarget.id : false}
        reason={cancelReason}
        onReasonChange={setCancelReason}
      />

      <ReportFormModal
        open={reportOpen}
        onCancel={() => setReportOpen(false)}
        onSubmit={() => void handleReportSubmit()}
        loading={submitting === 'report'}
        typeOptions={reportTypeOptions}
        realNameAvailable={currentUser?.verificationStatus === 'APPROVED'}
        form={reportForm}
      />
    </div>
  );
}
