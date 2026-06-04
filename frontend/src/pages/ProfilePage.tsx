import {
  SettingOutlined,
  ShoppingOutlined,
  StarOutlined,
  UserOutlined
} from '@ant-design/icons';
import { Button, Empty, Form, Input, Modal, Pagination, Rate, Skeleton, Tag, message } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MetricBarChart } from '../components/MetricBarChart';
import {
  cancelOrder,
  completeOrderMeetup,
  confirmOrderMeetup,
  createOrderReview,
  fetchOrders,
  fetchProducts,
  fetchUserProfile,
  fetchUserTrustSummary,
  getApiErrorMessage,
  OrderItem,
  ProductSummary,
  UserProfile,
  UserTrustSummary,
  updateUserProfile
} from '../services/api';
import { getFavoriteIds, subscribeFavorites } from '../services/favorites';
import {
  DemoUser,
  getDemoUser,
  getRoleLabel,
  hasTradingAccess,
  isGuestUser,
  saveDemoUser
} from '../services/session';
import { getProductImage } from '../utils/productCover';

const orderStatusMap: Record<string, string> = {
  PENDING: '待约定',
  IN_PROGRESS: '待面交',
  WAITING_REVIEW: '待评价',
  COMPLETED: '已完成',
  CANCELED: '已取消'
};

const ORDER_PAGE_SIZE = 6;

const orderFilterTabs = [
  { key: 'ALL', label: '全部' },
  { key: 'PENDING', label: '待约定' },
  { key: 'IN_PROGRESS', label: '待面交' },
  { key: 'WAITING_REVIEW', label: '待评价' },
  { key: 'COMPLETED', label: '已完成' },
  { key: 'CANCELED', label: '已取消' }
] as const;

type ProfileFormValues = {
  name: string;
  email: string;
  realName: string;
  college: string;
  phone: string;
};

type ProfileSection = 'items' | 'orders' | 'favorites' | 'profile';
type OrderScope = 'all' | 'buying' | 'selling';
type OrderFilter = typeof orderFilterTabs[number]['key'];
type OrderActionMode = 'meetup' | 'cancel' | 'review';

type OrderActionFormValues = {
  meetupLocation?: string;
  note?: string;
  reason?: string;
  content?: string;
};

function getCreditBadge(score: number) {
  if (score >= 85) {
    return '卖家信用极好';
  }
  if (score >= 70) {
    return '卖家信用良好';
  }
  return '信用稳定';
}

function formatIdentity(verified?: boolean) {
  return verified ? '已实名' : '待实名';
}

export function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as { section?: unknown; orderScope?: unknown } | null;
  const [form] = Form.useForm<ProfileFormValues>();
  const [orderForm] = Form.useForm<OrderActionFormValues>();
  const [user, setUser] = useState<DemoUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [productLoading, setProductLoading] = useState(true);
  const [, setFavoriteVersion] = useState(0);
  const initialSection = routeState?.section === 'orders' ? 'orders' : 'items';
  const initialOrderScope = routeState?.orderScope === 'buying' || routeState?.orderScope === 'selling'
    ? routeState.orderScope
    : 'all';
  const [activeSection, setActiveSection] = useState<ProfileSection>(initialSection);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [trustSummary, setTrustSummary] = useState<UserTrustSummary | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderTotalPages, setOrderTotalPages] = useState(1);
  const [orderScope, setOrderScope] = useState<OrderScope>(initialOrderScope);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('ALL');
  const [orderActionMode, setOrderActionMode] = useState<OrderActionMode | null>(null);
  const [activeOrder, setActiveOrder] = useState<OrderItem | null>(null);
  const [orderActionLoading, setOrderActionLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);

  async function loadOrders(userId: number, page: number) {
    setOrdersLoading(true);
    try {
      const result = await fetchOrders({
        userId,
        page,
        pageSize: ORDER_PAGE_SIZE
      });
      setOrders(result.items);
      setOrderPage(result.pagination.page);
      setOrderTotal(result.pagination.total);
      setOrderTotalPages(result.pagination.totalPages);
    } catch {
      setOrders([]);
      setOrderPage(page);
      setOrderTotal(0);
      setOrderTotalPages(1);
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    const currentUser = getDemoUser();
    setUser(currentUser);

    if (!hasTradingAccess(currentUser)) {
      setProfile(null);
      setProducts([]);
      setOrders([]);
      setOrderPage(1);
      setOrderTotal(0);
      setOrderTotalPages(1);
      setTrustSummary(null);
      setProductLoading(false);
      return;
    }

    const activeUser = currentUser;
    if (!activeUser) {
      return;
    }

    setProductLoading(true);
    fetchUserProfile(activeUser.id)
      .then((result) => {
        setProfile(result);
        form.setFieldsValue({
          name: result.name,
          email: result.email,
          realName: result.realName,
          college: result.college,
          phone: result.phone
        });
      })
      .catch(() => setProfile(null));

    fetchProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setProductLoading(false));

    void loadOrders(activeUser.id, 1);
    fetchUserTrustSummary(activeUser.id).then(setTrustSummary).catch(() => setTrustSummary(null));
  }, [form]);

  useEffect(() => subscribeFavorites(() => setFavoriteVersion((value) => value + 1)), []);

  async function handleSaveProfile(values: ProfileFormValues) {
    if (!user) {
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await updateUserProfile(user.id, values);
      setProfile(updated);
      setEditingProfile(false);
      setTrustSummary((current) => current ? {
        ...current,
        name: updated.name,
        email: updated.email,
        college: updated.college,
        verified: updated.verified,
        identityStatus: updated.identityStatus
      } : current);

      const nextUser: DemoUser = {
        ...user,
        name: updated.name,
        email: updated.email,
        studentId: updated.studentId,
        creditScore: updated.creditScore,
        verified: updated.verified
      };
      setUser(nextUser);
      saveDemoUser(nextUser);
      message.success('个人资料已更新');
    } catch (error) {
      message.error(getApiErrorMessage(error, '更新失败，请稍后重试'));
    } finally {
      setSavingProfile(false);
    }
  }

  function openProfileEditor() {
    if (profile) {
      form.setFieldsValue({
        name: profile.name,
        email: profile.email,
        realName: profile.realName,
        college: profile.college,
        phone: profile.phone
      });
    }
    setActiveSection('profile');
    setEditingProfile(true);
  }

  function openProfileDetail() {
    setActiveSection('profile');
    setEditingProfile(false);
  }

  function openOrderAction(mode: OrderActionMode, order: OrderItem) {
    setOrderActionMode(mode);
    setActiveOrder(order);
    setReviewRating(5);
    orderForm.setFieldsValue({
      meetupLocation: order.meetupLocation ?? '',
      note: order.note ?? '',
      reason: '',
      content: ''
    });
  }

  function closeOrderAction() {
    setOrderActionMode(null);
    setActiveOrder(null);
    setReviewRating(5);
    orderForm.resetFields();
  }

  function openOrderConversation(order: OrderItem) {
    if (order.conversationId) {
      void navigate('/messages', { state: { conversationId: order.conversationId, channel: 'trade' } });
      return;
    }

    void navigate('/messages');
  }

  async function refreshOrderRelatedData(page = orderPage) {
    if (!user) {
      return;
    }

    await loadOrders(user.id, page);
    fetchUserTrustSummary(user.id).then(setTrustSummary).catch(() => setTrustSummary(null));
    fetchProducts().then(setProducts).catch(() => setProducts([]));
  }

  async function handleOrderActionSubmit() {
    if (!user || !activeOrder || !orderActionMode) {
      return;
    }

    const values = await orderForm.validateFields().catch(() => null);
    if (!values) {
      return;
    }

    setOrderActionLoading(true);
    try {
      if (orderActionMode === 'meetup') {
        await confirmOrderMeetup(activeOrder.id, {
          userId: user.id,
          meetupLocation: values.meetupLocation,
          note: values.note
        });
        message.success('已确认线下面交安排');
      } else if (orderActionMode === 'cancel') {
        await cancelOrder(activeOrder.id, {
          userId: user.id,
          reason: values.reason
        });
        message.success('订单已取消，商品将恢复可交易');
      } else {
        await createOrderReview(activeOrder.id, {
          reviewerId: user.id,
          rating: reviewRating,
          content: values.content
        });
        message.success('评价已提交，订单已完成');
      }

      closeOrderAction();
      await refreshOrderRelatedData();
    } catch (error) {
      message.error(getApiErrorMessage(error, '订单操作失败，请稍后重试'));
    } finally {
      setOrderActionLoading(false);
    }
  }

  async function handleCompleteMeetup(order: OrderItem) {
    if (!user) {
      return;
    }

    setOrderActionLoading(true);
    try {
      await completeOrderMeetup(order.id, { userId: user.id });
      message.success('已确认线下面交完成，请补充评价');
      await refreshOrderRelatedData();
    } catch (error) {
      message.error(getApiErrorMessage(error, '确认完成失败，请稍后重试'));
    } finally {
      setOrderActionLoading(false);
    }
  }

  function getOrderCounterpart(order: OrderItem) {
    if (!user) {
      return '同校同学';
    }

    return order.buyerId === user.id ? order.sellerName : order.buyerName;
  }

  function getOrderRoleLabel(order: OrderItem) {
    if (!user) {
      return '交易订单';
    }

    return order.buyerId === user.id ? '我买到的' : '我卖出的';
  }

  function getOrderStatusColor(status: string) {
    if (status === 'COMPLETED') {
      return 'green';
    }
    if (status === 'CANCELED') {
      return 'default';
    }
    if (status === 'WAITING_REVIEW') {
      return 'gold';
    }
    return 'orange';
  }

  function formatOrderPrice(value: number | null) {
    return value === null ? '价格待确认' : `¥${value.toFixed(2)}`;
  }

  const roleLabel = user ? getRoleLabel(user.role) : '--';
  const guestMode = isGuestUser(user);
  const canEditProfile = !!user && hasTradingAccess(user) && !!profile;
  const favoriteIds = getFavoriteIds(user);
  const publishedProducts = user
    ? products.filter((item) => item.sellerId === user.id || item.sellerName === user.name)
    : [];
  const favoriteProducts = products.filter((item) => favoriteIds.includes(item.id));
  const creditScore = trustSummary?.creditScore ?? profile?.creditScore ?? user?.creditScore ?? 60;
  const activeOrderCount = trustSummary?.activeOrders ?? orders.filter((item) => item.status === 'IN_PROGRESS' || item.status === 'PENDING').length;
  const completedOrderCount = trustSummary?.completedOrders ?? orders.filter((item) => item.status === 'COMPLETED').length;
  const latestOrder = orderPage === 1 ? orders[0] : null;
  const scopedOrders = orders.filter((item) => {
    if (!user || orderScope === 'all') {
      return true;
    }

    return orderScope === 'buying' ? item.buyerId === user.id : item.sellerId === user.id;
  });
  const visibleOrders = scopedOrders.filter((item) => orderFilter === 'ALL' || item.status === orderFilter);
  const identityLabel = formatIdentity(trustSummary?.verified ?? profile?.verified ?? user?.verified);
  const collegeLabel = profile?.college ?? trustSummary?.college ?? '同校用户';
  const profileChartItems = !guestMode && user ? [
    {
      label: '信用',
      value: creditScore,
      displayValue: String(creditScore),
      tone: 'amber' as const
    },
    {
      label: '进行中',
      value: activeOrderCount,
      displayValue: String(activeOrderCount),
      tone: 'green' as const
    },
    {
      label: '已完成',
      value: completedOrderCount,
      displayValue: String(completedOrderCount),
      tone: 'blue' as const
    },
    {
      label: '订单',
      value: orderTotal,
      displayValue: String(orderTotal),
      tone: 'amber' as const
    }
  ] : [];

  function renderProductGrid(items: ProductSummary[], emptyTitle: string, emptyDescription: string) {
    if (productLoading) {
      return <Skeleton active paragraph={{ rows: 8 }} />;
    }

    if (!items.length) {
      return (
        <div className="profile-empty-panel">
          <strong>{emptyTitle}</strong>
          <span>{emptyDescription}</span>
        </div>
      );
    }

    return (
      <div className="profile-fish-grid">
        {items.map((item, index) => (
          <article
            key={item.id}
            className={`fish-item-card profile-fish-card ${index % 4 === 3 ? 'offset' : ''}`}
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
                <span>{item.status === 'ON_SALE' ? '同校面交' : '交易留痕'}</span>
              </div>
              <div className="fish-item-meta">
                <span>{item.sellerName}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (!hasTradingAccess(user)) {
    return (
      <div className="page-grid profile-page">
        <div className="profile-empty-shell">
          <Empty description={guestMode ? '游客模式下暂不支持个人资料页' : '请使用普通用户账号进入个人中心'} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-grid profile-page">
      <div className="profile-shell">
        <aside className="profile-sidebar">
          <div className="profile-sidebar-panel">
            <button
              type="button"
              className={activeSection === 'items' ? 'profile-side-item active' : 'profile-side-item'}
              onClick={() => setActiveSection('items')}
            >
              <span className="profile-side-icon"><UserOutlined /></span>
              <strong>我的闲置</strong>
            </button>

            <div className="profile-side-group">
              <div className="profile-side-group-title">
                <span className="profile-side-icon"><ShoppingOutlined /></span>
                <strong>我的交易</strong>
              </div>
              <button
                type="button"
                className={activeSection === 'items' ? 'profile-side-subitem active' : 'profile-side-subitem'}
                onClick={() => setActiveSection('items')}
              >
                我发布的
              </button>
              <button
                type="button"
                className={activeSection === 'orders' && orderScope === 'all' ? 'profile-side-subitem active' : 'profile-side-subitem'}
                onClick={() => {
                  setActiveSection('orders');
                  setOrderScope('all');
                }}
              >
                我的订单
              </button>
              <button
                type="button"
                className={activeSection === 'orders' && orderScope === 'selling' ? 'profile-side-subitem active' : 'profile-side-subitem'}
                onClick={() => {
                  setActiveSection('orders');
                  setOrderScope('selling');
                }}
              >
                我卖出的
              </button>
              <button
                type="button"
                className={activeSection === 'orders' && orderScope === 'buying' ? 'profile-side-subitem active' : 'profile-side-subitem'}
                onClick={() => {
                  setActiveSection('orders');
                  setOrderScope('buying');
                }}
              >
                我买到的
              </button>
            </div>

            <button
              type="button"
              className={activeSection === 'favorites' ? 'profile-side-item' + ' active' : 'profile-side-item'}
              onClick={() => setActiveSection('favorites')}
            >
              <span className="profile-side-icon"><StarOutlined /></span>
              <strong>我的收藏</strong>
            </button>

            <div className="profile-side-group">
              <div className="profile-side-group-title">
                <span className="profile-side-icon"><SettingOutlined /></span>
                <strong>账户设置</strong>
              </div>
              <button
                type="button"
                className={activeSection === 'profile' && !editingProfile ? 'profile-side-subitem active' : 'profile-side-subitem'}
                onClick={openProfileDetail}
              >
                个人资料
              </button>
              <button
                type="button"
                className={activeSection === 'profile' && editingProfile ? 'profile-side-subitem active' : 'profile-side-subitem'}
                onClick={openProfileEditor}
              >
                编辑资料
              </button>
            </div>
          </div>
        </aside>

        <main className="profile-main">
          <section className="profile-hero-card">
            <div className="profile-hero-copy">
              <div className="profile-avatar-badge">
                <span>{(profile?.name ?? user?.name ?? '校').slice(0, 1)}</span>
              </div>
              <div className="profile-hero-meta">
                <div className="profile-hero-title-row">
                  <h1>{profile?.name ?? user?.name ?? '我的闲置'}</h1>
                  <div className="profile-hero-badges">
                    <span>{getCreditBadge(creditScore)}</span>
                    <span>{identityLabel}</span>
                  </div>
                </div>
                <div className="profile-hero-stats">
                  <span>{collegeLabel}</span>
                  <i />
                  <span>{publishedProducts.length} 件发布</span>
                  <i />
                  <span>{favoriteProducts.length} 个收藏</span>
                </div>
                <p>{profile?.email || '完善资料后，交易沟通和信用展示会更完整。'}</p>
              </div>
            </div>
            <div className="profile-hero-actions">
              <Button type="default" className="profile-edit-button" onClick={openProfileEditor} disabled={!canEditProfile}>
                编辑资料
              </Button>
            </div>
          </section>

          <section className="profile-tabbar">
            <button
              type="button"
              className={activeSection === 'items' ? 'profile-tab active' : 'profile-tab'}
              onClick={() => setActiveSection('items')}
            >
              <strong>宝贝</strong>
              <span>{publishedProducts.length}</span>
            </button>
            <button
              type="button"
              className={activeSection === 'orders' ? 'profile-tab active' : 'profile-tab'}
              onClick={() => setActiveSection('orders')}
            >
              <strong>信用与订单</strong>
              <span>{orderTotal}</span>
            </button>
            <button
              type="button"
              className={activeSection === 'favorites' ? 'profile-tab active' : 'profile-tab'}
              onClick={() => setActiveSection('favorites')}
            >
              <strong>收藏</strong>
              <span>{favoriteProducts.length}</span>
            </button>
            <button
              type="button"
              className={activeSection === 'profile' ? 'profile-tab active' : 'profile-tab'}
              onClick={openProfileDetail}
            >
              <strong>个人资料</strong>
            </button>
          </section>

          {activeSection === 'items' ? (
            <section className="profile-content-panel">
              <div className="profile-section-header">
                <div>
                  <strong>我发布的宝贝</strong>
                  <span>延续闲鱼风格展示你当前挂出的商品</span>
                </div>
                <Tag color="gold">{publishedProducts.length} 件</Tag>
              </div>
              {renderProductGrid(publishedProducts, '还没有发布商品', '去首页或发布页上架第一件校园闲置吧。')}
            </section>
          ) : null}

          {activeSection === 'favorites' ? (
            <section className="profile-content-panel">
              <div className="profile-section-header">
                <div>
                  <strong>我收藏的宝贝</strong>
                  <span>把想要的商品先留在这里，方便回头比较和下单</span>
                </div>
                <Tag color="gold">{favoriteProducts.length} 件</Tag>
              </div>
              {renderProductGrid(favoriteProducts, '还没有收藏商品', '看到心动的闲置后点一下想要，就会出现在这里。')}
            </section>
          ) : null}

          {activeSection === 'orders' ? (
            <section className="profile-order-layout expanded">
              <div className="profile-content-panel profile-order-board">
                <div className="profile-section-header">
                  <div>
                    <strong>线下面交订单</strong>
                    <span>{orderTotal ? `共 ${orderTotal} 条 · 第 ${orderPage}/${orderTotalPages} 页` : '暂无订单'} · 不含线上付款、发货和物流流程</span>
                  </div>
                  <div className="profile-order-scope">
                    {[
                      { key: 'all' as const, label: '全部交易' },
                      { key: 'buying' as const, label: '我买到的' },
                      { key: 'selling' as const, label: '我卖出的' }
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={orderScope === item.key ? 'active' : ''}
                        onClick={() => setOrderScope(item.key)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="profile-order-tabs">
                  {orderFilterTabs.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={orderFilter === item.key ? 'active' : ''}
                      onClick={() => setOrderFilter(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {latestOrder ? (
                  <div className="profile-order-highlight">
                    <strong>最新订单 #{latestOrder.id}</strong>
                    <span>{orderStatusMap[latestOrder.status] ?? latestOrder.status}</span>
                    <em>{latestOrder.productTitle} · {latestOrder.meetupLocation || '待约定线下面交地点'}</em>
                  </div>
                ) : null}

                {visibleOrders.length ? (
                  <>
                    <div className="compact-list profile-orders-list">
                      {visibleOrders.map((item, index) => (
                        <article key={item.id} className="profile-order-card">
                          <div className="profile-order-top">
                            <div className="profile-order-user">
                              <span>{getOrderCounterpart(item).slice(0, 1)}</span>
                              <strong>{getOrderCounterpart(item)}</strong>
                              <em>{getOrderRoleLabel(item)}</em>
                            </div>
                            <Tag color={getOrderStatusColor(item.status)}>{orderStatusMap[item.status] ?? item.status}</Tag>
                          </div>

                          <div className="profile-order-product">
                            <img
                              src={item.productImageUrl ?? getProductImage({
                                title: item.productTitle,
                                category: item.productCategory ?? '宿舍好物',
                                price: item.productPrice ?? 0,
                                condition: item.productCondition ?? '同校面交',
                                sellerName: getOrderCounterpart(item)
                              }, index)}
                              alt={item.productTitle}
                            />
                            <div>
                              <h3>{item.productTitle}</h3>
                              <p>{item.productCategory ?? '校园闲置'} · {item.productCondition ?? '线下面交'}</p>
                              <strong>{formatOrderPrice(item.productPrice)}</strong>
                              <span>{item.meetupLocation || '待双方在消息中约定线下面交时间地点'}</span>
                            </div>
                          </div>

                          {item.note ? <div className="profile-order-note">{item.note}</div> : null}

                          <div className="profile-order-actions">
                            <Button size="small" onClick={() => navigate(`/products/${item.productId}`)}>商品详情</Button>
                            <Button size="small" onClick={() => openOrderConversation(item)}>联系对方</Button>
                            {item.status === 'PENDING' ? (
                              <>
                                <Button size="small" type="primary" onClick={() => openOrderAction('meetup', item)}>确认约定</Button>
                                <Button size="small" onClick={() => openOrderAction('cancel', item)}>取消订单</Button>
                              </>
                            ) : null}
                            {item.status === 'IN_PROGRESS' ? (
                              <>
                                <Button size="small" onClick={() => openOrderAction('meetup', item)}>修改约定</Button>
                                <Button size="small" type="primary" loading={orderActionLoading} onClick={() => handleCompleteMeetup(item)}>确认完成</Button>
                                <Button size="small" onClick={() => openOrderAction('cancel', item)}>取消订单</Button>
                              </>
                            ) : null}
                            {item.status === 'WAITING_REVIEW' ? (
                              <Button size="small" type="primary" onClick={() => openOrderAction('review', item)}>去评价</Button>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                    {orderTotal > ORDER_PAGE_SIZE ? (
                      <div className="profile-pagination-row">
                        <Pagination
                          current={orderPage}
                          pageSize={ORDER_PAGE_SIZE}
                          total={orderTotal}
                          size="small"
                          showSizeChanger={false}
                          disabled={ordersLoading}
                          onChange={(page) => {
                            if (!user) {
                              return;
                            }
                            void loadOrders(user.id, page);
                          }}
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <Empty description={ordersLoading ? '订单加载中...' : '当前筛选下暂无订单'} />
                )}

                <div className="profile-offline-flow">
                  <div><strong>1</strong><span>买家下单后自动生成会话</span></div>
                  <div><strong>2</strong><span>双方确认线下面交时间地点</span></div>
                  <div><strong>3</strong><span>当面验货并完成交易</span></div>
                  <div><strong>4</strong><span>补充评价并沉淀信用记录</span></div>
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === 'profile' ? (
            <section className="profile-content-panel">
              <div className="profile-section-header">
                <div>
                  <strong>个人资料</strong>
                  <span>{roleLabel} · {profile?.studentId ?? user?.studentId ?? '--'}</span>
                </div>
                {canEditProfile ? (
                  <Button
                    type={editingProfile ? 'default' : 'primary'}
                    onClick={() => {
                      if (editingProfile && profile) {
                        form.setFieldsValue({
                          name: profile.name,
                          email: profile.email,
                          realName: profile.realName,
                          college: profile.college,
                          phone: profile.phone
                        });
                      }
                      setEditingProfile((current) => !current);
                    }}
                  >
                    {editingProfile ? '取消编辑' : '编辑资料'}
                  </Button>
                ) : null}
              </div>

              {editingProfile && profile ? (
                <Form form={form} layout="vertical" className="profile-edit-form" onFinish={handleSaveProfile}>
                  <div className="profile-form-grid">
                    <Form.Item label="昵称" name="name" rules={[{ required: true, message: '请输入昵称' }]}>
                      <Input placeholder="请输入昵称" />
                    </Form.Item>
                    <Form.Item label="邮箱" name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入正确邮箱' }]}>
                      <Input placeholder="请输入邮箱" />
                    </Form.Item>
                    <Form.Item label="真实姓名" name="realName" rules={[{ required: true, message: '请输入真实姓名' }]}>
                      <Input placeholder="请输入真实姓名" />
                    </Form.Item>
                    <Form.Item label="学院" name="college" rules={[{ required: true, message: '请输入学院' }]}>
                      <Input placeholder="请输入学院" />
                    </Form.Item>
                    <Form.Item label="手机号" name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
                      <Input placeholder="请输入手机号" />
                    </Form.Item>
                  </div>
                  <div className="profile-form-actions">
                    <Button
                      htmlType="button"
                      onClick={() => {
                        if (profile) {
                          form.setFieldsValue({
                            name: profile.name,
                            email: profile.email,
                            realName: profile.realName,
                            college: profile.college,
                            phone: profile.phone
                          });
                        }
                        setEditingProfile(false);
                      }}
                    >
                      取消
                    </Button>
                    <Button type="primary" htmlType="submit" loading={savingProfile}>
                      保存资料
                    </Button>
                  </div>
                </Form>
              ) : (
                <div className="profile-kv-grid">
                  <div>
                    <span>学号</span>
                    <strong>{profile?.studentId ?? user?.studentId ?? '--'}</strong>
                  </div>
                  <div>
                    <span>账号类型</span>
                    <strong>{roleLabel}</strong>
                  </div>
                  <div>
                    <span>信用分</span>
                    <strong><Tag color="green">{creditScore}</Tag></strong>
                  </div>
                  <div>
                    <span>校园身份</span>
                    <strong>{identityLabel}</strong>
                  </div>
                  <div>
                    <span>邮箱</span>
                    <strong>{profile?.email ?? user?.email ?? '--'}</strong>
                  </div>
                  <div>
                    <span>真实姓名</span>
                    <strong>{profile?.realName ?? '--'}</strong>
                  </div>
                  <div>
                    <span>学院</span>
                    <strong>{collegeLabel}</strong>
                  </div>
                  <div>
                    <span>手机号</span>
                    <strong>{profile?.phone ?? '--'}</strong>
                  </div>
                  <div>
                    <span>信用等级</span>
                    <strong>{trustSummary?.creditLevel ?? '正常'}</strong>
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </main>
      </div>
      <Modal
        title={
          orderActionMode === 'meetup'
            ? '确认线下面交安排'
            : orderActionMode === 'cancel'
              ? '取消订单'
              : '补充交易评价'
        }
        open={!!orderActionMode}
        onCancel={closeOrderAction}
        onOk={handleOrderActionSubmit}
        confirmLoading={orderActionLoading}
        okText={orderActionMode === 'cancel' ? '确认取消' : '提交'}
        cancelText="关闭"
        destroyOnClose
      >
        <Form form={orderForm} layout="vertical" className="profile-order-action-form">
          {orderActionMode === 'meetup' ? (
            <>
              <Form.Item
                label="线下面交时间地点"
                name="meetupLocation"
                rules={[{ required: true, message: '请填写线下面交时间地点' }]}
              >
                <Input placeholder="例如：明天 18:30，图书馆一层大厅" />
              </Form.Item>
              <Form.Item label="补充备注" name="note">
                <Input.TextArea rows={3} placeholder="例如：请带学生证，当面验货后交易" />
              </Form.Item>
            </>
          ) : null}

          {orderActionMode === 'cancel' ? (
            <Form.Item label="取消原因" name="reason">
              <Input.TextArea rows={3} placeholder="例如：时间无法约定，双方协商取消" />
            </Form.Item>
          ) : null}

          {orderActionMode === 'review' ? (
            <>
              <div className="profile-review-rate">
                <span>本次线下面交体验</span>
                <Rate value={reviewRating} onChange={setReviewRating} />
              </div>
              <Form.Item label="评价内容" name="content">
                <Input.TextArea rows={3} placeholder="例如：沟通顺利，准时面交，商品与描述一致" />
              </Form.Item>
            </>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
}
