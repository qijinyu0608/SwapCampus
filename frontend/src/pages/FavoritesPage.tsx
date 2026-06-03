import { Skeleton } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FoldSection } from '../components/FoldSection';
import { fetchProducts, ProductSummary } from '../services/api';
import { syncFavoriteSignal } from '../services/behavior';
import { getFavoriteIds, subscribeFavorites, toggleFavorite } from '../services/favorites';
import { getDemoUser } from '../services/session';
import { getProductImage } from '../utils/productCover';

export function FavoritesPage() {
  const navigate = useNavigate();
  const currentUser = useMemo(() => getDemoUser(), []);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [favoriteVersion, setFavoriteVersion] = useState(0);

  const favoriteIds = useMemo(() => getFavoriteIds(currentUser), [currentUser, favoriteVersion]);
  const favoriteProducts = useMemo(
    () => {
      const orderMap = new Map(favoriteIds.map((id, index) => [id, index]));
      return products
        .filter((item) => favoriteIds.includes(item.id))
        .sort((left, right) => (orderMap.get(left.id) ?? 0) - (orderMap.get(right.id) ?? 0));
    },
    [products, favoriteIds]
  );
  const favoritePreview = favoriteProducts[0];

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchProducts();
        setProducts(data);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [currentUser]);

  useEffect(() => subscribeFavorites(() => setFavoriteVersion((value) => value + 1)), []);

  return (
    <div className="favorites-page page-grid">
      <section className="page-topbar">
        <div className="page-topbar-copy">
          <h1>想要</h1>
          <span>已收藏</span>
        </div>
        <div className="page-topbar-tags">
          <span>{favoriteProducts.length} 件</span>
        </div>
      </section>

      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : favoriteProducts.length === 0 ? (
        <section className="favorites-empty">
          <strong>还没有想要的商品</strong>
          <button type="button" className="fish-search-button" onClick={() => navigate('/')}>
            去逛逛
          </button>
        </section>
      ) : (
        <section className="fish-feed-shell">
          <div className="favorites-summary-strip">
            <div className="favorites-summary-card lead">
              <strong>{favoritePreview?.title ?? '已收藏'}</strong>
              <span>{favoritePreview ? `¥${favoritePreview.price} · ${favoritePreview.category}` : '去逛逛'}</span>
            </div>
            <div className="favorites-summary-card">
              <strong>{favoriteProducts.length}</strong>
              <span>想要商品</span>
            </div>
            <div className="favorites-summary-card">
              <strong>{favoriteProducts.filter((item) => item.price <= 50).length}</strong>
              <span>低价可捡</span>
            </div>
          </div>
          <FoldSection
            title="筛选"
            meta={favoritePreview ? `${favoritePreview.category} / 同校面交` : '全部'}
            compact
          >
            <div className="favorites-filter-strip">
              <span className="favorites-filter-pill active">全部</span>
              <span className="favorites-filter-pill">同校面交</span>
              <span className="favorites-filter-pill">最近收藏</span>
            </div>
          </FoldSection>
          <div className="fish-feed-grid">
            {favoriteProducts.map((item, index) => (
              <article
                key={item.id}
                className={`fish-item-card ${index % 3 === 2 ? 'offset' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/products/${item.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    navigate(`/products/${item.id}`);
                  }
                }}
              >
                <div className={item.imageUrl ? 'fish-item-cover has-image' : 'fish-item-cover'}>
                  <img className="fish-item-cover-image" src={getProductImage(item, index)} alt={item.title} />
                  <span className="fish-item-signal">{item.category} · {item.condition}</span>
                </div>
                <div className="fish-item-body">
                  <h3>{item.title}</h3>
                  <div className="fish-item-price-row">
                    <strong>¥{item.price}</strong>
                    <span>{item.recommendationReason ?? '同校面交'}</span>
                  </div>
                  <div className="fish-item-meta">
                    <span>{item.sellerName}</span>
                  </div>
                  <div className="fish-item-passive-row favorites-passive-row">
                    <button
                      type="button"
                      className="fish-item-link active"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleFavorite(item.id, currentUser);
                        syncFavoriteSignal(item, false, currentUser);
                        setFavoriteVersion((value) => value + 1);
                      }}
                    >
                      取消想要
                    </button>
                    <span>同校</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
