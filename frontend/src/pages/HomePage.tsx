import { Input, Skeleton, message } from 'antd';
import {
  AppstoreOutlined,
  BookOutlined,
  CarOutlined,
  LeftOutlined,
  CommentOutlined,
  CreditCardOutlined,
  EditOutlined,
  HeartOutlined,
  HomeOutlined,
  InboxOutlined,
  LaptopOutlined,
  PlayCircleOutlined,
  RightOutlined,
  SearchOutlined,
  SkinOutlined,
  SendOutlined
} from '@ant-design/icons';
import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/feedback';
import { ProductGrid, ProductSummaryCard } from '../components/product';
import {
  PRODUCT_CATEGORY_HOME_GROUPS,
  type ProductCategoryHomeGroupIcon
} from '../constants/productCategories';
import { getBjfuMeetupLabel } from '../constants/campus';
import {
  fetchHomeRecommendations,
  fetchFavoriteList,
  fetchOrders,
  getApiErrorMessage,
  OrderItem,
  ProductSummary
} from '../services/api';
import { useAuthState } from '../services/auth-state';
import { subscribeFavorites, toggleFavorite } from '../services/favorites';
import { useCurrentUserProfileBundle } from '../services/user-profile';
import { getListingStatusPresentation } from '../utils/listingStatus';
import { getProductImage } from '../utils/productCover';

const shortcutGroups = PRODUCT_CATEGORY_HOME_GROUPS;
const categoryIcons: Record<ProductCategoryHomeGroupIcon, ReactNode> = {
  digital: <LaptopOutlined />,
  book: <BookOutlined />,
  dorm: <HomeOutlined />,
  fashion: <SkinOutlined />,
  travel: <CarOutlined />,
  beauty: <HeartOutlined />,
  office: <EditOutlined />,
  ticket: <CreditCardOutlined />,
  fun: <PlayCircleOutlined />,
  other: <AppstoreOutlined />
};

const homeCampaigns = [
  {
    key: 'graduation',
    kicker: '活动主场',
    title: '毕业季清仓',
    subtitle: '13号公寓搬迁专场，今晚图书馆北门可面交',
    description: '以宿舍搬迁、整套打包和当天可取商品为主，适合捡漏和快速成交。',
    pills: ['毕业清仓', '今晚可取', '同校面交'],
    keyword: '毕业',
    image: '/images/home-hero-banner-1.png'
  },
  {
    key: 'textbook',
    kicker: '学期切换',
    title: '下学期教材',
    subtitle: '学研 A / 图书馆自提高频出现',
    description: '教材、笔记、计算器和考试资料混合更新，适合开学前一站式补齐。',
    pills: ['教材资料', '图书馆', '学习区'],
    keyword: '教材',
    image: '/images/home-hero-banner-2.png'
  },
  {
    key: 'dorm',
    kicker: '宿舍换新',
    title: '白名单电器',
    subtitle: '宿舍能用、当面可验、成色清晰',
    description: '台灯、收纳、小电器和桌搭好物集中出现，偏向低风险同校交易。',
    pills: ['宿舍白名单', '当面验货', '桌搭'],
    keyword: '宿舍',
    image: '/images/home-hero-banner-3.png'
  }
] as const;

const orderStatusLabelMap: Record<string, string> = {
  PENDING: '待付款',
  IN_PROGRESS: '待收货',
  WAITING_REVIEW: '待评价',
  COMPLETED: '已完成',
  CANCELED: '已取消'
};

const sellerOrderStatusLabelMap: Record<string, string> = {
  PENDING: '待确认',
  IN_PROGRESS: '待面交',
  WAITING_REVIEW: '待评价',
  COMPLETED: '已完成',
  CANCELED: '已取消'
};

type UserOrderScope = 'buying' | 'selling';

const visibleShortcutGroups = shortcutGroups;
const campaignCount = homeCampaigns.length;

export function HomePage() {
  const navigate = useNavigate();
  const { currentUser } = useAuthState();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [activeShortcutGroup, setActiveShortcutGroup] = useState<string | null>(null);
  const [favoriteVersion, setFavoriteVersion] = useState(0);
  const [activeCampaignIndex, setActiveCampaignIndex] = useState(0);
  const [userOrders, setUserOrders] = useState<OrderItem[]>([]);
  const [userOrderScope, setUserOrderScope] = useState<UserOrderScope>('buying');
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [searchError, setSearchError] = useState('');
  const { presentation: userPresentation } = useCurrentUserProfileBundle(
    currentUser && currentUser.role !== 'GUEST' ? currentUser : null
  );

  useEffect(() => {
    async function load() {
      try {
        const result = await fetchHomeRecommendations();
        setProducts(result);
        setSearchError('');
      } catch (error) {
        setProducts([]);
        setSearchError(getApiErrorMessage(error, '推荐服务当前不可用'));
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    void load();
  }, [currentUser?.id, favoriteVersion]);

  useEffect(() => subscribeFavorites(() => setFavoriteVersion((value) => value + 1)), []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveCampaignIndex((current) => (current + 1) % homeCampaigns.length);
    }, 4800);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.role === 'GUEST') {
      setUserOrders([]);
      setFavoriteCount(0);
      return;
    }

    fetchOrders({
      page: 1,
      pageSize: 12
    })
      .then((result) => setUserOrders(result.items))
      .catch(() => setUserOrders([]));

    fetchFavoriteList()
      .then((result) => setFavoriteCount(result.total))
      .catch(() => setFavoriteCount(0));
  }, [currentUser, favoriteVersion]);

  function submitSearch(keyword: string) {
    if (!canUseSearch) {
      void navigate('/login', { state: { from: '/' } });
      return;
    }

    setSearchInput(keyword);
    const nextKeyword = keyword.trim();
    if (!nextKeyword) {
      return;
    }
    navigate(`/search?q=${encodeURIComponent(nextKeyword)}`);
  }

  function applyKeywordFilter(keyword: string) {
    if (!canUseSearch) {
      void navigate('/login', { state: { from: '/' } });
      return;
    }

    submitSearch(keyword);
  }

  function showPrevCampaign(event?: MouseEvent<HTMLElement>) {
    event?.stopPropagation();
    setActiveCampaignIndex((current) => (current - 1 + campaignCount) % campaignCount);
  }

  function showNextCampaign(event?: MouseEvent<HTMLElement>) {
    event?.stopPropagation();
    setActiveCampaignIndex((current) => (current + 1) % campaignCount);
  }

  const activeShortcutPanel = useMemo(
    () => shortcutGroups.find((item) => item.title === activeShortcutGroup) ?? null,
    [activeShortcutGroup]
  );
  const homeCampaignCards = useMemo(() => {
    const source = products;
    return homeCampaigns.map((campaign, campaignIndex) => {
      const matched = source.filter((item) => {
        const haystack = [item.title, item.description, item.category, item.sellerName, ...item.tags]
          .filter(Boolean)
          .join(' ');
        return haystack.includes(campaign.keyword);
      });
      const items = (matched.length ? matched : source).slice(0, 3);
      return {
        ...campaign,
        items,
        preview: items[0] ?? null,
        index: campaignIndex
      };
    });
  }, [products]);
  const activeCampaign = homeCampaignCards[activeCampaignIndex] ?? homeCampaignCards[0] ?? null;
  const buyingOrders = useMemo(
    () => currentUser ? userOrders.filter((item) => item.buyerId === currentUser.id) : [],
    [currentUser, userOrders]
  );
  const sellingOrders = useMemo(
    () => currentUser ? userOrders.filter((item) => item.sellerId === currentUser.id) : [],
    [currentUser, userOrders]
  );
  const userTickerItems = useMemo(() => {
    const source = buyingOrders.length ? buyingOrders : userOrders;
    return source.slice(0, 6).map((order) => ({
      id: order.id,
      title: order.productTitle,
      status: orderStatusLabelMap[order.status] ?? order.status,
      location: order.meetupLocation || '校内面交进行中'
    }));
  }, [buyingOrders, userOrders]);
  const activeUserOrders = userOrderScope === 'buying' ? buyingOrders : sellingOrders;
  const activeOrderStatusLabels = userOrderScope === 'buying' ? orderStatusLabelMap : sellerOrderStatusLabelMap;
  const userPanelStats = useMemo(() => {
    if (userOrderScope === 'selling') {
      return [
        { key: 'seller-pending', label: '待确认', value: sellingOrders.filter((item) => item.status === 'PENDING').length },
        { key: 'seller-progress', label: '待面交', value: sellingOrders.filter((item) => item.status === 'IN_PROGRESS').length },
        { key: 'seller-review', label: '待评价', value: sellingOrders.filter((item) => item.status === 'WAITING_REVIEW').length },
        { key: 'seller-done', label: '已完成', value: sellingOrders.filter((item) => item.status === 'COMPLETED').length }
      ];
    }

    return [
      { key: 'favorites', label: '收藏', value: favoriteCount },
      { key: 'buying-pending', label: '待确认', value: buyingOrders.filter((item) => item.status === 'PENDING').length },
      { key: 'buying-receive', label: '待收货', value: buyingOrders.filter((item) => item.status === 'IN_PROGRESS').length },
      { key: 'buying-review', label: '待评价', value: buyingOrders.filter((item) => item.status === 'WAITING_REVIEW').length }
    ];
  }, [buyingOrders, favoriteCount, sellingOrders, userOrderScope]);
  const featuredOrder = useMemo(() => {
    return activeUserOrders[0] ?? null;
  }, [activeUserOrders]);
  const userOrderScopeMeta = useMemo(() => ({
    buying: {
      label: '我买到的',
      count: buyingOrders.length,
      emptyTitle: '暂无买到的',
      emptyDesc: '下单后会在这里显示最近进度。',
      stateScope: 'buying'
    },
    selling: {
      label: '我卖出的',
      count: sellingOrders.length,
      emptyTitle: '暂无卖出的',
      emptyDesc: '有人购买你发布的商品后会显示进度。',
      stateScope: 'selling'
    }
  }), [buyingOrders.length, sellingOrders.length]);
  const guestGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 11 && hour < 14) {
      return '中午好';
    }
    if (hour >= 14 && hour < 18) {
      return '下午好';
    }
    if (hour >= 18 || hour < 5) {
      return '晚上好';
    }
    return '上午好';
  }, []);
  const isGuestView = !currentUser || currentUser.role === 'GUEST';
  const canUseSearch = currentUser?.role === 'USER' || currentUser?.role === 'ADMIN';

  function getFavoriteRestriction(item: ProductSummary) {
    if (item.status === 'SOLD') {
      return '商品已售出';
    }
    if (item.status === 'OFFLINE') {
      return '商品已下架';
    }
    if (item.status === 'PENDING') {
      return '商品审核中';
    }
    if (currentUser?.id && item.sellerId === currentUser.id) {
      return '这是你发布的商品';
    }
    return null;
  }

  async function handleToggleFavorite(event: MouseEvent<HTMLButtonElement>, item: ProductSummary) {
    event.stopPropagation();

    const restriction = getFavoriteRestriction(item);
    if (restriction) {
      message.info(restriction);
      return;
    }

    try {
      const nextState = await toggleFavorite(item.id, currentUser);
      setProducts((current) => current.map((product) => product.id === item.id ? {
        ...product,
        isFavorited: nextState,
        favoriteCount: Math.max(0, (product.favoriteCount ?? 0) + (nextState ? 1 : -1))
      } : product));
    } catch {
      return;
    }
  }

  return (
    <div className="fish-home">
      {canUseSearch ? (
        <section className="fish-search-shell fish-home-search">
          <div className="fish-search-row">
            <div className="fish-search-box">
              <Input
                size="large"
                prefix={<SearchOutlined />}
                placeholder="搜索手机、电脑、教材、卡券"
                bordered={false}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onPressEnter={() => submitSearch(searchInput)}
              />
              <button
                type="button"
                className="fish-search-button fish-search-button-home"
                onClick={() => submitSearch(searchInput)}
              >
                搜索
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="fish-market-layout" onMouseLeave={() => setActiveShortcutGroup(null)}>
        <section className="fish-market-category-block">
          <div className="fish-market-category-head">
            <strong>分类</strong>
            {activeShortcutPanel ? <span>{activeShortcutPanel.title}</span> : null}
          </div>
          <div className="fish-category-panel">
            {visibleShortcutGroups.map((item) => (
              <button
                key={item.title}
                type="button"
                className={activeShortcutGroup === item.title ? 'fish-category-row active' : 'fish-category-row'}
                onMouseEnter={() => setActiveShortcutGroup(item.title)}
                onFocus={() => setActiveShortcutGroup(item.title)}
                onClick={() => setActiveShortcutGroup((value) => (value === item.title ? null : item.title))}
              >
                <span className="fish-category-badge" aria-hidden="true">
                  {categoryIcons[item.icon]}
                </span>
                <div className="fish-category-copy">
                  <strong>{item.shortTitle}</strong>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="fish-market-activity">
          {activeShortcutPanel ? (
            <div className="fish-market-detail-stage">
              <div className="fish-category-detail-panel">
                {activeShortcutPanel.rows.map((row) => (
                  <div key={row.label} className="fish-category-detail-row">
                    <button
                      type="button"
                      className="fish-category-detail-label"
                      onClick={() => applyKeywordFilter(row.label)}
                    >
                      {row.label}
                    </button>
                    <div className="fish-category-detail-items">
                      {row.items.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className="fish-category-detail-item"
                          onClick={() => applyKeywordFilter(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="fish-market-activity-stage">
              <div className="fish-home-stage">
                <div className="fish-home-hero-column">
                  {activeCampaign ? (
                    <div
                      className="fish-home-campaign"
                      role="button"
                      tabIndex={0}
                      onClick={() => applyKeywordFilter(activeCampaign.keyword)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          applyKeywordFilter(activeCampaign.keyword);
                          return;
                        }

                        if (event.key === 'ArrowLeft') {
                          showPrevCampaign();
                          return;
                        }

                        if (event.key === 'ArrowRight') {
                          showNextCampaign();
                        }
                      }}
                    >
                      <div
                        className="fish-home-campaign-track"
                        style={{ transform: `translateX(-${activeCampaign.index * 100}%)` }}
                      >
                        {homeCampaignCards.map((campaign) => (
                          <img
                            key={campaign.key}
                            className="fish-home-campaign-image"
                            src={campaign.image}
                            alt={`${campaign.title} 活动展示图`}
                          />
                        ))}
                      </div>
                      <div className="fish-home-campaign-nav" aria-label="活动翻页">
                        <button
                          type="button"
                          className="fish-home-campaign-nav-button"
                          aria-label="上一张活动图"
                          onClick={showPrevCampaign}
                        >
                          <LeftOutlined />
                        </button>
                        <button
                          type="button"
                          className="fish-home-campaign-nav-button"
                          aria-label="下一张活动图"
                          onClick={showNextCampaign}
                        >
                          <RightOutlined />
                        </button>
                      </div>
                      <div className="fish-home-campaign-dots" aria-hidden="true">
                        {homeCampaignCards.map((campaign, index) => (
                          <span
                            key={campaign.key}
                            className={index === activeCampaign.index ? 'active' : undefined}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <aside className="fish-home-user-panel">
                  {isGuestView ? (
                    <div className="fish-home-user-guest">
                      <div className="fish-home-user-guest-top">
                        <span className="fish-home-user-guest-avatar">
                          <img src="/images/default-avatar.png" alt="默认头像" />
                        </span>
                        <span className="fish-home-user-guest-kicker">{guestGreeting}！</span>
                      </div>
                      <div className="fish-home-user-guest-copy">
                        <strong>登录后查看收藏、订单、发布</strong>
                        <p>管理教材、数码和宿舍闲置交易</p>
                      </div>
                      <div className="fish-home-user-guest-actions">
                        <button
                          type="button"
                          className="fish-home-user-guest-login"
                          onClick={() => navigate('/login', { state: { from: '/', mode: 'login' } })}
                        >
                          立即登录
                        </button>
                        <button
                          type="button"
                          className="fish-home-user-guest-register"
                          onClick={() => navigate('/login', { state: { from: '/', mode: 'register' } })}
                        >
                          还没有账号？去注册
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="fish-home-user-profile">
                        <div className="fish-home-user-head">
                          <span className="fish-home-user-avatar">
                            <img src="/images/default-avatar.png" alt="默认头像" />
                          </span>
                          <div className="fish-home-user-copy">
                            <strong>{currentUser.displayName}</strong>
                            <div className={`ui-credit-badge is-${userPresentation.creditBadge.tone}`}>
                              {userPresentation.creditBadge.label}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="fish-home-user-order-tabs" role="tablist" aria-label="交易栏目">
                        {(['buying', 'selling'] as const).map((scope) => (
                          <button
                            key={scope}
                            type="button"
                            role="tab"
                            aria-selected={userOrderScope === scope}
                            className={userOrderScope === scope ? 'active' : undefined}
                            onClick={() => setUserOrderScope(scope)}
                          >
                            <span>{userOrderScopeMeta[scope].label}</span>
                            <strong>{userOrderScopeMeta[scope].count}</strong>
                          </button>
                        ))}
                      </div>

                      <div className="fish-home-user-stats">
                        {userPanelStats.map((item) => (
                          <div
                            key={item.key}
                            className="fish-home-user-stat"
                          >
                            <strong>{item.value}</strong>
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="fish-home-user-order-card"
                        onClick={() => navigate('/profile', {
                          state: {
                            section: 'orders',
                            orderScope: userOrderScopeMeta[userOrderScope].stateScope
                          }
                        })}
                      >
                        {featuredOrder ? (
                          <>
                            <img
                              className="fish-home-user-order-image"
                              src={featuredOrder.productImageUrl || '/images/products/demo-square.png'}
                              alt={featuredOrder.productTitle}
                            />
                            <div className="fish-home-user-order-copy">
                              <div className="fish-home-user-panel-head">
                                <strong>{activeOrderStatusLabels[featuredOrder.status] ?? featuredOrder.status}</strong>
                                <span>{userOrderScopeMeta[userOrderScope].label}</span>
                              </div>
                              <h3>{featuredOrder.productTitle}</h3>
                              <p>
                                {featuredOrder.meetupLocation
                                  || (userOrderScope === 'buying' ? `卖家 ${featuredOrder.sellerName}` : `买家 ${featuredOrder.buyerName}`)}
                              </p>
                            </div>
                          </>
                        ) : (
                          <div className="fish-home-user-order-empty">
                            <div className="fish-home-user-panel-head">
                              <strong>{userOrderScopeMeta[userOrderScope].emptyTitle}</strong>
                              <span>{userOrderScopeMeta[userOrderScope].label}</span>
                            </div>
                            <p>{userOrderScopeMeta[userOrderScope].emptyDesc}</p>
                          </div>
                        )}
                      </button>
                    </>
                  )}
                </aside>
              </div>
            </div>
          )}
        </section>
      </section>

      <section className="fish-feed-shell fish-feed-shell-home">
        <div className="fish-feed-header">
          <div className="fish-feed-header-badge">
            <h2>
              <span className="fish-feed-title-heart" aria-hidden="true">♥</span>
              <span>猜你喜欢</span>
              <span className="fish-feed-title-heart" aria-hidden="true">♥</span>
            </h2>
          </div>
        </div>

        {loading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : searchError ? (
          <EmptyState
            className="is-shell"
            title="推荐暂不可用"
            description={searchError}
          />
        ) : (
          <ProductGrid
            items={products}
            className="fish-feed-grid"
            emptyState={<EmptyState className="is-shell" title="暂时还没有推荐内容" description="稍后再来看看新上架和热门闲置。" />}
            renderItem={(item, index) => {
              const status = getListingStatusPresentation(item.status);
              const meetupLabel = getBjfuMeetupLabel(index);
              const coverSignal = `${item.category} · ${item.condition}`;
              const isFavorited = Boolean(item.isFavorited);
              const favoriteRestriction = getFavoriteRestriction(item);
              return (
                <ProductSummaryCard
                  key={item.id}
                  className={index % 3 === 2 ? 'offset' : ''}
                  item={item}
                  imageSrc={getProductImage(item, index)}
                  signal={coverSignal}
                  coverActions={(
                    <button
                      type="button"
                      className={isFavorited ? 'fish-item-favorite active' : 'fish-item-favorite'}
                      onClick={(event) => void handleToggleFavorite(event, item)}
                      aria-label={isFavorited ? '取消收藏' : '收藏商品'}
                      disabled={Boolean(favoriteRestriction) && !isFavorited}
                      title={favoriteRestriction ?? undefined}
                    >
                      {isFavorited ? '已想要' : favoriteRestriction ?? '想要'}
                    </button>
                  )}
                  priceMeta={item.status !== 'ON_SALE' ? status.label : `${item.favoriteCount ?? 0} 人想要`}
                  tagItems={[
                    item.sellerName,
                    meetupLabel,
                    '同校面交'
                  ]}
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
