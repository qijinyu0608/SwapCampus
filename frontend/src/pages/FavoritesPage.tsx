import { Skeleton } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FoldSection } from '../components/disclosure';
import { StatStrip } from '../components/data-display';
import { EmptyState } from '../components/feedback';
import { PageHeader, SectionHeader } from '../components/layout';
import { ProductGrid, ProductSummaryCard } from '../components/product';
import { useAuthState } from '../services/auth-state';
import { fetchProducts, type FavoriteItem, type ProductSummary } from '../services/api';
import { getFavoriteIds, loadFavorites, subscribeFavorites, toggleFavorite } from '../services/favorites';
import { getProductImage } from '../utils/productCover';

type FavoriteFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export function FavoritesPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [favoriteVersion, setFavoriteVersion] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FavoriteFilter>('ALL');

  const favoriteIds = useMemo(() => getFavoriteIds(currentUser), [currentUser, favoriteVersion]);
  const favoriteProducts = useMemo(
    () => {
      if (currentUser?.role === 'USER') {
        return favoriteItems;
      }

      const orderMap = new Map(favoriteIds.map((id, index) => [id, index]));
      return products
        .filter((item) => favoriteIds.includes(item.id))
        .sort((left, right) => (orderMap.get(left.id) ?? 0) - (orderMap.get(right.id) ?? 0));
    },
    [currentUser, favoriteIds, favoriteItems, products]
  );
  const activeFavorites = favoriteProducts.filter((item) => item.status === 'ON_SALE');
  const inactiveFavorites = favoriteProducts.filter((item) => item.status !== 'ON_SALE');
  const visibleActiveFavorites = activeFilter === 'INACTIVE' ? [] : activeFavorites;
  const visibleInactiveFavorites = activeFilter === 'ACTIVE' ? [] : inactiveFavorites;
  const favoritePreview = favoriteProducts[0];
  const summaryItems = [
    {
      key: 'preview',
      value: favoritePreview?.title ?? '已收藏',
      label: favoritePreview ? `¥${favoritePreview.price} · ${favoritePreview.category}` : '去逛逛',
      emphasis: 'lead' as const
    },
    { key: 'active', value: activeFavorites.length, label: '在售可约' },
    { key: 'inactive', value: inactiveFavorites.length, label: '已失效' }
  ];

  async function handleRemoveFavorite(item: ProductSummary) {
    await toggleFavorite(item.id, currentUser);
    setFavoriteVersion((value) => value + 1);
  }

  async function handleClearInactive() {
    for (const item of inactiveFavorites) {
      await handleRemoveFavorite(item);
    }
  }

  function formatFavoritedAt(item: ProductSummary) {
    if (!item.favoritedAt) {
      return '刚刚想要';
    }

    return `收藏于 ${new Date(item.favoritedAt).toLocaleDateString()}`;
  }

  useEffect(() => {
    async function load() {
      try {
        if (currentUser?.role === 'USER') {
          const result = await loadFavorites(currentUser);
          setFavoriteItems(result.items);
        } else {
          const data = await fetchProducts({ ids: favoriteIds, status: 'ALL', page: 1, pageSize: 60 });
          setProducts(data.items);
          setFavoriteItems([]);
        }
      } catch {
        setProducts([]);
        setFavoriteItems([]);
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    void load();
  }, [currentUser, favoriteIds, favoriteVersion]);

  useEffect(() => subscribeFavorites(() => setFavoriteVersion((value) => value + 1)), []);

  return (
    <div className="favorites-page page-grid">
      <PageHeader title="想要" subtitle="已收藏" meta={<span>{favoriteProducts.length} 件</span>} />

      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : favoriteProducts.length === 0 ? (
        <EmptyState
          className="favorites-empty"
          title="还没有想要的商品"
          action={(
            <button type="button" className="fish-search-button" onClick={() => navigate('/')}>
              去逛逛
            </button>
          )}
        />
      ) : (
        <section className="fish-feed-shell">
          <StatStrip items={summaryItems} className="favorites-summary-strip" />
          <FoldSection
            title="筛选"
            meta={favoritePreview ? `${favoritePreview.category} / 同校面交` : '全部'}
            compact
          >
            <div className="favorites-filter-strip">
              <button
                type="button"
                className={activeFilter === 'ALL' ? 'favorites-filter-pill active' : 'favorites-filter-pill'}
                onClick={() => setActiveFilter('ALL')}
              >
                全部
              </button>
              <button
                type="button"
                className={activeFilter === 'ACTIVE' ? 'favorites-filter-pill active' : 'favorites-filter-pill'}
                onClick={() => setActiveFilter('ACTIVE')}
              >
                {activeFavorites.length} 件在售
              </button>
              <button
                type="button"
                className={activeFilter === 'INACTIVE' ? 'favorites-filter-pill active' : 'favorites-filter-pill'}
                onClick={() => setActiveFilter('INACTIVE')}
              >
                {inactiveFavorites.length} 件失效
              </button>
              {inactiveFavorites.length ? (
                <button type="button" className="favorites-clean-button" onClick={() => void handleClearInactive()}>
                  清理失效收藏
                </button>
              ) : null}
            </div>
          </FoldSection>
          {visibleActiveFavorites.length ? (
            <>
              <SectionHeader
                title="还在售"
                description={`${visibleActiveFavorites.length} 件`}
                className="favorites-section-head"
              />
              <ProductGrid
                items={visibleActiveFavorites}
                className="fish-feed-grid"
                renderItem={(item, index) => (
                  <ProductSummaryCard
                    key={item.id}
                    className={index % 3 === 2 ? 'offset' : ''}
                    item={item}
                    imageSrc={getProductImage(item, index)}
                    signal={`${item.category} · ${item.condition}`}
                    coverActions={(
                      <button
                        type="button"
                        className="fish-item-favorite"
                        onClick={async (event) => {
                          event.stopPropagation();
                          await handleRemoveFavorite(item);
                        }}
                        aria-label="取消收藏"
                      >
                        取消
                      </button>
                    )}
                    priceMeta={`${item.favoriteCount ?? 0} 人想要`}
                    tagItems={[
                      item.sellerName,
                      formatFavoritedAt(item),
                      '同校面交'
                    ]}
                    onOpen={() => navigate(`/products/${item.id}`)}
                  />
                )}
              />
            </>
          ) : null}
          {visibleInactiveFavorites.length ? (
            <>
              <SectionHeader
                title="已失效"
                description="商品已售出、下架或暂不可交易"
                className="favorites-section-head muted"
              />
              <ProductGrid
                items={visibleInactiveFavorites}
                className="fish-feed-grid"
                renderItem={(item, index) => (
                  <ProductSummaryCard
                    key={item.id}
                    className={`favorites-inactive-card${index % 3 === 2 ? ' offset' : ''}`}
                    item={item}
                    imageSrc={getProductImage(item, index)}
                    signal={`${item.category} · ${item.condition}`}
                    coverActions={(
                      <button
                        type="button"
                        className="fish-item-favorite"
                        onClick={async (event) => {
                          event.stopPropagation();
                          await handleRemoveFavorite(item);
                        }}
                        aria-label="移出收藏列表"
                      >
                        移出
                      </button>
                    )}
                    priceMeta={item.status}
                    tagItems={[
                      item.sellerName,
                      formatFavoritedAt(item),
                      '暂不可交易'
                    ]}
                    onOpen={() => navigate(`/products/${item.id}`)}
                  />
                )}
              />
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}
