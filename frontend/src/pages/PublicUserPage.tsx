import { Skeleton, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MetaList } from '../components/data-display';
import { EmptyState } from '../components/feedback';
import { SectionHeader } from '../components/layout';
import { ProductGrid, ProductSummaryCard } from '../components/product';
import { UserAvatar } from '../components/user/UserAvatar';
import { SectionCard } from '../components/ui';
import { useAuthState } from '../services/auth-state';
import {
  fetchProducts,
  followUser,
  fetchUserTrustSummary,
  getApiErrorMessage,
  ProductSummary,
  unfollowUser,
  UserTrustSummary
} from '../services/api';
import { hasTradingAccess, isGuestUser } from '../services/session';
import { getListingStatusPresentation } from '../utils/listingStatus';
import { getProductImage } from '../utils/productCover';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followPending, setFollowPending] = useState(false);

  useEffect(() => {
    async function loadUserHome() {
      if (!Number.isFinite(userId) || userId <= 0) {
        setError('用户主页不存在');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [summary, productList] = await Promise.all([
          fetchUserTrustSummary(userId),
          fetchProducts({ sellerId: userId, status: 'ON_SALE', page: 1, pageSize: 60 })
        ]);
        setUser(summary);
        setProducts(productList.items);
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

  function ensureTradingAccess(actionLabel: string) {
    if (!currentUser) {
      message.error(`请先登录后再${actionLabel}`);
      void navigate('/login');
      return false;
    }

    if (isGuestUser(currentUser)) {
      message.error(`浏览账号不可${actionLabel}`);
      void navigate('/login');
      return false;
    }

    if (!hasTradingAccess(currentUser)) {
      message.error(`当前账号不可${actionLabel}`);
      return false;
    }

    return true;
  }

  async function handleToggleFollow() {
    if (!user || currentUser?.id === user.id) {
      return;
    }

    if (!ensureTradingAccess('关注该同学')) {
      return;
    }

    setFollowPending(true);
    try {
      const result = user.isFollowing
        ? await unfollowUser(user.id)
        : await followUser(user.id);
      setUser((current) => current ? {
        ...current,
        isFollowing: result.isFollowing,
        followerCount: result.followerCount
      } : current);
      message.success(result.isFollowing ? '已关注' : '已取消关注');
    } catch (err) {
      message.error(getApiErrorMessage(err, '关注操作失败'));
    } finally {
      setFollowPending(false);
    }
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
            />
          </div>
          <div className="profile-hero-meta">
            <div className="profile-hero-title-row">
              <h1>{userPresentation.displayName}</h1>
              <div className="profile-hero-badges">
                <div className={`ui-credit-badge is-${userPresentation.creditBadge.tone}`}>
                  <span className="ui-credit-badge-label">{userPresentation.creditBadge.label}</span>
                </div>
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

      <SectionCard className="profile-content-panel">
        <SectionHeader title="正在出售" description={`${publishedProducts.length} 件校内闲置`} className="is-prominent is-spacious" />
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
      </SectionCard>
    </div>
  );
}
