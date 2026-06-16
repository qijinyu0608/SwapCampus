import { Skeleton, Tabs, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MetaList } from '../components/data-display';
import { EmptyState } from '../components/feedback';
import { SectionHeader } from '../components/layout';
import { ProductGrid, ProductSummaryCard } from '../components/product';
import { UserNameWithBadge } from '../components/user/UserNameWithBadge';
import { UserReviewCard } from '../components/user/UserReviewCard';
import { type AvatarFrameKey, UserAvatar } from '../components/user/UserAvatar';
import { CreditBadge, SectionCard } from '../components/ui';
import { useAuthState } from '../services/auth-state';
import {
  type CampusServiceListItem,
  fetchProducts,
  fetchCampusServiceListings,
  fetchUserReceivedReviews,
  fetchUserTrustSummary,
  getApiErrorMessage,
  ProductSummary,
  UserReceivedReviewItem,
  UserTrustSummary
} from '../services/api';
import { hasTradingAccess, isGuestUser } from '../services/session';
import { executeToggleFollow } from '../utils/followActions';
import { getListingStatusPresentation } from '../utils/listingStatus';
import { getProductImage, resolvePrimaryProductImage } from '../utils/productCover';
import { ensureTradingAccessOrNotify } from '../utils/tradingAccess';
import {
  getUserPresentation
} from '../utils/userPresentation';

export function PublicUserPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const userId = Number(id);
  const [user, setUser] = useState<UserTrustSummary | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [campusServices, setCampusServices] = useState<CampusServiceListItem[]>([]);
  const [reviews, setReviews] = useState<UserReceivedReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followPending, setFollowPending] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'service-requests' | 'service-offers' | 'reviews'>('items');

  useEffect(() => {
    async function loadUserHome() {
      if (!Number.isFinite(userId) || userId <= 0) {
        setError('用户主页不存在');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [summary, productList, campusServiceList, reviewList] = await Promise.all([
          fetchUserTrustSummary(userId),
          fetchProducts({ sellerId: userId, status: 'ON_SALE', page: 1, pageSize: 60 }),
          fetchCampusServiceListings({ ownerId: userId, status: 'OPEN', page: 1, pageSize: 60, sort: 'newest' }),
          fetchUserReceivedReviews(userId)
        ]);
        setUser(summary);
        setProducts(productList.items);
        setCampusServices(campusServiceList.items);
        setReviews(reviewList.items);
        setError('');
      } catch (err) {
        setError(getApiErrorMessage(err, '用户主页加载失败'));
      } finally {
        setLoading(false);
      }
    }

    void loadUserHome();
  }, [userId]);

  const publishedProducts = useMemo(
    () => products.filter((item) => item.sellerId === userId && item.status === 'ON_SALE'),
    [products, userId]
  );
  const publishedServiceRequests = useMemo(
    () => campusServices.filter((item) => item.publisher.id === userId && item.intent === 'REQUEST'),
    [campusServices, userId]
  );
  const publishedServiceOffers = useMemo(
    () => campusServices.filter((item) => item.publisher.id === userId && item.intent === 'OFFER'),
    [campusServices, userId]
  );

  function ensureTradingAccess(actionLabel: string) {
    return ensureTradingAccessOrNotify({
      currentUser,
      actionLabel,
      navigate,
      notifyError: (text) => message.error(text)
    });
  }

  async function handleToggleFollow() {
    if (!user || currentUser?.id === user.id) {
      return;
    }

    if (!ensureTradingAccess('关注该同学')) {
      return;
    }

    await executeToggleFollow({
      targetUserId: user.id,
      isFollowing: user.isFollowing,
      setPending: setFollowPending,
      onSuccess: (result) => {
        setUser((current) => current ? {
          ...current,
          isFollowing: result.isFollowing,
          followerCount: result.followerCount
        } : current);
      },
      notifySuccess: (text) => message.success(text),
      notifyError: (text) => message.error(text)
    });
  }

  if (loading) {
    return <Skeleton active paragraph={{ rows: 12 }} />;
  }

  if (!user || error) {
    return (
      <div className="page-grid public-user-page">
        <EmptyState
          className="is-shell"
          title={error || '用户主页不存在'}
        />
      </div>
    );
  }

  const profileStats = [
    `${user.college}`,
    `完成 ${user.completedOrders} 单`,
    user.averageRating === null ? '暂无评分' : `评分 ${user.averageRating.toFixed(1)}`
  ];
  const userPresentation = getUserPresentation(user);

  function renderReviewList() {
    if (!reviews.length) {
      return <EmptyState title="暂无收到的评价" />;
    }

    return (
      <div className="order-detail-review-list profile-user-review-list">
        {reviews.map((review) => (
          <UserReviewCard
            key={review.id}
            reviewerName={review.reviewerName}
            createdAt={review.createdAt}
            rating={review.rating}
            content={review.content}
            reviewerTrustedBadgeUnlocked={review.reviewerTrustedBadgeUnlocked}
          />
        ))}
      </div>
    );
  }

  function renderCampusServiceGrid(
    items: CampusServiceListItem[],
    emptyTitle: string
  ) {
    return (
      <ProductGrid
        items={items}
        className="fish-feed-grid service-task-grid"
        emptyState={<EmptyState title={emptyTitle} />}
        renderItem={(item) => (
          <ProductSummaryCard
            key={item.id}
            item={item}
            imageSrc={resolvePrimaryProductImage({
              title: item.title,
              category: item.categoryLabel,
              price: item.reward,
              imageUrl: item.imageUrl
            }, item.id)}
            className="profile-fish-card service-task-card"
            priceValue={item.rewardLabel}
            onOpen={() => navigate(`/campus-services/${item.id}`)}
          />
        )}
      />
    );
  }

  return (
    <div className="page-grid public-user-page">
      <section className="profile-hero-card public-user-hero">
        <div className="profile-hero-copy">
          <div className="profile-avatar-badge">
            <UserAvatar
              src={userPresentation.avatarUrl}
              alt={`${userPresentation.displayName}的头像`}
              fallbackLabel={userPresentation.initial}
              className="profile-avatar-image"
              frame={(userPresentation.avatarFrame as AvatarFrameKey | null) ?? undefined}
            />
          </div>
          <div className="profile-hero-meta">
            <div className="profile-hero-title-row">
              <UserNameWithBadge
                as="h1"
                name={userPresentation.displayName}
                trustedBadgeUnlocked={userPresentation.trustedBadgeUnlocked}
              />
              <div className="profile-hero-badges">
                <CreditBadge
                  tone={userPresentation.creditBadge.tone}
                  label={userPresentation.creditBadge.label}
                />
              </div>
            </div>
            <MetaList items={profileStats} className="profile-hero-stats" />
          </div>
        </div>
        {currentUser?.id !== user.id ? (
          <button
            type="button"
            className={`detail-seller-follow public-user-follow${user.isFollowing ? ' is-following' : ''}`}
            onClick={() => void handleToggleFollow()}
            disabled={followPending}
          >
            {user.isFollowing ? '已关注' : '关注'}
          </button>
        ) : null}
      </section>

      <SectionCard className="profile-content-panel credit-center-tabs-panel">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'items' | 'reviews')}
          items={[
            {
              key: 'items',
              label: `在售商品 ${publishedProducts.length}`,
              children: (
                <>
                  <ProductGrid
                    items={publishedProducts}
                    className="fish-feed-grid"
                    emptyState={<EmptyState title="这个同学暂时没有在售闲置" />}
                    renderItem={(item, index) => {
                      const status = getListingStatusPresentation(item.status);
                      return (
                        <ProductSummaryCard
                          key={item.id}
                          className={index % 3 === 2 ? 'offset' : ''}
                          item={item}
                          imageSrc={getProductImage(item, index)}
                          priceMeta={item.status !== 'ON_SALE' ? status.label : `${item.wantCount ?? 0} 人想要`}
                          onOpen={() => navigate(`/products/${item.id}`)}
                        />
                      );
                    }}
                  />
                </>
              )
            },
            {
              key: 'service-requests',
              label: `发布的需求 ${publishedServiceRequests.length}`,
              children: (
                <>
                  <SectionHeader title="正在找人帮忙" description={`${publishedServiceRequests.length} 条公开需求`} className="is-prominent is-spacious" />
                  {renderCampusServiceGrid(publishedServiceRequests, '这个同学暂时没有公开需求')}
                </>
              )
            },
            {
              key: 'service-offers',
              label: `发布的服务 ${publishedServiceOffers.length}`,
              children: (
                <>
                  <SectionHeader title="正在提供服务" description={`${publishedServiceOffers.length} 条公开服务`} className="is-prominent is-spacious" />
                  {renderCampusServiceGrid(publishedServiceOffers, '这个同学暂时没有公开服务')}
                </>
              )
            },
            {
              key: 'reviews',
              label: `收到的评价 ${reviews.length}`,
              children: (
                <>
                  {renderReviewList()}
                </>
              )
            }
          ]}
        />
      </SectionCard>
    </div>
  );
}
