import { Button, Skeleton, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MetaList } from '../components/data-display';
import { EmptyState } from '../components/feedback';
import { PageHeader, SectionHeader } from '../components/layout';
import { ProductGrid, ProductSummaryCard } from '../components/product';
import { UserAvatar } from '../components/user/UserAvatar';
import { SectionCard } from '../components/ui';
import {
  fetchProducts,
  followUser,
  unfollowUser,
  fetchUserTrustSummary,
  getApiErrorMessage,
  ProductSummary,
  UserTrustSummary
} from '../services/api';
import { useAuthState } from '../services/auth-state';
import { hasTradingAccess } from '../services/session';
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
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

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
        setFollowing(summary.isFollowing);
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

  useEffect(() => {
    setFollowing(user?.isFollowing ?? false);
  }, [user?.id, user?.isFollowing]);

  const publishedProducts = useMemo(
    () => products.filter((item) => item.sellerId === userId && item.status === 'ON_SALE'),
    [products, userId]
  );

  if (loading) {
    return <Skeleton active paragraph={{ rows: 12 }} />;
  }

  if (!user || error) {
    return (
      <div className="page-grid public-user-page">
        <EmptyState
          className="is-shell"
          title={error || '用户主页不存在'}
          description="可以返回商品详情页重新打开。"
        />
      </div>
    );
  }

  const profileStats = [
    `${user.college}`,
    `${user.responseRate}% 回复率`,
    `完成 ${user.completedOrders} 单`,
    `评分 ${user.averageRating.toFixed(1)}`
  ];
  const userPresentation = getUserPresentation(user);
  const currentUserId = currentUser?.id ?? null;
  const targetUserId = user.id;
  const canFollow = hasTradingAccess(currentUser) && currentUserId !== targetUserId;

  async function handleToggleFollow() {
    if (!canFollow) {
      if (!currentUser) {
        void navigate('/login', { state: { from: `/users/${targetUserId}` } });
      }
      return;
    }

    setFollowLoading(true);
    try {
      if (following) {
        await unfollowUser(targetUserId);
        setFollowing(false);
        message.success('已取消关注');
      } else {
        await followUser(targetUserId);
        setFollowing(true);
        message.success('已关注');
      }
    } catch (err) {
      message.error(getApiErrorMessage(err, following ? '取消关注失败' : '关注失败'));
    } finally {
      setFollowLoading(false);
    }
  }

  return (
    <div className="page-grid public-user-page">
      <PageHeader
        title={user.displayName}
        subtitle="公开校园主页"
        meta={(
          <div className="public-user-page-meta">
            <span>{`${publishedProducts.length} 件在售闲置`}</span>
            <Button
              type={following ? 'default' : 'primary'}
              size="small"
              onClick={() => void handleToggleFollow()}
              loading={followLoading}
              disabled={!canFollow && Boolean(currentUser)}
            >
              {following ? '已关注' : '关注'}
            </Button>
          </div>
        )}
      />
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
                <span>{userPresentation.publicIdentityLabel}</span>
                <div className={`ui-credit-badge is-${userPresentation.creditBadge.tone}`}>
                  <span className="ui-credit-badge-label">{userPresentation.creditBadge.label}</span>
                </div>
              </div>
            </div>
            <MetaList items={profileStats} className="profile-hero-stats" />
            <p>公开校园主页，仅展示交易信用和在售闲置。</p>
          </div>
        </div>
      </section>

      <SectionCard className="profile-content-panel">
        <SectionHeader title="正在出售" description={`${publishedProducts.length} 件校内闲置`} className="is-prominent is-spacious" />
        <ProductGrid
          items={publishedProducts}
          className="public-user-products"
          emptyState={<EmptyState title="这个同学暂时没有在售闲置" />}
          renderItem={(item, index) => (
            <ProductSummaryCard
              key={item.id}
              className="profile-fish-card"
              item={item}
              imageSrc={getProductImage(item, index)}
              signal={`${item.category} · ${item.condition}`}
              priceMeta="同校面交"
              tagItems={[item.sellerName, '在售商品']}
              onOpen={() => navigate(`/products/${item.id}`)}
            />
          )}
        />
      </SectionCard>
    </div>
  );
}
