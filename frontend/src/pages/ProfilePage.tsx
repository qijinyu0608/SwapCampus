import {
  AppstoreOutlined,
  EyeOutlined,
  HeartOutlined,
  ShopOutlined,
  ShoppingOutlined,
  StarOutlined
} from '@ant-design/icons';
import { Empty, Skeleton, Tag } from 'antd';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/feedback';
import { SectionHeader } from '../components/layout';
import { ProductGrid, ProductSummaryCard } from '../components/product';
import {
  fetchCampusServiceTasks,
  fetchFavoriteList,
  fetchFollowingUsers,
  fetchBrowsingHistory,
  fetchOrders,
  fetchProducts,
  type CampusServiceListItem,
  type FavoriteItem,
  type FollowingUser,
  type HistoryItem,
  type OrderItem,
  type ProductSummary
} from '../services/api';
import { useAuthState } from '../services/auth-state';
import { hasTradingAccess, isGuestUser } from '../services/session';
import { getProductImage } from '../utils/productCover';
import { getUserPresentation } from '../utils/userPresentation';

type ProfileSection = 'items' | 'orders-buying' | 'orders-selling' | 'favorites' | 'history' | 'following';
type PublishedScope = 'products' | 'campus-services';

type SidebarItem = {
  key: ProfileSection;
  icon: ReactNode;
  label: string;
  count?: number;
};

type RouteState = {
  section?: unknown;
  orderScope?: unknown;
};

const orderStatusMap: Record<string, string> = {
  PENDING: '待约定',
  IN_PROGRESS: '待面交',
  WAITING_REVIEW: '待评价',
  COMPLETED: '已完成',
  CANCELED: '已取消'
};

function getOrderStatusColor(status: string) {
  if (status === 'COMPLETED') {
    return 'green';
  }
  if (status === 'WAITING_REVIEW') {
    return 'gold';
  }
  if (status === 'CANCELED') {
    return 'default';
  }
  return 'orange';
}

export function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuthState();
  const routeState = location.state as RouteState | null;
  const [activeSection, setActiveSection] = useState<ProfileSection>(() => {
    if (routeState?.section === 'favorites') {
      return 'favorites';
    }
    if (routeState?.section === 'history') {
      return 'history';
    }
    if (routeState?.section === 'following') {
      return 'following';
    }
    if (routeState?.section === 'orders') {
      return routeState.orderScope === 'selling' ? 'orders-selling' : 'orders-buying';
    }
    return 'items';
  });
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [campusServices, setCampusServices] = useState<CampusServiceListItem[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [followingUsers, setFollowingUsers] = useState<FollowingUser[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [publishedScope, setPublishedScope] = useState<PublishedScope>('products');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCampusServices, setLoadingCampusServices] = useState(true);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingFollowing, setLoadingFollowing] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (!hasTradingAccess(currentUser) || !currentUser) {
      setProducts([]);
      setCampusServices([]);
      setFavoriteItems([]);
      setHistoryItems([]);
      setFollowingUsers([]);
      setOrders([]);
      setLoadingProducts(false);
      setLoadingCampusServices(false);
      setLoadingFavorites(false);
      setLoadingHistory(false);
      setLoadingFollowing(false);
      setLoadingOrders(false);
      return;
    }

    let cancelled = false;

    setLoadingProducts(true);
    setLoadingCampusServices(true);
    setLoadingFavorites(true);
    setLoadingHistory(true);
    setLoadingFollowing(true);
    setLoadingOrders(true);

    fetchProducts({ sellerId: currentUser.id, status: 'ALL', page: 1, pageSize: 60 })
      .then((result) => {
        if (!cancelled) {
          setProducts(result.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProducts(false);
        }
      });

    fetchCampusServiceTasks({ page: 1, pageSize: 60, sort: 'newest' })
      .then((result) => {
        if (!cancelled) {
          setCampusServices(result.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCampusServices([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCampusServices(false);
        }
      });

    fetchFavoriteList()
      .then((result) => {
        if (!cancelled) {
          setFavoriteItems(result.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFavoriteItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingFavorites(false);
        }
      });

    fetchBrowsingHistory({ page: 1, pageSize: 24 })
      .then((result) => {
        if (!cancelled) {
          setHistoryItems(result.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingHistory(false);
        }
      });

    fetchFollowingUsers({ page: 1, pageSize: 24 })
      .then((result) => {
        if (!cancelled) {
          setFollowingUsers(result.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFollowingUsers([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingFollowing(false);
        }
      });

    fetchOrders({ page: 1, pageSize: 50 })
      .then((result) => {
        if (!cancelled) {
          setOrders(result.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOrders([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingOrders(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const guestMode = isGuestUser(currentUser);
  const userPresentation = getUserPresentation(currentUser);

  const publishedProducts = useMemo(
    () => currentUser
      ? products.filter((item) => item.sellerId === currentUser.id || item.sellerName === currentUser.displayName)
      : [],
    [currentUser, products]
  );

  const publishedCampusServices = useMemo(
    () => currentUser ? campusServices.filter((item) => item.publisher.id === currentUser.id) : [],
    [campusServices, currentUser]
  );

  const buyingOrders = useMemo(
    () => currentUser ? orders.filter((item) => item.buyerId === currentUser.id) : [],
    [currentUser, orders]
  );

  const sellingOrders = useMemo(
    () => currentUser ? orders.filter((item) => item.sellerId === currentUser.id) : [],
    [currentUser, orders]
  );

  const sidebarItems: SidebarItem[] = [
    { key: 'items', icon: <AppstoreOutlined />, label: '我发布的', count: publishedProducts.length + publishedCampusServices.length },
    { key: 'orders-buying', icon: <ShoppingOutlined />, label: '我买到的', count: buyingOrders.length },
    { key: 'orders-selling', icon: <ShopOutlined />, label: '我卖出的', count: sellingOrders.length },
    { key: 'favorites', icon: <StarOutlined />, label: '我的收藏', count: favoriteItems.length },
    { key: 'history', icon: <EyeOutlined />, label: '历史浏览', count: historyItems.length },
    { key: 'following', icon: <HeartOutlined />, label: '我的关注', count: followingUsers.length }
  ];

  function renderPublishedScope() {
    const showingProducts = publishedScope === 'products';

    return (
      <div className="profile-published-panel">
        <div className="profile-order-scope profile-published-scope">
          <button
            type="button"
            className={showingProducts ? 'active' : undefined}
            onClick={() => setPublishedScope('products')}
          >
            常规商品
          </button>
          <button
            type="button"
            className={!showingProducts ? 'active' : undefined}
            onClick={() => setPublishedScope('campus-services')}
          >
            校园服务
          </button>
        </div>
        {showingProducts
          ? renderProductGrid(
            publishedProducts,
            loadingProducts,
            '暂无发布',
            '去首页或发布页上架第一件校园闲置吧。'
          )
          : renderPublishedCampusServices(
            publishedCampusServices,
            loadingCampusServices
          )}
      </div>
    );
  }

  function renderPublishedCampusServices(items: CampusServiceListItem[], loading: boolean) {
    if (loading) {
      return <Skeleton active paragraph={{ rows: 8 }} />;
    }

    if (!items.length) {
      return <EmptyState className="is-shell" title="暂无发布" description="发布校园服务任务后，会在这里看到进度。" />;
    }

    return (
      <ProductGrid
        items={items}
        renderItem={(item) => (
          <ProductSummaryCard
            key={item.id}
            item={item}
            imageSrc="/images/products/demo-square.png"
            className="profile-fish-card service-task-card"
            signal={item.route.label}
            coverMeta={(
              <div className="service-card-cover-stack">
                <span className="service-card-cover-type">{item.serviceType.label}</span>
                <span className="service-card-cover-deadline">{item.deadlineLabel}</span>
              </div>
            )}
            bodyMeta={item.participantSummary.accepterLabel
              ? `${item.participantSummary.publisherLabel} · ${item.participantSummary.accepterLabel}`
              : item.participantSummary.publisherLabel}
            priceValue={item.rewardLabel}
            priceMeta={item.schedule.summary}
            tagItems={item.summaryTags.slice(0, 4)}
            onOpen={() => navigate(`/campus-services/${item.id}`)}
          />
        )}
      />
    );
  }

  useEffect(() => {
    if (routeState?.section === 'favorites') {
      setActiveSection('favorites');
      return;
    }

    if (routeState?.section === 'history') {
      setActiveSection('history');
      return;
    }

    if (routeState?.section === 'following') {
      setActiveSection('following');
      return;
    }

    if (routeState?.section === 'orders') {
      setActiveSection(routeState.orderScope === 'selling' ? 'orders-selling' : 'orders-buying');
      return;
    }
  }, [routeState]);

  function renderProductGrid(
    items: ProductSummary[],
    loading: boolean,
    emptyTitle: string,
    emptyDescription?: string
  ) {
    if (loading) {
      return <Skeleton active paragraph={{ rows: 8 }} />;
    }

    if (!items.length) {
      return <EmptyState className="is-shell" title={emptyTitle} description={emptyDescription} />;
    }

    return (
      <ProductGrid
        items={items}
        renderItem={(item, index) => (
          <ProductSummaryCard
            key={item.id}
            className="profile-fish-card"
            item={item}
            imageSrc={getProductImage(item, index)}
            signal={`${item.category} · ${item.condition}`}
            priceMeta={item.status === 'ON_SALE' ? '同校面交' : '交易留痕'}
            tagItems={[item.status === 'ON_SALE' ? '在售' : item.status]}
            onOpen={() => navigate(`/products/${item.id}`)}
          />
        )}
      />
    );
  }

  function renderSectionPanel(title: string, content: ReactNode, contentClassName?: string) {
    const contentClasses = ['profile-section-content', contentClassName ?? ''].filter(Boolean).join(' ');

    return (
      <section className="profile-section-panel">
        <SectionHeader title={title} className="is-prominent is-spacious" />
        <div className={contentClasses}>{content}</div>
      </section>
    );
  }

  function renderOrderList(items: OrderItem[], loading: boolean, title: string, emptyDescription: string) {
    let content: ReactNode;

    if (loading) {
      content = <Skeleton active paragraph={{ rows: 8 }} />;
    } else if (items.length) {
      content = (
        <div className="compact-list profile-orders-list">
          {items.map((item, index) => (
            <article key={item.id} className="profile-order-card">
              <div className="profile-order-top">
                <div className="profile-order-user">
                  <span>{(item.buyerId === currentUser?.id ? item.sellerName : item.buyerName).slice(0, 1)}</span>
                  <div className="profile-order-user-copy">
                    <strong>{item.productTitle}</strong>
                    <em>{item.productCategory ?? '校园闲置'}</em>
                  </div>
                </div>
                <Tag color={getOrderStatusColor(item.status)}>{orderStatusMap[item.status] ?? item.status}</Tag>
              </div>
              <div className="profile-order-product">
                <img
                  src={item.productImageUrl || getProductImage({
                    id: item.productId,
                    title: item.productTitle,
                    description: '',
                    price: item.productPrice ?? 0,
                    category: item.productCategory ?? '其他',
                    condition: item.productCondition ?? '线下面交',
                    sellerName: item.sellerName,
                    status: item.productStatus ?? 'ON_SALE',
                    tags: []
                  } as ProductSummary, index)}
                  alt={item.productTitle}
                />
                <div>
                  <h3>{item.productTitle}</h3>
                  <p>{item.productCondition ?? '线下面交'}</p>
                  <strong>{item.productPrice === null ? '价格待确认' : `¥${item.productPrice.toFixed(2)}`}</strong>
                  <span>{item.meetupLocation || '待双方约定线下面交时间地点'}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      );
    } else {
      content = <EmptyState className="is-shell" title={`暂无${title}`} description={emptyDescription} />;
    }

    return renderSectionPanel(
      title,
      content,
      items.length || loading ? 'profile-order-board' : 'profile-order-board is-empty'
    );
  }

  function renderFollowingList(items: FollowingUser[], loading: boolean) {
    if (loading) {
      return renderSectionPanel('我的关注', <Skeleton active paragraph={{ rows: 8 }} />);
    }

    if (!items.length) {
      return renderSectionPanel(
        '我的关注',
        <EmptyState className="is-shell" title="暂无关注内容" description="关注常交易的同学后，会在这里看到列表。" />,
        'is-empty'
      );
    }

    return renderSectionPanel(
      '我的关注',
      <div className="compact-list profile-following-list">
        {items.map((item) => {
          const presentation = getUserPresentation(item);

          return (
            <button
              key={item.id}
              type="button"
              className="profile-following-card"
              onClick={() => navigate(`/users/${item.id}`)}
            >
              <div className="profile-following-avatar">{presentation.initial}</div>
              <div className="profile-following-copy">
                <div className="profile-following-head">
                  <strong>{presentation.displayName}</strong>
                  <span>{presentation.creditBadge.label}</span>
                </div>
                <p>{item.college}</p>
                <em>{item.activeProductCount} 件在售 · {item.followerCount} 人关注</em>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  function renderActiveSection() {
    if (activeSection === 'items') {
      return renderSectionPanel(
        '我发布的',
        renderPublishedScope(),
        (publishedScope === 'products'
          ? publishedProducts.length || loadingProducts
          : publishedCampusServices.length || loadingCampusServices)
          ? undefined
          : 'is-empty'
      );
    }

    if (activeSection === 'favorites') {
      return renderSectionPanel(
        '我的收藏',
        renderProductGrid(
          favoriteItems,
          loadingFavorites,
          '暂无收藏',
          '看到心动的商品后点一下收藏，就会出现在这里。'
        ),
        favoriteItems.length || loadingFavorites ? undefined : 'is-empty'
      );
    }

    if (activeSection === 'orders-buying') {
      return renderOrderList(
        buyingOrders,
        loadingOrders,
        '我买到的',
        '下单后会在这里显示最近进度。'
      );
    }

    if (activeSection === 'orders-selling') {
      return renderOrderList(
        sellingOrders,
        loadingOrders,
        '我卖出的',
        '有人购买你发布的商品后会显示进度。'
      );
    }

    if (activeSection === 'history') {
      return renderSectionPanel(
        '历史浏览',
        renderProductGrid(
          historyItems,
          loadingHistory,
          '暂无历史浏览',
          '浏览过的商品会按时间顺序出现在这里。'
        ),
        historyItems.length || loadingHistory ? undefined : 'is-empty'
      );
    }

    return renderFollowingList(followingUsers, loadingFollowing);
  }

  if (!hasTradingAccess(currentUser)) {
    return (
      <div className="page-grid profile-page">
        <EmptyState
          className="is-shell"
          title={guestMode ? '游客模式暂不支持' : '请登录普通用户账号'}
        />
      </div>
    );
  }

  return (
    <div className="page-grid profile-page">
      <div className="profile-shell">
        <aside className="profile-sidebar">
          <div className="profile-menu-panel">
            {sidebarItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={activeSection === item.key ? 'profile-menu-item active is-root' : 'profile-menu-item is-root'}
                onClick={() => setActiveSection(item.key)}
              >
                <span className="profile-menu-item-icon">{item.icon}</span>
                <span>{item.label}</span>
                {typeof item.count === 'number' ? <em>{item.count}</em> : null}
              </button>
            ))}
          </div>
        </aside>

        <div className="profile-main">
          <section className="profile-hero-card">
            <div className="profile-hero-copy">
              <div className="profile-avatar-badge">
                <img src="/images/default-avatar.png" alt="默认头像" />
              </div>
              <div className="profile-hero-meta">
                <div className="profile-hero-title-row">
                  <h1>{userPresentation.displayName}</h1>
                  <div className="profile-hero-badges">
                    <div className={`ui-credit-badge is-${userPresentation.creditBadge.tone}`}>
                      <span className="ui-credit-badge-label">{userPresentation.creditBadge.label}</span>
                    </div>
                    <span>{userPresentation.verificationLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {renderActiveSection()}
        </div>
      </div>
    </div>
  );
}
