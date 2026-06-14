import { StarFilled, StarOutlined } from '@ant-design/icons';
import FlipClockCountdown from '@leenguyen/react-flip-clock-countdown';
import { Button, Form, Input, Modal, Radio, Select, Skeleton, Alert, message as antMessage } from 'antd';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MetaList } from '../components/data-display';
import { DetailShell } from '../components/layout';
import {
  CampusServicePublisherOrderWorkbench,
  ListingDetailMetaPanel,
  ListingDetailTagPanel
} from '../components/listing';
import { UserNameWithBadge } from '../components/user/UserNameWithBadge';
import { type AvatarFrameKey, UserAvatar } from '../components/user/UserAvatar';
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
  followUser,
  getApiErrorMessage,
  pauseCampusServiceListing,
  reopenCampusServiceListing,
  rejectCampusServiceOrder,
  removeCampusServiceFavorite,
  unfollowUser,
  type CampusServiceDetailView
} from '../services/api';
import { useAuthState } from '../services/auth-state';
import { hasTradingAccess, isGuestUser } from '../services/session';
import { resolveProductGallery } from '../utils/productCover';
import { getUserPresentation } from '../utils/userPresentation';

const reportTypeOptions = [
  '服务描述与实际不符',
  '疑似诈骗或诱导站外交易',
  '违禁或不适合校园服务',
  '发布者辱骂骚扰',
  '盗图或冒用他人信息',
  '其他问题'
];

type ReportIdentityMode = 'REAL_NAME' | 'ANONYMOUS';

type ReportFormValues = {
  type: string;
  detail: string;
  identityMode: ReportIdentityMode;
  contactConsent: 'YES' | 'NO';
};

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
      success: listing.actionLabels.cancel === '取消当前服务单' ? '已取消当前服务单' : '已结束发布'
    };
  }

  if (listing.actionState.canEnd) {
    return {
      title: listing.actionLabels.end ?? '结束发布',
      okText: listing.actionLabels.end ?? '确认结束',
      success: '已结束发布'
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
      setSellerFollowing(false);
      if (!listing || !currentUser || isGuestUser(currentUser) || currentUser.id === listing.publisher.id) {
        return;
      }

      try {
        const summary = await fetchUserTrustSummary(listing.publisher.id);
        if (!cancelled) {
          setSellerFollowing(summary.isFollowing);
        }
      } catch {
        // ignore
      }
    }

    void loadFollowState();
    return () => {
      cancelled = true;
    };
  }, [listing, currentUser]);

  function ensureTradingAccess(actionLabel: string) {
    if (!currentUser) {
      antMessage.error(`请先登录后再${actionLabel}`);
      void navigate('/login');
      return false;
    }

    if (isGuestUser(currentUser)) {
      antMessage.error(`浏览账号不可${actionLabel}`);
      void navigate('/login');
      return false;
    }

    if (!hasTradingAccess(currentUser)) {
      antMessage.error(`当前账号不可${actionLabel}`);
      return false;
    }

    return true;
  }

  function buildReportReason(values: ReportFormValues) {
    const activeUser = currentUser;
    const identityLabel = values.identityMode === 'REAL_NAME'
      ? `实名举报（${activeUser?.displayName ?? '未知用户'} / ${activeUser?.studentId || '无学号'}）`
      : '匿名展示（平台保留账号记录用于核查）';
    const contactLabel = values.contactConsent === 'YES' ? '愿意配合管理员补充材料' : '仅提交当前举报信息';

    return [
      `举报类型：${values.type}`,
      `举报方式：${identityLabel}`,
      `是否配合核查：${contactLabel}`,
      `举报说明：${values.detail.trim()}`
    ].join('\n');
  }

  async function handleToggleFollow() {
    if (!listing) {
      return;
    }

    if (!ensureTradingAccess('关注发布者')) {
      return;
    }

    setFollowPending(true);
    setSubmitting('follow');
    try {
      const result = sellerFollowing
        ? await unfollowUser(listing.publisher.id)
        : await followUser(listing.publisher.id);
      setSellerFollowing(result.isFollowing);
      antMessage.success(result.isFollowing ? '已关注发布者' : '已取消关注');
    } catch (error) {
      antMessage.error(getApiErrorMessage(error, '关注操作失败'));
    } finally {
      setFollowPending(false);
      setSubmitting(null);
    }
  }

  function openReportModal() {
    if (!listing) {
      return;
    }

    if (!ensureTradingAccess('举报')) {
      return;
    }

    reportForm.setFieldsValue({
      type: reportTypeOptions[0],
      detail: '',
      identityMode: currentUser?.verificationStatus === 'APPROVED' ? 'REAL_NAME' : 'ANONYMOUS',
      contactConsent: 'YES'
    });
    setReportOpen(true);
  }

  async function handleReportSubmit() {
    if (!listing || !currentUser) {
      return;
    }

    const values = await reportForm.validateFields().catch(() => null);
    if (!values) {
      return;
    }

    setSubmitting('report');
    try {
      await createReport({
        campusServiceListingId: listing.id,
        targetUserId: listing.publisher.id,
        reason: buildReportReason(values)
      });
      reportForm.resetFields();
      setReportOpen(false);
      antMessage.success('举报已提交');
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
      antMessage.error(isGuestUser(currentUser) ? '浏览账号不能接单。' : '请先登录普通用户账号后再接单。');
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
      setMessage({ type: 'success', text: `你已处理“${listing.title}”，消息会话已建立。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '接单失败，请稍后重试。') });
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
      setMessage({ type: 'error', text: getApiErrorMessage(error, '取消任务失败，请稍后重试。') });
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
      setMessage({ type: 'success', text: `“${listing.title}”已暂停接新单。` });
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
    try {
      await confirmCampusServiceOrder(listing.actionOrderId);
      await loadListing();
      setPublisherWorkbenchReloadVersion((value) => value + 1);
      setMessage({ type: 'success', text: `已确认“${listing.title}”的服务单。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '确认服务单失败，请稍后重试。') });
    } finally {
      setActingListingId(null);
    }
  }

  async function handleComplete() {
    if (!listing?.actionOrderId) {
      return;
    }

    setActingListingId(listing.id);
    try {
      await completeCampusServiceOrder(listing.actionOrderId);
      await loadListing();
      setPublisherWorkbenchReloadVersion((value) => value + 1);
      setMessage({ type: 'success', text: `“${listing.title}”已标记完成。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '标记完成失败，请稍后重试。') });
    } finally {
      setActingListingId(null);
    }
  }

  async function handleOrderConfirm(order: CampusServiceOrderListItem) {
    setActingOrderId(order.id);
    try {
      await confirmCampusServiceOrder(order.id);
      await loadListing();
      setPublisherWorkbenchReloadVersion((value) => value + 1);
      setMessage({ type: 'success', text: `已确认“${order.title}”的服务单。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '确认服务单失败，请稍后重试。') });
    } finally {
      setActingOrderId(null);
    }
  }

  async function handleOrderReject(order: CampusServiceOrderListItem) {
    setActingOrderId(order.id);
    try {
      await rejectCampusServiceOrder(order.id, {
        reason: cancelReason.trim() || undefined
      });
      setCancelReason('');
      setOrderCancelOpen(false);
      setOrderCancelTarget(null);
      await loadListing();
      setPublisherWorkbenchReloadVersion((value) => value + 1);
      setMessage({ type: 'success', text: `已拒绝“${order.title}”的服务申请。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '拒绝服务单失败，请稍后重试。') });
    } finally {
      setActingOrderId(null);
    }
  }

  async function handleOrderComplete(order: CampusServiceOrderListItem) {
    setActingOrderId(order.id);
    try {
      await completeCampusServiceOrder(order.id);
      await loadListing();
      setPublisherWorkbenchReloadVersion((value) => value + 1);
      setMessage({ type: 'success', text: `“${order.title}”已更新为最新进度。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '更新服务单失败，请稍后重试。') });
    } finally {
      setActingOrderId(null);
    }
  }

  async function handleOrderCancel(order: CampusServiceOrderListItem) {
    setActingOrderId(order.id);
    try {
      await cancelCampusServiceOrder(order.id, {
        reason: cancelReason.trim() || undefined
      });
      setCancelReason('');
      setOrderCancelOpen(false);
      setOrderCancelTarget(null);
      await loadListing();
      setPublisherWorkbenchReloadVersion((value) => value + 1);
      setMessage({ type: 'success', text: `“${order.title}”已取消。` });
    } catch (error) {
      setMessage({ type: 'error', text: getApiErrorMessage(error, '取消服务单失败，请稍后重试。') });
    } finally {
      setActingOrderId(null);
    }
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
  const currentImage = detailImages[activeImage] ?? detailImages[0];
  const sellerStats = [
    publisherPresentation?.collegeLabel ?? '同校用户',
    `信用 ${listing.publisher.creditScore}`,
    listing.intentLabel
  ];
  const primaryActionLabel = listing.intent === 'REQUEST' ? '立即接单' : '立即预约';
  const detailDescription = listing.detailBase.description;
  const deadlineDate = new Date(listing.fulfillment.validUntilAt);
  const deadlineValid = !Number.isNaN(deadlineDate.getTime());
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

      <section className="detail-seller-strip">
        <Link
          to={`/users/${listing.publisher.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="detail-seller-strip-main detail-seller-link"
          aria-label={`打开${listing.publisher.displayName}的主页`}
        >
          <UserAvatar
            src={listing.publisher.avatarUrl}
            alt={`${listing.publisher.displayName}的头像`}
            fallbackLabel={listing.publisher.displayName}
            className="detail-seller-avatar"
            frame={(listing.publisher.avatarFrame as AvatarFrameKey | null) ?? undefined}
          />
          <div className="detail-seller-strip-copy">
            <div className="detail-seller-strip-title">
              <UserNameWithBadge
                as="strong"
                name={listing.publisher.displayName}
                trustedBadgeUnlocked={publisherPresentation?.trustedBadgeUnlocked}
              />
              {publisherPresentation ? (
                <div className={`ui-credit-badge is-${publisherPresentation.creditBadge.tone}`}>
                  <span className="ui-credit-badge-label">{publisherPresentation.creditBadge.label}</span>
                </div>
              ) : null}
            </div>
            <div className="ui-meta-list detail-seller-strip-meta">
              {sellerStats.map((item, index) => (
                <span key={`${String(item)}-${index}`}>
                  {item}
                  {index < sellerStats.length - 1 ? <i /> : null}
                </span>
              ))}
            </div>
          </div>
        </Link>
        {currentUser?.id !== listing.publisher.id && (
          <button
            type="button"
            className={`detail-seller-follow${sellerFollowing ? ' is-following' : ''}`}
            onClick={() => void handleToggleFollow()}
            disabled={followPending}
          >
            {sellerFollowing ? '已关注' : '关注'}
          </button>
        )}
      </section>

      <DetailShell
        className="service-detail-shell"
        mainMedia={(
          <div className="detail-main-layout-product">
            <div className="detail-thumb-column">
              {detailImages.map((image, index) => (
                <button
                  key={`${listing.id}-${index}`}
                  type="button"
                  className={index === activeImage ? 'detail-thumb active' : 'detail-thumb'}
                  onClick={() => setActiveImage(index)}
                >
                  <img src={image} alt={`${listing.title}-${index + 1}`} />
                </button>
              ))}
            </div>

            <div className="detail-main-photo-shell">
              <img
                className="detail-main-photo"
                src={currentImage}
                alt={listing.title}
              />
            </div>
          </div>
        )}
        sidePanel={(
          <div className="detail-info-panel">
            <div className="detail-info-top">
              <div className="detail-topline">
                <div className="detail-heat-line">
                  <span>{listing.stats.wantCount} 人想要</span>
                  <span>{listing.stats.favoriteCount} 收藏</span>
                  <span>{listing.stats.viewCount} 浏览</span>
                </div>

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
              </div>

              <div className="detail-price-block">
                <div className="listing-detail-amount">
                  <strong>{listing.detailBase.amountLabel}</strong>
                </div>
              </div>
            </div>

            <div className="detail-info-body">
              <h1 className="detail-main-title">{listing.detailBase.title}</h1>
              <div className="detail-description-block">
                <p>{detailDescription}</p>
              </div>
            </div>

            <div className="detail-info-foot">
              <div className="detail-main-actions">
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
                      antMessage.info('当前服务暂时不可接单');
                    }
                  }}
                  loading={actingListingId === listing.id && submitting === 'accept'}
                >
                  {listing.actionState.canAccept
                    ? primaryActionLabel
                    : listing.actionState.canConfirm
                      ? (listing.actionLabels.confirm ?? '确认')
                      : listing.actionState.canComplete
                        ? (listing.actionLabels.complete ?? '提交完成')
                        : primaryActionLabel}
                </Button>
              </div>

              <div className="detail-bottom-line">
                <button type="button" className="detail-quiet-action warn" onClick={openReportModal}>
                  {submitting === 'report' ? '提交中...' : '举报'}
                </button>
              </div>
            </div>
          </div>
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
                  <strong>{listing.deadlineLabel}</strong>
                </div>
                <div className="service-detail-deadline-clock">
                  {deadlineValid ? (
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
              {listing.actionState.canPause ? <Button onClick={() => void handlePause()} loading={actingListingId === listing.id}>{listing.actionLabels.pause ?? '暂停接新单'}</Button> : null}
              {listing.actionState.canReopen ? <Button onClick={() => void handleReopen()} loading={actingListingId === listing.id}>{listing.actionLabels.reopen ?? '重新开放'}</Button> : null}
              {listing.actionState.canEnd ? <Button danger onClick={() => setCancelOpen(true)}>{listing.actionLabels.end ?? '结束发布'}</Button> : null}
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

      <Modal
        open={acceptOpen}
        title={listing?.actionLabels.accept ?? '处理服务'}
        onCancel={() => {
          setAcceptOpen(false);
          setAcceptMessage('');
        }}
        onOk={() => void handleAcceptConfirm()}
        okText={listing?.actionLabels.accept ?? '确认'}
        okButtonProps={{ loading: listing ? actingListingId === listing.id : false }}
      >
        <Input.TextArea rows={4} value={acceptMessage} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setAcceptMessage(event.target.value)} />
      </Modal>

      <Modal
        open={cancelOpen}
        title={cancelContext.title}
        onCancel={() => {
          setCancelOpen(false);
          setCancelReason('');
        }}
        onOk={() => void handleCancelConfirm()}
        okText={listing?.actionState.canReject ? (listing.actionLabels.reject ?? '确认拒绝') : cancelContext.okText}
        okButtonProps={{ danger: true, loading: listing ? actingListingId === listing.id : false }}
      >
        <Input.TextArea rows={4} value={cancelReason} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setCancelReason(event.target.value)} />
      </Modal>

      <Modal
        open={orderCancelOpen}
        title={orderCancelTarget?.actionState.canReject ? (orderCancelTarget.actionLabels.reject ?? '拒绝申请') : (orderCancelTarget?.actionLabels.cancel ?? '取消服务单')}
        onCancel={() => {
          setOrderCancelOpen(false);
          setOrderCancelTarget(null);
          setCancelReason('');
        }}
        onOk={() => {
          if (!orderCancelTarget) {
            return;
          }
          void (orderCancelTarget.actionState.canReject ? handleOrderReject(orderCancelTarget) : handleOrderCancel(orderCancelTarget));
        }}
        okText={orderCancelTarget?.actionState.canReject ? (orderCancelTarget.actionLabels.reject ?? '确认拒绝') : (orderCancelTarget?.actionLabels.cancel ?? '确认取消')}
        okButtonProps={{ danger: true, loading: orderCancelTarget ? actingOrderId === orderCancelTarget.id : false }}
      >
        <Input.TextArea rows={4} value={cancelReason} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setCancelReason(event.target.value)} />
      </Modal>

      <Modal
        title="提交举报"
        open={reportOpen}
        onCancel={() => setReportOpen(false)}
        onOk={() => void handleReportSubmit()}
        okText="提交举报"
        cancelText="取消"
        confirmLoading={submitting === 'report'}
        width={560}
      >
        <Form
          form={reportForm}
          layout="vertical"
          className="detail-report-form"
          initialValues={{
            type: reportTypeOptions[0],
            identityMode: currentUser?.verificationStatus === 'APPROVED' ? 'REAL_NAME' : 'ANONYMOUS',
            contactConsent: 'YES'
          }}
        >
          <Form.Item name="type" label="举报类型" rules={[{ required: true, message: '请选择举报类型' }]}>
            <Select options={reportTypeOptions.map((item) => ({ label: item, value: item }))} />
          </Form.Item>
          <Form.Item name="identityMode" label="举报方式" rules={[{ required: true }]}>
            <Radio.Group className="detail-report-radio">
              <Radio value="REAL_NAME">实名举报</Radio>
              <Radio value="ANONYMOUS">匿名展示</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="contactConsent" label="后续核查" rules={[{ required: true }]}>
            <Radio.Group className="detail-report-radio">
              <Radio value="YES">愿意配合管理员补充材料</Radio>
              <Radio value="NO">仅提交当前信息</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="detail"
            label="举报说明"
            rules={[
              { required: true, message: '请填写举报说明' },
              { min: 8, message: '说明至少 8 个字' }
            ]}
          >
            <Input.TextArea
              rows={5}
              maxLength={300}
              showCount
              placeholder="请描述问题、聊天经过、交易时间或可核查线索"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
