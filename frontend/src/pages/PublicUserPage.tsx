import { Skeleton } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MetaList } from '../components/data-display';
import { EmptyState } from '../components/feedback';
import { PageHeader, SectionHeader } from '../components/layout';
import { ProductGrid, ProductSummaryCard } from '../components/product';
import { SectionCard } from '../components/ui';
import {
  fetchProducts,
  fetchUserTrustSummary,
  getApiErrorMessage,
  ProductSummary,
  UserTrustSummary
} from '../services/api';
import { getProductImage } from '../utils/productCover';
import {
  getUserPresentation
} from '../utils/userPresentation';

export function PublicUserPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = Number(id);
  const [user, setUser] = useState<UserTrustSummary | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="page-grid public-user-page">
      <PageHeader
        title={user.displayName}
        subtitle="公开校园主页"
        meta={<span>{`${publishedProducts.length} 件在售闲置`}</span>}
      />
      <section className="profile-hero-card public-user-hero">
        <div className="profile-hero-copy">
          <div className="profile-avatar-badge">
            <span>{userPresentation.initial}</span>
          </div>
          <div className="profile-hero-meta">
            <div className="profile-hero-title-row">
              <h1>{userPresentation.displayName}</h1>
              <div className="profile-hero-badges">
                <span>{userPresentation.publicIdentityLabel}</span>
                <span>{userPresentation.creditBadge.label}</span>
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
