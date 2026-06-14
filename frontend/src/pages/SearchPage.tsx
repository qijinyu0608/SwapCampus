import { Input, Skeleton, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/feedback';
import { ProductGrid, ProductSummaryCard, ResultFilterBar } from '../components/product';
import {
  fetchProducts,
  getApiErrorMessage,
  ProductSummary
} from '../services/api';
import { subscribeFavorites } from '../services/favorites';
import { getListingStatusPresentation } from '../utils/listingStatus';
import { getProductImage } from '../utils/productCover';

type CreditFilterKey = 'OUTSTANDING' | 'EXCELLENT' | 'GOOD' | 'STABLE' | 'IMPROVE';

const CREDIT_FILTER_OPTIONS: Array<{ key: CreditFilterKey; label: string }> = [
  { key: 'OUTSTANDING', label: '极好' },
  { key: 'EXCELLENT', label: '优秀' },
  { key: 'GOOD', label: '良好' },
  { key: 'STABLE', label: '稳定' },
  { key: 'IMPROVE', label: '待提升' }
];

function matchesCreditLevel(score: number, filter: CreditFilterKey) {
  if (filter === 'OUTSTANDING') {
    return score >= 90;
  }

  if (filter === 'EXCELLENT') {
    return score >= 80 && score < 90;
  }

  if (filter === 'GOOD') {
    return score >= 70 && score < 80;
  }

  if (filter === 'STABLE') {
    return score >= 60 && score < 70;
  }

  return score < 60;
}

export function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialKeyword = searchParams.get('q')?.trim() ?? '';
  const [searchInput, setSearchInput] = useState(initialKeyword);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [sortKey, setSortKey] = useState<'relevance' | 'price_asc' | 'price_desc'>('relevance');
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [activeCreditFilters, setActiveCreditFilters] = useState<CreditFilterKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [favoriteVersion, setFavoriteVersion] = useState(0);

  useEffect(() => {
    setSearchInput(initialKeyword);
  }, [initialKeyword]);

  useEffect(() => subscribeFavorites(() => setFavoriteVersion((value) => value + 1)), []);

  useEffect(() => {
    async function load() {
      try {
        const result = await fetchProducts({
          q: initialKeyword || undefined,
          status: 'ON_SALE',
          page: 1,
          pageSize: 60,
          sort: 'relevance'
        });
        setProducts(result.items);
        setLoadError('');
      } catch (error) {
        setProducts([]);
        setLoadError(getApiErrorMessage(error, '搜索服务当前不可用'));
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    void load();
  }, [favoriteVersion, initialKeyword]);

  const headerCopy = useMemo(() => {
    if (initialKeyword) {
      return {
        title: `搜索 “${initialKeyword}”`,
        description: '按关键词返回当前可售商品。'
      };
    }

    return {
      title: '搜索商品',
      description: '输入关键词查找你想要的闲置。'
    };
  }, [initialKeyword]);

  function submitSearch(keyword: string) {
    const nextKeyword = keyword.trim();
    setSearchInput(keyword);
    setSearchParams(nextKeyword ? { q: nextKeyword } : {});
  }

  function toggleCreditFilter(key: CreditFilterKey) {
    setActiveCreditFilters((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ));
  }

  const visibleProducts = useMemo(() => {
    return [...products]
      .filter((item) => minPrice === null || item.price >= minPrice)
      .filter((item) => maxPrice === null || item.price <= maxPrice)
      .filter((item) => {
        if (!activeCreditFilters.length) {
          return true;
        }

        const score = item.sellerCreditScore ?? 0;
        return activeCreditFilters.some((filter) => {
          return matchesCreditLevel(score, filter);
        });
      })
      .sort((left, right) => {
        if (sortKey === 'price_asc') {
          return left.price - right.price;
        }
        if (sortKey === 'price_desc') {
          return right.price - left.price;
        }
        return 0;
      });
  }, [activeCreditFilters, maxPrice, minPrice, products, sortKey]);

  return (
    <div className="fish-home">
      <section className="fish-search-shell">
        <div className="fish-search-row">
          <div className="fish-search-box">
            <Input
              size="large"
              bordered={false}
              placeholder="搜索手机、电脑、教材、卡券"
              prefix={<SearchOutlined />}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onPressEnter={() => submitSearch(searchInput)}
            />
            <button type="button" className="fish-search-button" onClick={() => submitSearch(searchInput)}>
              搜索
            </button>
          </div>
        </div>
      </section>

      <section className="fish-feed-shell fish-feed-shell-home">
        <div className="fish-feed-header">
          <div>
            <h2>{headerCopy.title}</h2>
            <span>{headerCopy.description}</span>
          </div>
        </div>

        <ResultFilterBar
          tabs={[{ key: 'ALL', label: '所有宝贝' }]}
          activeTab="ALL"
          onTabChange={() => undefined}
          sortOptions={[
            { key: 'relevance', label: '综合' },
            { key: 'price_asc', label: '价格低到高' },
            { key: 'price_desc', label: '价格高到低' }
          ]}
          activeSort={sortKey}
          onSortChange={(key) => setSortKey(key as 'relevance' | 'price_asc' | 'price_desc')}
          minPrice={minPrice}
          maxPrice={maxPrice}
          onMinPriceChange={setMinPrice}
          onMaxPriceChange={setMaxPrice}
          creditOptions={CREDIT_FILTER_OPTIONS}
          activeCredits={activeCreditFilters}
          onCreditToggle={(key) => toggleCreditFilter(key as CreditFilterKey)}
        />

        {loading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : loadError ? (
          <EmptyState className="is-shell" title="搜索暂不可用" description={loadError} />
        ) : (
          <ProductGrid
            items={visibleProducts}
            className="fish-feed-grid"
            emptyState={<EmptyState className="is-shell" title="没有找到相关商品" />}
            renderItem={(item, index) => {
              const status = getListingStatusPresentation(item.status);

              return (
	                <ProductSummaryCard
	                  key={item.id}
	                  className={index % 3 === 2 ? 'offset' : ''}
	                  item={item}
	                  imageSrc={getProductImage(item, index)}
                  priceMeta={`${status.label} · ${item.sellerName}`}
                  tagItems={item.tags.slice(0, 3)}
                  onOpen={() => navigate(`/products/${item.id}`)}
                />
              );
            }}
          />
        )}
      </section>
    </div>
  );
}
