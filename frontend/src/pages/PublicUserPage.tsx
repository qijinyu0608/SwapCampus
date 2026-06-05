import { Empty, Skeleton } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/feedback/EmptyState';
import { PageHeader } from '../components/layout/PageHeader';
import { ProductSummaryCard } from '../components/product/ProductSummaryCard';
import { SectionCard } from '../components/ui/SectionCard';
import {
  fetchProducts,
  fetchUserTrustSummary,
  getApiErrorMessage,
  ProductSummary,
  UserTrustSummary
} from '../services/api';
import { getProductImage } from '../utils/productCover';

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
          fetchProducts()
        ]);
        setUser(summary);
        setProducts(productList);
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
          className="profile-empty-shell"
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

  return (
    <div className="page-grid public-user-page">
      <PageHeader
        title={user.name}
        subtitle="公开校园主页"
        meta={<span>{`${publishedProducts.length} 件在售闲置`}</span>}
      />
      <section className="profile-hero-card public-user-hero">
        <div className="profile-hero-copy">
          <div className="profile-avatar-badge">
            <span>{user.name.slice(0, 1)}</span>
          </div>
          <div className="profile-hero-meta">
            <div className="profile-hero-title-row">
              <h1>{user.name}</h1>
              <div className="profile-hero-badges">
                <span>{user.verified ? '实名认证' : '普通账号'}</span>
                <span>{`信用${user.creditLevel}`}</span>
              </div>
            </div>
            <div className="profile-hero-stats">
              {profileStats.map((item, index) => (
                <span key={item}>
                  {item}
                  {index < profileStats.length - 1 ? <i /> : null}
                </span>
              ))}
            </div>
            <p>公开校园主页，仅展示交易信用和在售闲置。</p>
          </div>
        </div>
      </section>

      <SectionCard className="profile-content-panel">
        <div className="profile-section-header">
          <div>
            <strong>正在出售</strong>
            <span>{`${publishedProducts.length} 件校内闲置`}</span>
          </div>
        </div>
        {publishedProducts.length ? (
          <div className="profile-fish-grid public-user-products">
            {publishedProducts.map((item, index) => (
              <ProductSummaryCard
                key={item.id}
                className="profile-fish-card"
                item={item}
                imageSrc={getProductImage(item, index)}
                signal={`${item.category} · ${item.condition}`}
                secondaryMeta="同校面交"
                tertiaryMeta={<span>{item.sellerName}</span>}
                onOpen={() => navigate(`/products/${item.id}`)}
              />
            ))}
          </div>
        ) : (
          <Empty description="这个同学暂时没有在售闲置" />
        )}
      </SectionCard>
    </div>
  );
}
