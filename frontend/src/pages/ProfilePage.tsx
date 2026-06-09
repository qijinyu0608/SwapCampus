import {
  AppstoreOutlined,
  EditOutlined,
  SettingOutlined,
  ShoppingOutlined,
  StarOutlined
} from '@ant-design/icons';
import { Alert, Button, Empty, Form, Input, Modal, Pagination, Rate, Skeleton, Tag, message } from 'antd';
import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MetaList } from '../components/data-display';
import { EmptyState } from '../components/feedback';
import { SectionHeader } from '../components/layout';
import { ProductGrid, ProductSummaryCard } from '../components/product';
import { normalizeProductCategoryName } from '../constants/productCategories';
import { useAuthState } from '../services/auth-state';
import {
  cancelOrder,
  completeOrderMeetup,
  confirmOrderMeetup,
  createOrderReview,
  fetchFavoriteList,
  fetchOrders,
  fetchProducts,
  getApiErrorMessage,
  OrderItem,
  ProductSummary,
  type FavoriteItem,
  updateUserProfile
} from '../services/api';
import { getFavoriteIds, subscribeFavorites } from '../services/favorites';
import { useCurrentUserProfileBundle } from '../services/user-profile';
import {
  getRoleLabel,
  hasTradingAccess,
  isGuestUser,
  type SessionUser
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
  displayName: string;
  email: string;
  realName: string;
  college: string;
  phone: string;
};

type ProfileSection = 'items' | 'orders' | 'favorites' | 'profile';
type SidebarActionKey = ProfileSection | 'profile-edit';
type OrderScope = 'all' | 'buying' | 'selling';
type OrderFilter = typeof orderFilterTabs[number]['key'];
type OrderActionMode = 'meetup' | 'cancel' | 'review';

type OrderActionFormValues = {
  meetupLocation?: string;
  note?: string;
  reason?: string;
  content?: string;
};

type SidebarGroup = {
  title: string;
  icon: ReactNode;
  items: Array<{
    key: SidebarActionKey;
    label: string;
    count?: number | null;
  }>;
};

export function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, setCurrentUser } = useAuthState();
  const routeState = location.state as { section?: unknown; orderScope?: unknown } | null;
  const [form] = Form.useForm<ProfileFormValues>();
  const [orderForm] = Form.useForm<OrderActionFormValues>();
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [productLoading, setProductLoading] = useState(true);
  const [favoriteVersion, setFavoriteVersion] = useState(0);
  const initialSection = routeState?.section === 'orders' ? 'orders' : 'items';
  const initialOrderScope = routeState?.orderScope === 'buying' || routeState?.orderScope === 'selling'
    ? routeState.orderScope
    : 'all';
  const [activeSection, setActiveSection] = useState<ProfileSection>(initialSection);
  const [orders, setOrders] = useState<OrderItem[]>([]);
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
  const {
    profile,
    trustSummary,
    presentation: userPresentation,
    creditScore,
    loading: profileBundleLoading,
    errorMessage: profileBundleError,
    setProfile,
    setTrustSummary
  } = useCurrentUserProfileBundle(hasTradingAccess(currentUser) ? currentUser : null);

  async function loadOrders(page: number) {
    setOrdersLoading(true);
    try {
      const result = await fetchOrders({
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
    if (!hasTradingAccess(currentUser)) {
      setProducts([]);
      setOrders([]);
      setOrderPage(1);
      setOrderTotal(0);
      setOrderTotalPages(1);
      setProductLoading(false);
      return;
    }

    if (!currentUser) {
      return;
    }

    setProductLoading(true);
    fetchProducts({ sellerId: currentUser.id, status: 'ALL', page: 1, pageSize: 60 })
      .then((result) => setProducts(result.items))
      .catch(() => setProducts([]))
      .finally(() => setProductLoading(false));

    fetchFavoriteList()
      .then((result) => setFavoriteItems(result.items))
      .catch(() => setFavoriteItems([]));

    void loadOrders(1);
  }, [currentUser, form]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    form.setFieldsValue({
      displayName: profile.displayName,
      email: profile.email,
      realName: profile.realName,
      college: profile.college,
      phone: profile.phone
    });
  }, [form, profile]);

  useEffect(() => subscribeFavorites(() => setFavoriteVersion((value) => value + 1)), []);

  useEffect(() => {
    if (currentUser?.role !== 'USER') {
      return;
    }

    fetchFavoriteList()
      .then((result) => setFavoriteItems(result.items))
      .catch(() => setFavoriteItems([]));
  }, [favoriteVersion, currentUser]);

  async function handleSaveProfile(values: ProfileFormValues) {
    if (!currentUser) {
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await updateUserProfile(currentUser.id, values);
      setProfile(updated);
      setEditingProfile(false);
      setTrustSummary((current) => current ? {
        ...current,
        displayName: updated.displayName,
        email: updated.email,
        college: updated.college,
        verificationStatus: updated.verificationStatus,
        accountStatus: updated.accountStatus
      } : current);

      const nextUser: SessionUser = {
        ...currentUser,
        displayName: updated.displayName,
        email: updated.email,
        studentId: updated.studentId,
        creditScore: updated.creditScore,
        verificationStatus: updated.verificationStatus,
        accountStatus: updated.accountStatus
      };
      setCurrentUser(nextUser);
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
        displayName: profile.displayName,
        email: profile.email,
        realName: profile.realName,
        college: profile.college,
        phone: profile.phone
      });
    }
    setActiveSection('profile');
    setEditingProfile(true);
  }

  function openProfileSummary() {
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
    if (!currentUser) {
      return;
    }

    await loadOrders(page);
    fetchProducts({ sellerId: currentUser.id, status: 'ALL', page: 1, pageSize: 60 })
      .then((result) => setProducts(result.items))
      .catch(() => setProducts([]));
  }

  async function handleOrderActionSubmit() {
    if (!currentUser || !activeOrder || !orderActionMode) {
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
          meetupLocation: values.meetupLocation,
          note: values.note
        });
        message.success('已确认线下面交安排');
      } else if (orderActionMode === 'cancel') {
        await cancelOrder(activeOrder.id, {
          reason: values.reason
        });
        message.success('订单已取消，商品将恢复可交易');
      } else {
        await createOrderReview(activeOrder.id, {
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
    if (!currentUser) {
      return;
    }

    setOrderActionLoading(true);
    try {
      await completeOrderMeetup(order.id);
      message.success('已确认线下面交完成，请补充评价');
      await refreshOrderRelatedData();
    } catch (error) {
      message.error(getApiErrorMessage(error, '确认完成失败，请稍后重试'));
    } finally {
      setOrderActionLoading(false);
    }
  }

  function getOrderCounterpart(order: OrderItem) {
    if (!currentUser) {
      return '同校同学';
    }

    return order.buyerId === currentUser.id ? order.sellerName : order.buyerName;
  }

  function getOrderRoleLabel(order: OrderItem) {
    if (!currentUser) {
      return '交易订单';
    }

    return order.buyerId === currentUser.id ? '我买到的' : '我卖出的';
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

  function getOrderImage(order: OrderItem, index: number) {
    if (order.productImageUrl) {
      return order.productImageUrl;
    }

    return getProductImage({
      title: order.productTitle,
      category: normalizeProductCategoryName(order.productCategory),
      price: order.productPrice ?? 0,
      condition: order.productCondition ?? '同校面交',
      sellerName: getOrderCounterpart(order)
    }, index);
  }

  function isSidebarItemActive(key: SidebarActionKey) {
    if (key === 'profile-edit') {
      return activeSection === 'profile' && editingProfile;
    }

    return activeSection === key && (key !== 'profile' || !editingProfile);
  }

  function handleSidebarAction(key: SidebarActionKey) {
    if (key === 'profile-edit') {
      openProfileEditor();
      return;
    }

    if (key === 'profile') {
      openProfileSummary();
      return;
    }

    setActiveSection(key);
    setEditingProfile(false);
  }

  const roleLabel = currentUser ? getRoleLabel(currentUser.role) : '--';
  const guestMode = isGuestUser(currentUser);
  const canEditProfile = !!currentUser && hasTradingAccess(currentUser) && !!profile;
  const favoriteIds = getFavoriteIds(currentUser);
  const publishedProducts = currentUser
    ? products.filter((item) => item.sellerId === currentUser.id || item.sellerName === currentUser.displayName)
    : [];
  const favoriteProducts = currentUser?.role === 'USER'
    ? favoriteItems
    : products.filter((item) => favoriteIds.includes(item.id));
  const activeOrderCount = trustSummary?.activeOrders ?? orders.filter((item) => item.status === 'IN_PROGRESS' || item.status === 'PENDING').length;
  const completedOrderCount = trustSummary?.completedOrders ?? orders.filter((item) => item.status === 'COMPLETED').length;
  const waitingReviewCount = trustSummary?.waitingReviews ?? orders.filter((item) => item.status === 'WAITING_REVIEW').length;
  const scopedOrders = orders.filter((item) => {
    if (!currentUser || orderScope === 'all') {
      return true;
    }

    return orderScope === 'buying' ? item.buyerId === currentUser.id : item.sellerId === currentUser.id;
  });
  const visibleOrders = scopedOrders.filter((item) => orderFilter === 'ALL' || item.status === orderFilter);
  const latestOrder = visibleOrders[0] ?? null;
  const identityLabel = userPresentation.verificationLabel;
  const creditBadge = userPresentation.creditBadge;
  const collegeLabel = userPresentation.collegeLabel;
  const profileSummary = trustSummary
    ? `${trustSummary.responseRate}% 回复率 · ${trustSummary.averageRating.toFixed(1)} 分 · ${trustSummary.waitingReviews} 条待评价`
    : userPresentation.emailLabel;
  const topTabs = [
    { key: 'items' as const, label: '宝贝', count: publishedProducts.length },
    { key: 'orders' as const, label: '信用与订单', count: orderTotal },
    { key: 'favorites' as const, label: '收藏', count: favoriteProducts.length },
    { key: 'profile' as const, label: '个人资料', count: null }
  ];
  const sidebarGroups: SidebarGroup[] = [
    {
      title: '我的闲置',
      icon: <AppstoreOutlined />,
      items: [
        { key: 'items', label: '我发布的', count: publishedProducts.length }
      ]
    },
    {
      title: '我的交易',
      icon: <ShoppingOutlined />,
      items: [
        { key: 'orders', label: '我的订单', count: orderTotal }
      ]
    },
    {
      title: '我的收藏',
      icon: <StarOutlined />,
      items: [
        { key: 'favorites', label: '收藏宝贝', count: favoriteProducts.length }
      ]
    },
    {
      title: '账户设置',
      icon: <SettingOutlined />,
      items: [
        { key: 'profile', label: '个人资料' },
        { key: 'profile-edit', label: '编辑资料' }
      ]
    }
  ];
  const heroSummaryItems = [
    { label: '信用分', value: creditScore },
    { label: '进行中', value: activeOrderCount },
    { label: '已完成', value: completedOrderCount },
    { label: '待评价', value: waitingReviewCount }
  ];

  function renderProductGrid(items: ProductSummary[], emptyTitle: string, emptyDescription: string) {
    if (productLoading) {
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
            tagItems={[item.sellerName, item.status === 'ON_SALE' ? '在售' : item.status]}
            onOpen={() => navigate(`/products/${item.id}`)}
          />
        )}
      />
    );
  }

  function renderOrdersSection() {
    return (
      <section className="profile-section-panel profile-order-board">
        <SectionHeader
          title="我的订单"
          description={`${orderTotal ? `共 ${orderTotal} 条 · 第 ${orderPage}/${orderTotalPages} 页` : '暂无订单'} · 当前仍以线下面交为主`}
          aside={(
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
          )}
          className="is-prominent is-spacious"
        />

        {trustSummary ? (
          <div className="profile-order-summary-strip" aria-label="信用与订单指标">
            <div className="profile-order-summary-item">
              <span>待评价</span>
              <strong>{trustSummary.waitingReviews}</strong>
            </div>
            <div className="profile-order-summary-item">
              <span>回复率</span>
              <strong>{`${trustSummary.responseRate}%`}</strong>
            </div>
            <div className="profile-order-summary-item">
              <span>交易评分</span>
              <strong>{trustSummary.averageRating.toFixed(1)}</strong>
            </div>
            <div className="profile-order-summary-item">
              <span>完成订单</span>
              <strong>{trustSummary.completedOrders}</strong>
            </div>
          </div>
        ) : null}

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
                      <div className="profile-order-user-copy">
                        <strong>{getOrderCounterpart(item)}</strong>
                        <em>{getOrderRoleLabel(item)}</em>
                      </div>
                    </div>
                    <Tag color={getOrderStatusColor(item.status)}>{orderStatusMap[item.status] ?? item.status}</Tag>
                  </div>

                  <div className="profile-order-product">
                    <img src={getOrderImage(item, index)} alt={item.productTitle} />
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
                    if (!currentUser) {
                      return;
                    }
                    void loadOrders(page);
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
      </section>
    );
  }

  function renderProfileSection() {
    return (
      <section className="profile-section-panel">
        <SectionHeader
          title="个人资料"
          description={`${roleLabel} · ${profile?.studentId ?? currentUser?.studentId ?? '--'}`}
          aside={canEditProfile ? (
            <Button
              type={editingProfile ? 'default' : 'primary'}
              onClick={() => {
                if (editingProfile && profile) {
                  form.setFieldsValue({
                    displayName: profile.displayName,
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
          className="is-prominent is-spacious"
        />

        {profileBundleLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : editingProfile && profile ? (
          <Form form={form} layout="vertical" className="profile-edit-form" onFinish={handleSaveProfile}>
            <div className="profile-form-grid">
              <Form.Item label="昵称" name="displayName" rules={[{ required: true, message: '请输入昵称' }]}>
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
                      displayName: profile.displayName,
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
          <>
            <div className="profile-kv-grid">
              <div>
                <span>学号</span>
                <strong>{profile?.studentId ?? currentUser?.studentId ?? '--'}</strong>
              </div>
              <div>
                <span>账号类型</span>
                <strong>{roleLabel}</strong>
              </div>
              <div>
                <span>账号状态</span>
                <strong>{profile?.accountStatus === 'BANNED' ? '已封禁' : '正常'}</strong>
              </div>
              <div>
                <span>信用分</span>
                <strong>{creditScore}</strong>
              </div>
              <div>
                <span>校园身份</span>
                <strong>{identityLabel}</strong>
              </div>
              <div>
                <span>邮箱</span>
                <strong>{profile?.email ?? currentUser?.email ?? '--'}</strong>
              </div>
              <div>
                <span>真实姓名</span>
                <strong>{profile?.realName || '--'}</strong>
              </div>
              <div>
                <span>学院</span>
                <strong>{collegeLabel}</strong>
              </div>
              <div>
                <span>手机号</span>
                <strong>{profile?.phone || '--'}</strong>
              </div>
              <div>
                <span>信用标签</span>
                <strong>{creditBadge.label}</strong>
              </div>
            </div>

            {trustSummary ? (
              <div className="profile-profile-summary">
                <div className="profile-order-summary-item">
                  <span>回复率</span>
                  <strong>{`${trustSummary.responseRate}%`}</strong>
                </div>
                <div className="profile-order-summary-item">
                  <span>交易评分</span>
                  <strong>{trustSummary.averageRating.toFixed(1)}</strong>
                </div>
                <div className="profile-order-summary-item">
                  <span>完成订单</span>
                  <strong>{trustSummary.completedOrders}</strong>
                </div>
                <div className="profile-order-summary-item">
                  <span>待评价</span>
                  <strong>{trustSummary.waitingReviews}</strong>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    );
  }

  function renderActiveSection() {
    if (activeSection === 'items') {
      return (
        <section className="profile-section-panel">
          <SectionHeader
            title="我发布的宝贝"
            description="只展示当前账号下已经发布的内容"
            aside={<Tag color="gold">{publishedProducts.length} 件</Tag>}
            className="is-prominent is-spacious"
          />
          {renderProductGrid(publishedProducts, '还没有发布商品', '去首页或发布页上架第一件校园闲置吧。')}
        </section>
      );
    }

    if (activeSection === 'favorites') {
      return (
        <section className="profile-section-panel">
          <SectionHeader
            title="我收藏的宝贝"
            description="这里保留你标记过的商品，方便回看与比较"
            aside={<Tag color="gold">{favoriteProducts.length} 件</Tag>}
            className="is-prominent is-spacious"
          />
          {renderProductGrid(favoriteProducts, '还没有收藏商品', '看到心动的闲置后点一下想要，就会出现在这里。')}
        </section>
      );
    }

    if (activeSection === 'orders') {
      return renderOrdersSection();
    }

    return renderProfileSection();
  }

  if (!hasTradingAccess(currentUser)) {
    return (
      <div className="page-grid profile-page">
        <EmptyState
          className="is-shell"
          title={guestMode ? '游客模式下暂不支持个人资料页' : '请使用普通用户账号进入个人中心'}
        />
      </div>
    );
  }

  return (
    <div className="page-grid profile-page">
      {profileBundleError ? (
        <Alert
          type="warning"
          showIcon
          className="profile-status-alert"
          message={profileBundleError}
          description="当前仍会优先展示本地会话和已加载内容，部分资料与信用指标可能暂时不完整。"
        />
      ) : null}

      <div className="profile-shell">
        <aside className="profile-sidebar">
          <div className="profile-menu-panel">
            {sidebarGroups.map((group) => (
              <section key={group.title} className="profile-menu-group">
                <div className="profile-menu-group-title">
                  <span className="profile-menu-group-icon">{group.icon}</span>
                  <strong>{group.title}</strong>
                </div>
                <div className="profile-menu-group-items">
                  {group.items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={isSidebarItemActive(item.key) ? 'profile-menu-item active' : 'profile-menu-item'}
                      onClick={() => handleSidebarAction(item.key)}
                    >
                      <span>{item.label}</span>
                      {typeof item.count === 'number' ? <em>{item.count}</em> : null}
                    </button>
                  ))}
                </div>
              </section>
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
                    <span>{creditBadge.label}</span>
                    <span>{identityLabel}</span>
                  </div>
                </div>
                <MetaList
                  items={[
                    collegeLabel,
                    `${publishedProducts.length} 件发布`,
                    `${favoriteProducts.length} 个收藏`
                  ]}
                  className="profile-hero-stats"
                />
                <p>{profileSummary}</p>
              </div>
            </div>

            <div className="profile-hero-side">
              <Button
                className="profile-hero-edit-button"
                type="primary"
                icon={<EditOutlined />}
                disabled={!canEditProfile}
                onClick={() => {
                  if (editingProfile) {
                    openProfileSummary();
                    return;
                  }
                  openProfileEditor();
                }}
              >
                {editingProfile ? '查看资料' : '编辑资料'}
              </Button>
              <div className="profile-hero-summary">
                {heroSummaryItems.map((item) => (
                  <div key={item.label} className="profile-hero-summary-item">
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <nav className="profile-top-tabs" aria-label="个人中心主导航">
            {topTabs.map((item) => (
              <button
                key={item.key}
                type="button"
                className={activeSection === item.key ? 'profile-top-tab active' : 'profile-top-tab'}
                onClick={() => {
                  if (item.key === 'profile') {
                    openProfileSummary();
                    return;
                  }

                  setActiveSection(item.key);
                  setEditingProfile(false);
                }}
              >
                <span>{item.label}</span>
                {item.count !== null ? <em>{item.count}</em> : null}
              </button>
            ))}
          </nav>

          {renderActiveSection()}
        </div>
      </div>

      <Modal
        title={
          orderActionMode === 'meetup'
            ? '确认线下面交安排'
            : orderActionMode === 'cancel'
              ? '取消订单'
              : '补充交易评价'
        }
        wrapClassName="profile-order-modal"
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
