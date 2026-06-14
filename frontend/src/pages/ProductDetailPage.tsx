import { StarFilled, StarOutlined } from '@ant-design/icons';
import { Button, Form, Skeleton, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DetailShell } from '../components/layout';
import { ProductGrid, ProductSummaryCard } from '../components/product';
import {
  DetailContentBody,
  DetailActionFooter,
  DetailInfoPanel,
  DetailMediaGallery,
  DetailInfoTopSummary,
  DetailSellerStrip,
  ReportFormModal,
  type ReportFormValues
} from '../components/ui';
import { type AvatarFrameKey } from '../components/user/UserAvatar';
import { useAuthState } from '../services/auth-state';
import {
  createConversation,
  createReport,
  fetchProductDetail,
  fetchUserTrustSummary,
  getApiErrorMessage,
  recordProductContact,
  type ProductDetailView
} from '../services/api';
import { isFavorite, subscribeFavorites, toggleFavorite } from '../services/favorites';
import { hasTradingAccess, isGuestUser } from '../services/session';
import { executeToggleFollow } from '../utils/followActions';
import { loadFollowStateForTarget } from '../utils/followState';
import { resolvePrimaryProductImage, resolveProductGallery } from '../utils/productCover';
import { openReportForm, submitReportForm } from '../utils/reportForm';
import { ensureTradingAccessOrNotify } from '../utils/tradingAccess';
import { getUserPresentation } from '../utils/userPresentation';
import { formatCurrencyAmount } from '../utils/price';

const reportTypeOptions = [
  '商品描述与实物不符',
  '疑似诈骗或诱导站外交易',
  '违禁或不适合校园交易',
  '卖家辱骂骚扰',
  '盗图或冒用他人信息',
  '其他问题'
];

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, clearCurrentUser } = useAuthState();
  const [detail, setDetail] = useState<ProductDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<'chat' | 'report' | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [favoriteVersion, setFavoriteVersion] = useState(0);
  const [favoriteAnimating, setFavoriteAnimating] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportForm] = Form.useForm<ReportFormValues>();
  const [sellerFollowing, setSellerFollowing] = useState(false);
  const [followPending, setFollowPending] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const data = await fetchProductDetail(Number(id));
        setDetail(data);
        setActiveImage(0);
        setDescriptionExpanded(false);
      } catch {
        setDetail(null);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [id]);

  useEffect(() => subscribeFavorites(() => setFavoriteVersion((value) => value + 1)), []);

  useEffect(() => {
    let cancelled = false;

    async function loadFollowState() {
      await loadFollowStateForTarget({
        currentUser,
        targetUserId: detail?.seller.id,
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
  }, [detail, currentUser]);

  const favorited = useMemo(
    () => (detail ? isFavorite(detail.id, currentUser) : false),
    [detail, currentUser, favoriteVersion]
  );

  function handleAuthExpired(error: unknown) {
    const maybeMessage = getApiErrorMessage(error, '');

    if (maybeMessage?.includes('登录状态已失效')) {
      clearCurrentUser();
      message.error('登录状态已失效，请重新登录');
      void navigate('/login');
      return true;
    }

    return false;
  }

  function showActionError(error: unknown, fallback: string) {
    if (!handleAuthExpired(error)) {
      message.error(getApiErrorMessage(error, fallback));
    }
  }

  function ensureTradingAccess(actionLabel: string) {
    return ensureTradingAccessOrNotify({
      currentUser,
      actionLabel,
      navigate,
      notifyError: (text) => message.error(text)
    });
  }

  async function handleToggleFollow() {
    if (!detail) {
      return;
    }

    if (!ensureTradingAccess('关注卖家')) {
      return;
    }

    await executeToggleFollow({
      targetUserId: detail.seller.id,
      isFollowing: sellerFollowing,
      setPending: setFollowPending,
      onSuccess: (result) => setSellerFollowing(result.isFollowing),
      notifySuccess: (text) => message.success(text),
      notifyError: (text) => message.error(text),
      successMessage: {
        follow: '已关注卖家',
        unfollow: '已取消关注'
      }
    });
  }

  async function handleContactSeller() {
    if (!detail) {
      return;
    }

    if (!ensureTradingAccess('联系对方')) {
      return;
    }

    if (!currentUser) {
      return;
    }

    setSubmitting('chat');
    try {
      await recordProductContact(detail.id);
      const conversation = await createConversation({ productId: detail.id });
      setSubmitting(null);
      void navigate('/messages', {
        state: {
          conversationId: conversation.id,
          channel: 'trade'
        }
      });
    } catch (error) {
      showActionError(error, '联系卖家失败');
      setSubmitting(null);
    }
  }

  function handleCreateOrder() {
    if (!detail) {
      return;
    }

    if (!ensureTradingAccess('下单')) {
      return;
    }

    const activeUser = currentUser;
    if (!activeUser) {
      return;
    }
    void navigate(`/orders/checkout?type=product&productId=${detail.id}`);
  }

  function openReportModal() {
    if (!detail) {
      return;
    }

    if (!ensureTradingAccess('举报')) {
      return;
    }

    openReportForm({
      form: reportForm,
      currentUser,
      defaultType: reportTypeOptions[0],
      open: () => setReportModalOpen(true)
    });
  }

  async function handleReportSubmit() {
    if (!detail) {
      return;
    }

    const activeUser = currentUser;
    if (!activeUser) {
      return;
    }

    setSubmitting('report');
    try {
      await submitReportForm({
        form: reportForm,
        currentUser: activeUser,
        submit: (reason) => createReport({
          productId: detail.id,
          targetUserId: detail.seller.id,
          reason
        }),
        onSuccess: () => {
          setReportModalOpen(false);
          message.success('举报已提交');
        }
      });
    } catch (error) {
      showActionError(error, '举报提交失败');
    } finally {
      setSubmitting(null);
    }
  }

  async function handleToggleFavorite() {
    if (!detail) {
      return;
    }

    try {
      setFavoriteAnimating(false);
      const nextState = await toggleFavorite(detail.id, currentUser);
      setFavoriteVersion((value) => value + 1);
      if (nextState) {
        setFavoriteAnimating(true);
        window.setTimeout(() => setFavoriteAnimating(false), 520);
      }
      message.success(nextState ? '已加入收藏' : '已取消收藏');
    } catch (error) {
      showActionError(error, '收藏操作失败');
    }
  }

  if (loading) {
    return <Skeleton active paragraph={{ rows: 14 }} />;
  }

  if (!detail) {
    return (
      <div className="page-grid">
        <section className="hero-panel">
          <div className="hero-chip-row">
            <span className="hero-chip">商品详情</span>
            <span className="hero-chip">站内交易</span>
          </div>
          <h1 className="hero-title">商品不存在</h1>
        </section>
      </div>
    );
  }

  const detailImages = resolveProductGallery(
    {
      ...detail,
      sellerName: detail.seller.displayName
    },
    detail.id,
    6
  );
  const sellerPresentation = getUserPresentation(detail.seller);
  const detailDescription = descriptionExpanded || detail.detailBase.description.length <= 88
    ? detail.detailBase.description
    : `${detail.detailBase.description.slice(0, 88)}...`;
  const tradeState = detail.detailBase.tradeState;
  const hasActiveOrder = Boolean(tradeState?.orderStatus && tradeState.orderStatus !== 'CANCELED');
  const primaryActionLabel = !hasActiveOrder
    ? null
    : tradeState?.orderStatus === 'COMPLETED'
      ? '商品已成交'
      : tradeState?.isBuyer
        ? '确定收货'
        : '商品已售出';
  const primaryActionHref = tradeState?.canOpenOrderDetail && tradeState.orderId
    ? `/orders/${tradeState.orderId}`
    : null;
  const tradeStatusLabel = tradeState?.orderStatus === 'COMPLETED'
    ? '商品已成交'
    : hasActiveOrder
      ? '商品已售出'
      : null;
  const sellerIdentity = sellerPresentation.creditBadge.label;
  const sellerStats = [
    detail.seller.college,
    `完成 ${detail.seller.completedOrders} 单`,
    detail.seller.averageRating === null ? '暂无评分' : `评分 ${detail.seller.averageRating.toFixed(1)}`
  ];

  return (
    <div className="detail-page">
      <DetailSellerStrip
        userId={detail.seller.id}
        name={detail.seller.displayName}
        avatarUrl={detail.seller.avatarUrl}
        avatarFrame={(detail.seller.avatarFrame as AvatarFrameKey | null) ?? undefined}
        trustedBadgeUnlocked={sellerPresentation.trustedBadgeUnlocked}
        creditTone={sellerPresentation.creditBadge.tone}
        creditLabel={sellerIdentity}
        stats={sellerStats}
        followButton={currentUser?.id !== detail.seller.id ? (
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
        mainMedia={(
          <DetailMediaGallery
            images={detailImages}
            activeIndex={activeImage}
            onSelect={setActiveImage}
            title={detail.title}
            galleryKey={detail.id}
          />
        )}
        sidePanel={(
          <DetailInfoPanel
            top={(
              <DetailInfoTopSummary
                stats={[
                  `${detail.stats.wantCount} 人想要`,
                  `${detail.stats.favoriteCount} 收藏`,
                  `${detail.stats.viewCount} 浏览`
                ]}
                favoriteButton={(
                  <button
                    type="button"
                    aria-label={favorited ? '取消收藏' : '收藏商品'}
                    className={[
                      'detail-favorite-star',
                      favorited ? 'active' : '',
                      favoriteAnimating ? 'is-popping' : ''
                    ].filter(Boolean).join(' ')}
                    onClick={() => void handleToggleFavorite()}
                  >
                    {favorited ? <StarFilled /> : <StarOutlined />}
                  </button>
                )}
                amount={<strong>{formatCurrencyAmount(detail.detailBase.price)}</strong>}
              />
            )}
            body={(
              <DetailContentBody
                title={detail.detailBase.title}
                description={detailDescription}
                expandButton={detail.detailBase.description.length > 88 ? (
                  <button
                    type="button"
                    className="detail-expand-button"
                    onClick={() => setDescriptionExpanded((current) => !current)}
                  >
                    {descriptionExpanded ? '收起' : '展开'}
                  </button>
                ) : undefined}
              />
            )}
            footer={(
              <DetailActionFooter
                actions={hasActiveOrder ? (
                  <Button
                    type="primary"
                    size="large"
                    disabled={!primaryActionHref}
                    onClick={primaryActionHref ? () => void navigate(primaryActionHref) : undefined}
                  >
                    {primaryActionLabel}
                  </Button>
                ) : (
                  <>
                    <Button type="primary" size="large" onClick={() => void handleContactSeller()} loading={submitting === 'chat'}>
                      聊一聊
                    </Button>
                    <Button size="large" onClick={handleCreateOrder}>
                      立即下单
                    </Button>
                  </>
                )}
                status={tradeStatusLabel ? <div className="detail-trade-status">{tradeStatusLabel}</div> : undefined}
                quietAction={(
                  <button type="button" className="detail-quiet-action warn" onClick={openReportModal}>
                    {submitting === 'report' ? '提交中...' : '举报'}
                  </button>
                )}
              />
            )}
          />
        )}
      />

      <ReportFormModal
        open={reportModalOpen}
        onCancel={() => setReportModalOpen(false)}
        onSubmit={() => void handleReportSubmit()}
        loading={submitting === 'report'}
        typeOptions={reportTypeOptions}
        realNameAvailable={currentUser?.verificationStatus === 'APPROVED'}
        form={reportForm}
      />

      <section className="detail-related">
        <div className="fish-feed-header">
          <h2>相似推荐</h2>
        </div>
        <ProductGrid
          items={detail.relatedProducts}
          className="fish-feed-grid detail-feed-grid"
          renderItem={(item) => (
            <Link key={item.id} to={`/products/${item.id}`} className="detail-related-link">
              <ProductSummaryCard
                className="detail-related-card"
                item={item}
                imageSrc={resolvePrimaryProductImage(item, item.id)}
              />
            </Link>
          )}
        />
      </section>
    </div>
  );
}
