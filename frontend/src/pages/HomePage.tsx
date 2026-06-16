import { Input, Skeleton, message } from 'antd';
import {
  AppstoreOutlined,
  BookOutlined,
  CarOutlined,
  LeftOutlined,
  CreditCardOutlined,
  EditOutlined,
  HeartOutlined,
  HomeOutlined,
  LaptopOutlined,
  PlayCircleOutlined,
  RightOutlined,
  SearchOutlined,
  SkinOutlined
} from '@ant-design/icons';
import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/feedback';
import { CreditBadge } from '../components/ui';
import { ProductGrid, ProductSummaryCard } from '../components/product';
import {
  PRODUCT_CATEGORY_HOME_GROUPS,
  type ProductCategoryHomeGroupIcon
} from '../constants/productCategories';
import {
  fetchCampusServiceOrders,
  fetchHomeRecommendations,
  fetchOrders,
  type CampusServiceOrderListItem,
  getApiErrorMessage,
  OrderItem,
  ProductSummary
} from '../services/api';
import { useAuthState } from '../services/auth-state';
import { subscribeFavorites } from '../services/favorites';
import { useCurrentUserProfileBundle } from '../services/user-profile';
import { UserNameWithBadge } from '../components/user/UserNameWithBadge';
import { type AvatarFrameKey, UserAvatar } from '../components/user/UserAvatar';
import { getListingStatusPresentation } from '../utils/listingStatus';
import { getProductImage, resolvePrimaryProductImage } from '../utils/productCover';

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
type UserPanelMode = 'product' | 'service';
type ServiceParticipationScope = 'provider' | 'booking';

type HomeOrderPanelItem = {
  kind: 'product' | 'service';
  id: number;
  title: string;
  imageSrc: string;
  statusLabel: string;
  scopeLabel: string;
  counterpartLabel: string;
  panelMode: UserPanelMode;
  section: 'orders';
  orderScope: 'buying' | 'selling' | 'provider' | 'booking';
  priority: number;
  createdAt: string;
};

function getProductOrderPriority(status: string) {
  if (status === 'WAITING_REVIEW') {
    return 0;
  }

  if (status === 'IN_PROGRESS') {
    return 1;
  }

  if (status === 'PENDING') {
    return 2;
  }

  if (status === 'COMPLETED') {
    return 3;
  }

  if (status === 'CANCELED') {
    return 4;
  }

  return 5;
}

function getServiceOrderPriority(status: CampusServiceOrderListItem['orderStatus']) {
  if (status === 'WAITING_COMPLETE_CONFIRM') {
    return 0;
  }

  if (status === 'CONFIRMED') {
    return 1;
  }

  if (status === 'PENDING_CONFIRMATION') {
    return 2;
  }

  if (status === 'COMPLETED') {
    return 3;
  }

  if (status === 'CANCELED') {
    return 4;
  }

  if (status === 'REJECTED') {
    return 5;
  }

  if (status === 'EXPIRED') {
    return 6;
  }

  return 7;
}

function parseSortTime(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function comparePanelItems(a: HomeOrderPanelItem, b: HomeOrderPanelItem) {
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }

  return parseSortTime(b.createdAt) - parseSortTime(a.createdAt);
}

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
  const [campusServiceOrders, setCampusServiceOrders] = useState<CampusServiceOrderListItem[]>([]);
  const [userOrderScope, setUserOrderScope] = useState<UserOrderScope>('buying');
  const [userOrderScopeTouched, setUserOrderScopeTouched] = useState(false);
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
      setCampusServiceOrders([]);
      return;
    }

    Promise.all([
      fetchOrders({
        page: 1,
        pageSize: 12
      }),
      fetchCampusServiceOrders({
        page: 1,
        pageSize: 12
      })
    ])
      .then(([orderResult, serviceOrderResult]) => {
        setUserOrders(orderResult.items);
        setCampusServiceOrders(serviceOrderResult.items);
      })
      .catch(() => {
        setUserOrders([]);
        setCampusServiceOrders([]);
      });
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

  function showCampaignUnboundTip() {
    message.info('尚未绑定');
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
  const providerServiceOrders = useMemo(
    () => campusServiceOrders.filter((item) => item.role === 'PROVIDER'),
    [campusServiceOrders]
  );
  const bookingServiceOrders = useMemo(
    () => campusServiceOrders.filter((item) => item.role === 'REQUESTER'),
    [campusServiceOrders]
  );
  const userPanelMode = useMemo<UserPanelMode>(() => {
    if (providerServiceOrders.length || bookingServiceOrders.length) {
      const serviceTopPriority = Math.min(
        ...[...providerServiceOrders, ...bookingServiceOrders].map((item) => getServiceOrderPriority(item.orderStatus))
      );
      const productTopPriority = Math.min(
        ...[...buyingOrders, ...sellingOrders].map((item) => getProductOrderPriority(item.status))
      );

      if (
        Number.isFinite(serviceTopPriority)
        && (!Number.isFinite(productTopPriority) || serviceTopPriority <= productTopPriority)
      ) {
        return 'service';
      }
    }

    return 'product';
  }, [bookingServiceOrders, buyingOrders, providerServiceOrders, sellingOrders]);
  const currentScopeTabs = useMemo(() => {
    if (userPanelMode === 'service') {
      return [
        { key: 'buying' as const, label: '我预约的服务', count: bookingServiceOrders.length },
        { key: 'selling' as const, label: '我接的单', count: providerServiceOrders.length }
      ];
    }

    return [
      { key: 'buying' as const, label: '我买到的', count: buyingOrders.length },
      { key: 'selling' as const, label: '我卖出的', count: sellingOrders.length }
    ];
  }, [bookingServiceOrders.length, buyingOrders.length, providerServiceOrders.length, sellingOrders.length, userPanelMode]);
  useEffect(() => {
    setUserOrderScopeTouched(false);
  }, [currentUser?.id, userPanelMode]);

  useEffect(() => {
    if (userOrderScopeTouched) {
      return;
    }

    if (userPanelMode === 'service') {
      if (bookingServiceOrders.length === 0 && providerServiceOrders.length > 0 && userOrderScope !== 'selling') {
        setUserOrderScope('selling');
        return;
      }

      if (providerServiceOrders.length === 0 && bookingServiceOrders.length > 0 && userOrderScope !== 'buying') {
        setUserOrderScope('buying');
      }

      return;
    }

    if (buyingOrders.length === 0 && sellingOrders.length > 0 && userOrderScope !== 'selling') {
      setUserOrderScope('selling');
      return;
    }

    if (sellingOrders.length === 0 && buyingOrders.length > 0 && userOrderScope !== 'buying') {
      setUserOrderScope('buying');
    }
  }, [
    bookingServiceOrders.length,
    buyingOrders.length,
    providerServiceOrders.length,
    sellingOrders.length,
    userOrderScope,
    userOrderScopeTouched,
    userPanelMode
  ]);
  const activeUserOrders = userOrderScope === 'buying' ? buyingOrders : sellingOrders;
  const activeOrderStatusLabels = userOrderScope === 'buying' ? orderStatusLabelMap : sellerOrderStatusLabelMap;
  const userPanelStats = useMemo(() => {
    if (userPanelMode === 'service') {
      const activeServiceOrders = userOrderScope === 'buying' ? bookingServiceOrders : providerServiceOrders;
      const pendingLabel = userOrderScope === 'buying' ? '待确认' : '待接单';
      const progressLabel = userOrderScope === 'buying' ? '进行中' : '待完工';

      return [
        {
          key: 'service-pending',
          label: pendingLabel,
          value: activeServiceOrders.filter((item) => item.orderStatus === 'PENDING_CONFIRMATION').length
        },
        {
          key: 'service-progress',
          label: progressLabel,
          value: activeServiceOrders.filter((item) => (
            item.orderStatus === 'CONFIRMED' || item.orderStatus === 'WAITING_COMPLETE_CONFIRM'
          )).length
        }
      ];
    }

    if (userOrderScope === 'selling') {
      return [
        { key: 'seller-pending', label: '待确认', value: sellingOrders.filter((item) => item.status === 'PENDING').length },
        { key: 'seller-progress', label: '待面交', value: sellingOrders.filter((item) => item.status === 'IN_PROGRESS').length }
      ];
    }

    return [
      { key: 'buying-receive', label: '待收货', value: buyingOrders.filter((item) => item.status === 'IN_PROGRESS').length },
      { key: 'buying-review', label: '待评价', value: buyingOrders.filter((item) => item.status === 'WAITING_REVIEW').length }
    ];
  }, [bookingServiceOrders, buyingOrders, providerServiceOrders, sellingOrders, userOrderScope, userPanelMode]);
  const activeServiceOrders = useMemo(
    () => userOrderScope === 'buying' ? bookingServiceOrders : providerServiceOrders,
    [bookingServiceOrders, providerServiceOrders, userOrderScope]
  );
  const userOrderScopeMeta = useMemo(() => ({
    buying: userPanelMode === 'service'
      ? {
          label: '我预约的服务',
          count: bookingServiceOrders.length,
          emptyTitle: '暂无预约服务',
          emptyDesc: '当前没有和校园服务相关的预约记录。',
          stateScope: 'booking' as const
        }
      : {
          label: '我买到的',
          count: buyingOrders.length,
          emptyTitle: '暂无买到的',
          emptyDesc: '当前没有商品买入订单。',
          stateScope: 'buying' as const
        },
    selling: userPanelMode === 'service'
      ? {
          label: '我接的单',
          count: providerServiceOrders.length,
          emptyTitle: '暂无接单记录',
          emptyDesc: '当前没有校园服务接单记录。',
          stateScope: 'provider' as const
        }
      : {
          label: '我卖出的',
          count: sellingOrders.length,
          emptyTitle: '暂无卖出的',
          emptyDesc: '当前没有商品卖出订单。',
          stateScope: 'selling' as const
        }
  }), [bookingServiceOrders.length, buyingOrders.length, providerServiceOrders.length, sellingOrders.length, userPanelMode]);
  const featuredOrder = useMemo<HomeOrderPanelItem | null>(() => {
    if (userPanelMode === 'service') {
      const scopeLabel = userOrderScope === 'buying' ? '我预约的服务' : '我接的单';
      const scopeKey: ServiceParticipationScope = userOrderScope === 'buying' ? 'booking' : 'provider';
      const serviceItems = activeServiceOrders
        .map((item) => ({
          kind: 'service' as const,
          id: item.id,
          title: item.title,
          imageSrc: resolvePrimaryProductImage({
            title: item.title,
            category: item.categoryLabel,
            price: item.reward,
            imageUrl: item.imageUrl
          }, item.id),
          statusLabel: item.orderStatusLabel,
          scopeLabel,
          counterpartLabel: `对方 ${item.counterpart.displayName}`,
          panelMode: 'service' as const,
          section: 'orders' as const,
          orderScope: scopeKey,
          priority: getServiceOrderPriority(item.orderStatus),
          createdAt: item.createdAt
        }))
        .sort(comparePanelItems);

      return serviceItems[0] ?? null;
    }

    const productItems = activeUserOrders
      .map((item) => ({
        kind: 'product' as const,
        id: item.id,
        title: item.productTitle,
        imageSrc: item.productImageUrl || '/images/products/demo-square.png',
        statusLabel: activeOrderStatusLabels[item.status] ?? item.status,
        scopeLabel: userOrderScopeMeta[userOrderScope].label,
        counterpartLabel: item.meetupLocation
          || (userOrderScope === 'buying' ? `卖家 ${item.sellerName}` : `买家 ${item.buyerName}`),
        panelMode: 'product' as const,
        section: 'orders' as const,
        orderScope: userOrderScope,
        priority: getProductOrderPriority(item.status),
        createdAt: item.createdAt
      }))
      .sort(comparePanelItems);

    return productItems[0] ?? null;
  }, [activeOrderStatusLabels, activeServiceOrders, activeUserOrders, userOrderScope, userOrderScopeMeta, userPanelMode]);
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
                      onClick={showCampaignUnboundTip}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          showCampaignUnboundTip();
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
                          <UserAvatar alt="默认头像" fallbackLabel={guestGreeting.slice(0, 1)} />
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
                            <UserAvatar
                              src={userPresentation.avatarUrl}
                              alt={`${currentUser.displayName}的头像`}
                              fallbackLabel={userPresentation.initial}
                              frame={(userPresentation.avatarFrame as AvatarFrameKey | null) ?? undefined}
                            />
                          </span>
                          <div className="fish-home-user-copy">
                            <UserNameWithBadge
                              as="strong"
                              name={currentUser.displayName}
                              trustedBadgeUnlocked={userPresentation.trustedBadgeUnlocked}
                            />
                            <CreditBadge
                              tone={userPresentation.creditBadge.tone}
                              label={userPresentation.creditBadge.label}
                            />
                          </div>
                        </div>
                      </div>

                        <div className="fish-home-user-order-tabs" role="tablist" aria-label="交易栏目">
                        {currentScopeTabs.map((tab) => (
                          <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={userOrderScope === tab.key}
                            className={userOrderScope === tab.key ? 'active' : undefined}
                            onClick={() => {
                              setUserOrderScopeTouched(true);
                              setUserOrderScope(tab.key);
                            }}
                          >
                            <span>{tab.label}</span>
                            <strong>{tab.count}</strong>
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
                            section: featuredOrder?.section ?? 'orders',
                            orderScope: featuredOrder?.orderScope ?? userOrderScopeMeta[userOrderScope].stateScope
                          }
                        })}
                      >
                        {featuredOrder ? (
                          <>
                            <img
                              className="fish-home-user-order-image"
                              src={featuredOrder.imageSrc}
                              alt={featuredOrder.title}
                            />
                            <div className="fish-home-user-order-copy">
                              <div className="fish-home-user-panel-head">
                                <strong>{featuredOrder.statusLabel}</strong>
                              </div>
                              <h3>{featuredOrder.title}</h3>
                              <p>{featuredOrder.counterpartLabel}</p>
                            </div>
                          </>
                        ) : (
                          <div className="fish-home-user-order-empty">
                            <div className="fish-home-user-panel-head">
                              <strong>{userOrderScopeMeta[userOrderScope].emptyTitle}</strong>
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
            emptyState={<EmptyState className="is-shell" title="暂无推荐内容" />}
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
        )}
      </section>
    </div>
  );
}
