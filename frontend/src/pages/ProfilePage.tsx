import {
  AppstoreOutlined,
  SafetyCertificateOutlined,
  EnvironmentOutlined,
  EditOutlined,
  EyeOutlined,
  HeartOutlined,
  InboxOutlined,
  MessageOutlined,
  ProfileOutlined,
  ShopOutlined,
  ShoppingOutlined,
  StarOutlined
} from '@ant-design/icons';
import { Button, Empty, Form, Input, Modal, Select, Skeleton, Tag, message } from 'antd';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EmptyState } from '../components/feedback';
import { ImageCropUploadModal } from '../components/image-upload';
import { CampusServicePublisherOrderWorkbench } from '../components/listing';
import { SectionHeader } from '../components/layout';
import { ProductGrid, ProductSummaryCard } from '../components/product';
import { AVATAR_OPTIONS } from '../constants/avatarOptions';
import { BJFU_COLLEGES } from '../constants/colleges';
import {
  cancelCampusServiceOrder,
  completeCampusServiceOrder,
  confirmCampusServiceOrder,
  type CampusServiceOrderListItem,
  fetchCampusServiceOrders,
  fetchCampusServiceListings,
  fetchFavoriteList,
  fetchFollowingUsers,
  fetchBrowsingHistory,
  fetchOrders,
  fetchProducts,
  fetchUserProfile,
  fetchUserTrustSummary,
  getApiErrorMessage,
  rejectCampusServiceOrder,
  type CampusServiceListItem,
  type FavoriteItem,
  type FollowingUser,
  type HistoryItem,
  type OrderItem,
  type ProductHistoryItem,
  type ProductSummary,
  uploadImageAsset,
  updateUserProfile,
  type UserProfile,
  type UserTrustSummary
} from '../services/api';
import { useAuthState } from '../services/auth-state';
import { hasTradingAccess, isGuestUser } from '../services/session';
import { UserAvatar } from '../components/user/UserAvatar';
import { getProductImage } from '../utils/productCover';
import { getUserPresentation } from '../utils/userPresentation';
import type { PublisherOrderGroupKey } from '../components/listing/CampusServicePublisherOrderWorkbench';

type ProfileSection = 'items' | 'orders-buying' | 'orders-selling' | 'favorites' | 'history' | 'following' | 'profile';
type PublishedScope = 'products' | 'campus-services-request' | 'campus-services-offer' | 'campus-services-provider' | 'campus-services-booking';

type HistoryGroup = {
  key: string;
  label: string;
  items: HistoryItem[];
};

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

const PRESET_AVATAR_URLS = new Set<string>(AVATAR_OPTIONS.map((item) => item.src));

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

function getCampusServiceOrderStatusColor(status: CampusServiceOrderListItem['orderStatus']) {
  if (status === 'COMPLETED') {
    return 'green';
  }
  if (status === 'WAITING_COMPLETE_CONFIRM') {
    return 'gold';
  }
  if (status === 'REJECTED' || status === 'CANCELED' || status === 'EXPIRED') {
    return 'default';
  }
  if (status === 'CONFIRMED') {
    return 'blue';
  }
  return 'orange';
}

function isCampusServiceOrderListItem(
  item: CampusServiceListItem | CampusServiceOrderListItem
): item is CampusServiceOrderListItem {
  return 'listingId' in item;
}

function isCampusServiceHistoryItem(item: HistoryItem) {
  return item.type === 'campus-service';
}

function formatHistoryDateLabel(viewedAt: string | null) {
  if (!viewedAt) {
    return '时间未知';
  }

  const date = new Date(viewedAt);
  if (Number.isNaN(date.getTime())) {
    return '时间未知';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}年${month}月${day}日`;
}

function createHistoryGroups(items: HistoryItem[]) {
  const groups: HistoryGroup[] = [];
  const groupMap = new Map<string, HistoryGroup>();

  items.forEach((item) => {
    const label = formatHistoryDateLabel(item.viewedAt);
    const key = item.viewedAt ? item.viewedAt.slice(0, 10) : 'unknown';
    let group = groupMap.get(key);

    if (!group) {
      group = { key, label, items: [] };
      groupMap.set(key, group);
      groups.push(group);
    }

    group.items.push(item);
  });

  return groups;
}

type CampusServiceGroupKey = 'pending' | 'active' | 'waiting-complete' | 'ended';

type CampusServiceStatusGroup<T extends CampusServiceListItem | CampusServiceOrderListItem> = {
  key: CampusServiceGroupKey;
  title: string;
  description: string;
  items: T[];
};

type CampusServiceListingGroupSummary = {
  pendingOrderCount: number;
  waitingCompleteOrderCount: number;
  activeOrderCount: number;
  endedOrderCount: number;
  totalOrderCount: number;
};

function getCampusServiceListingGroupKey(item: CampusServiceListItem): CampusServiceGroupKey {
  if (item.actionState.canConfirm || item.actionState.canReject) {
    return 'pending';
  }

  if (item.actionLabels.complete === '确认完成') {
    return 'waiting-complete';
  }

  if (item.actionState.canComplete || item.actionState.canCancel || item.actionState.canPause) {
    return 'active';
  }

  if (item.latestOrderId && item.status === 'BUSY') {
    return 'waiting-complete';
  }

  return 'ended';
}

function getCampusServiceOrderGroupKey(item: CampusServiceOrderListItem): CampusServiceGroupKey {
  if (item.orderStatus === 'PENDING_CONFIRMATION') {
    return 'pending';
  }

  if (item.orderStatus === 'WAITING_COMPLETE_CONFIRM') {
    return 'waiting-complete';
  }

  if (item.orderStatus === 'CONFIRMED') {
    return 'active';
  }

  return 'ended';
}

function createCampusServiceGroups<T extends CampusServiceListItem | CampusServiceOrderListItem>(
  items: T[],
  resolver: (item: T) => CampusServiceGroupKey
) {
  const baseGroups: Array<CampusServiceStatusGroup<T>> = [
    { key: 'pending', title: '待确认', description: '等待发布者确认或等待你确认下一步。', items: [] },
    { key: 'active', title: '进行中', description: '已进入履约阶段，当前还在推进。', items: [] },
    { key: 'waiting-complete', title: '待完成确认', description: '一方已提交完成，等待另一方确认。', items: [] },
    { key: 'ended', title: '已结束', description: '已完成、已取消、已拒绝或已过期。', items: [] }
  ];
  const groupMap = new Map(baseGroups.map((group) => [group.key, group]));

  items.forEach((item) => {
    groupMap.get(resolver(item))?.items.push(item);
  });

  return baseGroups.filter((group) => group.items.length > 0);
}

function summarizeCampusServiceListingGroup(items: CampusServiceListItem[]): CampusServiceListingGroupSummary {
  return items.reduce<CampusServiceListingGroupSummary>((summary, item) => ({
    pendingOrderCount: summary.pendingOrderCount + item.pendingOrderCount,
    waitingCompleteOrderCount: summary.waitingCompleteOrderCount + item.waitingCompleteOrderCount,
    activeOrderCount: summary.activeOrderCount + item.activeOrderCount,
    endedOrderCount: summary.endedOrderCount + item.endedOrderCount,
    totalOrderCount: summary.totalOrderCount + item.totalOrderCount
  }), {
    pendingOrderCount: 0,
    waitingCompleteOrderCount: 0,
    activeOrderCount: 0,
    endedOrderCount: 0,
    totalOrderCount: 0
  });
}

export function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, refreshCurrentUser } = useAuthState();
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
    if (routeState?.section === 'profile') {
      return 'profile';
    }
    if (routeState?.section === 'orders') {
      return routeState.orderScope === 'selling' ? 'orders-selling' : 'orders-buying';
    }
    return 'items';
  });
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [campusServices, setCampusServices] = useState<CampusServiceListItem[]>([]);
  const [participatedCampusServices, setParticipatedCampusServices] = useState<CampusServiceOrderListItem[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [followingUsers, setFollowingUsers] = useState<FollowingUser[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [publishedScope, setPublishedScope] = useState<PublishedScope>('products');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCampusServices, setLoadingCampusServices] = useState(true);
  const [loadingParticipatedCampusServices, setLoadingParticipatedCampusServices] = useState(true);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingFollowing, setLoadingFollowing] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trustSummary, setTrustSummary] = useState<UserTrustSummary | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null);
  const [actingCampusOrderId, setActingCampusOrderId] = useState<number | null>(null);
  const [publisherOrderWorkbenchListing, setPublisherOrderWorkbenchListing] = useState<CampusServiceListItem | null>(null);
  const [publisherOrderWorkbenchGroup, setPublisherOrderWorkbenchGroup] = useState<PublisherOrderGroupKey>('PENDING');
  const [publisherOrderWorkbenchReloadVersion, setPublisherOrderWorkbenchReloadVersion] = useState(0);
  const [publisherOrderDialogTarget, setPublisherOrderDialogTarget] = useState<CampusServiceOrderListItem | null>(null);
  const [publisherOrderDialogReason, setPublisherOrderDialogReason] = useState('');
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>(AVATAR_OPTIONS[0]?.src ?? '');
  const [form] = Form.useForm<UserProfile & { studentId?: string; phone: string; realName: string }>();

  useEffect(() => () => {
    if (pendingAvatarUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(pendingAvatarUrl);
    }
  }, [pendingAvatarUrl]);

  useEffect(() => {
    if (!hasTradingAccess(currentUser) || !currentUser) {
      setProducts([]);
      setCampusServices([]);
      setFavoriteItems([]);
      setHistoryItems([]);
      setFollowingUsers([]);
      setOrders([]);
      setParticipatedCampusServices([]);
      setLoadingProducts(false);
      setLoadingCampusServices(false);
      setLoadingParticipatedCampusServices(false);
      setLoadingFavorites(false);
      setLoadingHistory(false);
      setLoadingFollowing(false);
      setLoadingOrders(false);
      setLoadingProfile(false);
      setProfile(null);
      setTrustSummary(null);
      return;
    }

    let cancelled = false;

    setLoadingProducts(true);
    setLoadingCampusServices(true);
    setLoadingParticipatedCampusServices(true);
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

    fetchCampusServiceListings({ ownerId: currentUser.id, page: 1, pageSize: 60, sort: 'newest' })
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

    fetchCampusServiceOrders({ page: 1, pageSize: 60 })
      .then((result) => {
        if (!cancelled) {
          setParticipatedCampusServices(result.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setParticipatedCampusServices([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingParticipatedCampusServices(false);
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

    Promise.all([
      fetchUserProfile(currentUser.id),
      fetchUserTrustSummary(currentUser.id)
    ])
      .then(([profileResult, trustResult]) => {
        if (!cancelled) {
          setProfile(profileResult);
          setTrustSummary(trustResult);
          setPendingAvatarUrl(null);
          setSelectedAvatarUrl(profileResult.avatarUrl ?? AVATAR_OPTIONS[0]?.src ?? '');
          form.setFieldsValue({
            displayName: profileResult.displayName,
            studentId: profileResult.studentId ?? undefined,
            email: profileResult.email,
            realName: profileResult.realName,
            college: profileResult.college,
            phone: profileResult.phone,
            avatarUrl: profileResult.avatarUrl ?? ''
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfile(null);
          setTrustSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser, form]);

  const guestMode = isGuestUser(currentUser);
  const userPresentation = getUserPresentation(trustSummary ?? profile ?? currentUser);

  const publishedProducts = useMemo(
    () => currentUser
      ? products.filter((item) => item.sellerId === currentUser.id || item.sellerName === currentUser.displayName)
      : [],
    [currentUser, products]
  );

  const publishedRequestCampusServices = useMemo(
    () => currentUser ? campusServices.filter((item) => item.publisher.id === currentUser.id && item.intent === 'REQUEST') : [],
    [campusServices, currentUser]
  );

  const publishedOfferCampusServices = useMemo(
    () => currentUser ? campusServices.filter((item) => item.publisher.id === currentUser.id && item.intent === 'OFFER') : [],
    [campusServices, currentUser]
  );

  const providerCampusServices = useMemo(
    () => participatedCampusServices.filter((item) => item.intent === 'REQUEST' && item.role === 'PROVIDER'),
    [participatedCampusServices]
  );

  const bookingCampusServices = useMemo(
    () => participatedCampusServices.filter((item) => item.intent === 'OFFER' && item.role === 'REQUESTER'),
    [participatedCampusServices]
  );

  const groupedPublishedRequestCampusServices = useMemo(
    () => createCampusServiceGroups(publishedRequestCampusServices, getCampusServiceListingGroupKey),
    [publishedRequestCampusServices]
  );

  const groupedPublishedOfferCampusServices = useMemo(
    () => createCampusServiceGroups(publishedOfferCampusServices, getCampusServiceListingGroupKey),
    [publishedOfferCampusServices]
  );

  const groupedProviderCampusServices = useMemo(
    () => createCampusServiceGroups(providerCampusServices, getCampusServiceOrderGroupKey),
    [providerCampusServices]
  );

  const groupedBookingCampusServices = useMemo(
    () => createCampusServiceGroups(bookingCampusServices, getCampusServiceOrderGroupKey),
    [bookingCampusServices]
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
    {
      key: 'items',
      icon: <AppstoreOutlined />,
      label: '我发布的',
      count: publishedProducts.length + publishedRequestCampusServices.length + publishedOfferCampusServices.length
    },
    { key: 'orders-buying', icon: <ShoppingOutlined />, label: '我买到的', count: buyingOrders.length },
    { key: 'orders-selling', icon: <ShopOutlined />, label: '我卖出的', count: sellingOrders.length },
    { key: 'favorites', icon: <StarOutlined />, label: '我的收藏', count: favoriteItems.length },
    { key: 'history', icon: <EyeOutlined />, label: '历史浏览', count: historyItems.length },
    { key: 'following', icon: <HeartOutlined />, label: '我的关注', count: followingUsers.length }
  ];

  function openProfileEditor() {
    setActiveSection('profile');
  }

  const campusServiceSectionTitle = publishedScope === 'products'
    ? '我发布的'
    : publishedScope === 'campus-services-request'
      ? '我发布的需求'
      : publishedScope === 'campus-services-offer'
        ? '我发布的服务'
        : publishedScope === 'campus-services-provider'
          ? '我接的单'
          : '我预约的服务';

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
            className={publishedScope === 'campus-services-request' ? 'active' : undefined}
            onClick={() => setPublishedScope('campus-services-request')}
          >
            我发布的需求
          </button>
          <button
            type="button"
            className={publishedScope === 'campus-services-offer' ? 'active' : undefined}
            onClick={() => setPublishedScope('campus-services-offer')}
          >
            我发布的服务
          </button>
          <button
            type="button"
            className={publishedScope === 'campus-services-provider' ? 'active' : undefined}
            onClick={() => setPublishedScope('campus-services-provider')}
          >
            我接的单
          </button>
          <button
            type="button"
            className={publishedScope === 'campus-services-booking' ? 'active' : undefined}
            onClick={() => setPublishedScope('campus-services-booking')}
          >
            我预约的服务
          </button>
        </div>
        {showingProducts
          ? renderProductGrid(
            publishedProducts,
            loadingProducts,
            '暂无发布'
          )
          : publishedScope === 'campus-services-request'
              ? renderPublishedCampusServices(
                groupedPublishedRequestCampusServices,
                loadingCampusServices,
                '暂无发布的需求'
              )
            : publishedScope === 'campus-services-offer'
              ? renderPublishedCampusServices(
                groupedPublishedOfferCampusServices,
                loadingCampusServices,
                '暂无发布的服务'
              )
              : publishedScope === 'campus-services-provider'
                ? renderParticipatedCampusServiceOrders(
                  groupedProviderCampusServices,
                  loadingParticipatedCampusServices,
                  '暂无接单记录',
                  undefined
                )
                : renderParticipatedCampusServiceOrders(
                  groupedBookingCampusServices,
                  loadingParticipatedCampusServices,
                  '暂无预约记录',
                  undefined
                )}
      </div>
    );
  }

  function renderPublishedCampusServices(
    groups: Array<CampusServiceStatusGroup<CampusServiceListItem>>,
    loading: boolean,
    emptyTitle = '暂无发布',
    emptyDescription?: string
  ) {
    if (loading) {
      return <Skeleton active paragraph={{ rows: 8 }} />;
    }

    if (!groups.length) {
      return <EmptyState className="is-shell" title={emptyTitle} description={emptyDescription} />;
    }

    return (
      <div className="profile-campus-service-groups">
        {groups.map((group) => (
          <section key={group.key} className="profile-campus-service-group">
            {(() => {
              const summary = summarizeCampusServiceListingGroup(group.items);

              return (
                <div className="profile-campus-service-group-head">
                  <div>
                    <strong>{group.title}</strong>
                    <span>{group.description}</span>
                    <div className="profile-campus-service-group-signals" aria-label={`${group.title}订单概况`}>
                      {summary.pendingOrderCount > 0 ? (
                        <span className="service-inline-status is-active">{`待确认 ${summary.pendingOrderCount}`}</span>
                      ) : null}
                      {summary.waitingCompleteOrderCount > 0 ? (
                        <span className="service-inline-status is-success">{`待完成 ${summary.waitingCompleteOrderCount}`}</span>
                      ) : null}
                      {summary.activeOrderCount > 0 ? (
                        <span className="service-inline-status is-default">{`进行中 ${summary.activeOrderCount}`}</span>
                      ) : null}
                      {summary.endedOrderCount > 0 ? (
                        <span className="service-inline-status is-muted">{`已结束 ${summary.endedOrderCount}`}</span>
                      ) : null}
                    </div>
                  </div>
                  <em>{`${group.items.length} 条 / ${summary.totalOrderCount} 单`}</em>
                </div>
              );
            })()}
            <ProductGrid
              items={group.items}
              renderItem={(item) => (
                <ProductSummaryCard
                  key={item.id}
                  item={item}
                  imageSrc="/images/products/demo-square.png"
                  className="profile-fish-card service-task-card"
                  coverMeta={(
                    <div className="service-card-cover-stack">
                      <span className="service-card-cover-type">{item.intentLabel}</span>
                      <span className="service-card-cover-type">{item.serviceType.label}</span>
                      <span className="service-card-cover-deadline">{item.deadlineLabel}</span>
                    </div>
                  )}
                  bodyMeta={item.participantSummary.participantLabel
                    ? `${item.participantSummary.publisherLabel} · ${item.participantSummary.participantLabel}`
                    : item.participantSummary.publisherLabel}
                  priceValue={item.rewardLabel}
                  priceMeta={item.schedule.summary}
                  tagItems={item.summaryTags.slice(0, 4)}
                  secondaryActions={(
                    <>
                      {item.pendingOrderCount > 0 ? (
                        <button
                          type="button"
                          className="service-inline-status is-active is-clickable"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPublisherOrderWorkbenchListing(item);
                            setPublisherOrderWorkbenchGroup('PENDING');
                            setPublisherOrderWorkbenchReloadVersion((value) => value + 1);
                          }}
                        >
                          {`待确认 ${item.pendingOrderCount}`}
                        </button>
                      ) : null}
                      {item.waitingCompleteOrderCount > 0 ? (
                        <button
                          type="button"
                          className="service-inline-status is-success is-clickable"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPublisherOrderWorkbenchListing(item);
                            setPublisherOrderWorkbenchGroup('WAITING_COMPLETE');
                            setPublisherOrderWorkbenchReloadVersion((value) => value + 1);
                          }}
                        >
                          {`待完成 ${item.waitingCompleteOrderCount}`}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="service-inline-status is-default is-clickable"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPublisherOrderWorkbenchListing(item);
                          setPublisherOrderWorkbenchGroup('ACTIVE');
                          setPublisherOrderWorkbenchReloadVersion((value) => value + 1);
                        }}
                      >
                        {`进行中 ${item.activeOrderCount}`}
                      </button>
                      {item.endedOrderCount > 0 ? (
                        <button
                          type="button"
                          className="service-inline-status is-muted is-clickable"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPublisherOrderWorkbenchListing(item);
                            setPublisherOrderWorkbenchGroup('ENDED');
                            setPublisherOrderWorkbenchReloadVersion((value) => value + 1);
                          }}
                        >
                          {`已结束 ${item.endedOrderCount}`}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="fish-item-link active"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPublisherOrderWorkbenchListing(item);
                          setPublisherOrderWorkbenchGroup('PENDING');
                          setPublisherOrderWorkbenchReloadVersion((value) => value + 1);
                        }}
                      >
                        <InboxOutlined />
                        <span>订单管理</span>
                      </button>
                    </>
                  )}
                  onOpen={() => navigate(`/campus-services/${item.id}`)}
                />
              )}
            />
          </section>
        ))}
      </div>
    );
  }

  function renderParticipatedCampusServiceOrders(
    groups: Array<CampusServiceStatusGroup<CampusServiceOrderListItem>>,
    loading: boolean,
    emptyTitle: string,
    emptyDescription?: string
  ) {
    if (loading) {
      return <Skeleton active paragraph={{ rows: 8 }} />;
    }

    if (!groups.length) {
      return <EmptyState className="is-shell" title={emptyTitle} description={emptyDescription} />;
    }

    return (
      <div className="profile-campus-service-groups">
        {groups.map((group) => (
          <section key={group.key} className="profile-campus-service-group">
            <div className="profile-campus-service-group-head">
              <div>
                <strong>{group.title}</strong>
                <span>{group.description}</span>
              </div>
              <em>{group.items.length} 单</em>
            </div>
            <div className="compact-list profile-orders-list">
              {group.items.map((item) => {
                const counterpartPresentation = getUserPresentation(item.counterpart);

                return (
                  <article key={item.id} className="profile-order-card profile-campus-order-card">
                    <div className="profile-order-top">
                      <div className="profile-order-user">
                        <span>{counterpartPresentation.initial}</span>
                        <div className="profile-order-user-copy">
                          <strong>{item.title}</strong>
                          <em>{item.roleLabel} · 对方 {counterpartPresentation.displayName}</em>
                        </div>
                      </div>
                      <Tag color={getCampusServiceOrderStatusColor(item.orderStatus)}>{item.orderStatusLabel}</Tag>
                    </div>

                    <div className="profile-campus-order-summary">
                      <div>
                        <span>方向</span>
                        <strong>{item.intentLabel}</strong>
                      </div>
                      <div>
                        <span>分类</span>
                        <strong>{item.categoryLabel}</strong>
                      </div>
                      <div>
                        <span>金额</span>
                        <strong>{item.rewardLabel}</strong>
                      </div>
                      <div>
                        <span>截止</span>
                        <strong>{item.deadlineLabel}</strong>
                      </div>
                    </div>

                    <div className="profile-campus-order-meta">
                      <div>
                        <EnvironmentOutlined />
                        <span>{item.route.label}</span>
                      </div>
                      <div>
                        <span>预计 {item.estimatedMinutes} 分钟</span>
                        <em>{counterpartPresentation.creditBadge.label}</em>
                      </div>
                    </div>

                    <div className="profile-order-actions">
                      {item.actionState.canOpenConversation && item.conversationId ? (
                        <Button icon={<MessageOutlined />} onClick={() => navigate(`/messages?conversationId=${item.conversationId}`)}>
                          {item.actionLabels.conversation ?? '看消息'}
                        </Button>
                      ) : null}
                      {item.actionState.canCancel ? (
                        <Button
                          danger
                          loading={actingCampusOrderId === item.id}
                          onClick={() => void handleCampusServiceOrderCancel(item)}
                        >
                          {item.actionLabels.cancel ?? '取消'}
                        </Button>
                      ) : null}
                      {item.actionState.canComplete ? (
                        <Button
                          loading={actingCampusOrderId === item.id}
                          onClick={() => void handleCampusServiceOrderComplete(item)}
                        >
                          {item.actionLabels.complete ?? '提交完成'}
                        </Button>
                      ) : null}
                      <Button type="primary" onClick={() => navigate(`/campus-services/${item.listingId}`)}>
                        查看详情
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  async function reloadCampusServicePanels() {
    if (!currentUser) {
      return;
    }

    setLoadingCampusServices(true);
    setLoadingParticipatedCampusServices(true);
    try {
      const [published, participated] = await Promise.all([
        fetchCampusServiceListings({ ownerId: currentUser.id, page: 1, pageSize: 60, sort: 'newest' }),
        fetchCampusServiceOrders({ page: 1, pageSize: 60 })
      ]);
      setCampusServices(published.items);
      setParticipatedCampusServices(participated.items);
    } catch {
      setCampusServices([]);
      setParticipatedCampusServices([]);
    } finally {
      setLoadingCampusServices(false);
      setLoadingParticipatedCampusServices(false);
    }
  }

  async function handleCampusServiceOrderComplete(item: CampusServiceOrderListItem) {
    setActingCampusOrderId(item.id);
    try {
      await completeCampusServiceOrder(item.id);
      await reloadCampusServicePanels();
      message.success(`“${item.title}”已更新为最新进度`);
    } catch (error) {
      message.error(getApiErrorMessage(error, '更新服务单失败'));
    } finally {
      setActingCampusOrderId(null);
    }
  }

  async function handleCampusServiceOrderCancel(item: CampusServiceOrderListItem) {
    setActingCampusOrderId(item.id);
    try {
      await cancelCampusServiceOrder(item.id);
      await reloadCampusServicePanels();
      message.success(`“${item.title}”已取消`);
    } catch (error) {
      message.error(getApiErrorMessage(error, '取消服务单失败'));
    } finally {
      setActingCampusOrderId(null);
    }
  }

  async function handlePublisherCampusServiceOrderConfirm(item: CampusServiceOrderListItem) {
    setActingCampusOrderId(item.id);
    try {
      await confirmCampusServiceOrder(item.id);
      await reloadCampusServicePanels();
      setPublisherOrderWorkbenchReloadVersion((value) => value + 1);
      message.success(`“${item.title}”已确认`);
    } catch (error) {
      message.error(getApiErrorMessage(error, '确认服务单失败'));
    } finally {
      setActingCampusOrderId(null);
    }
  }

  async function handlePublisherCampusServiceOrderReject(item: CampusServiceOrderListItem) {
    setActingCampusOrderId(item.id);
    try {
      await rejectCampusServiceOrder(item.id, {
        reason: publisherOrderDialogReason.trim() || undefined
      });
      setPublisherOrderDialogTarget(null);
      setPublisherOrderDialogReason('');
      await reloadCampusServicePanels();
      setPublisherOrderWorkbenchReloadVersion((value) => value + 1);
      message.success(`“${item.title}”已拒绝`);
    } catch (error) {
      message.error(getApiErrorMessage(error, '拒绝服务单失败'));
    } finally {
      setActingCampusOrderId(null);
    }
  }

  async function handlePublisherCampusServiceOrderCancel(item: CampusServiceOrderListItem) {
    setActingCampusOrderId(item.id);
    try {
      await cancelCampusServiceOrder(item.id, {
        reason: publisherOrderDialogReason.trim() || undefined
      });
      setPublisherOrderDialogTarget(null);
      setPublisherOrderDialogReason('');
      await reloadCampusServicePanels();
      setPublisherOrderWorkbenchReloadVersion((value) => value + 1);
      message.success(`“${item.title}”已取消`);
    } catch (error) {
      message.error(getApiErrorMessage(error, '取消服务单失败'));
    } finally {
      setActingCampusOrderId(null);
    }
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

    if (routeState?.section === 'profile') {
      setActiveSection('profile');
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
    emptyDescription?: string,
    options?: {
      hidePriceMeta?: boolean;
    }
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
	            priceMeta={options?.hidePriceMeta ? undefined : item.status === 'ON_SALE' ? undefined : '交易留痕'}
	            tagItems={[item.status === 'ON_SALE' ? '在售' : item.status]}
	            onOpen={() => navigate(`/products/${item.id}`)}
	          />
        )}
      />
    );
  }

  function renderHistoryList(items: HistoryItem[], loading: boolean) {
    if (loading) {
      return <Skeleton active paragraph={{ rows: 8 }} />;
    }

    if (!items.length) {
      return <EmptyState className="is-shell" title="暂无历史浏览" />;
    }

    const groups = createHistoryGroups(items);

    return (
      <div className="profile-history-groups">
        {groups.map((group) => (
          <section key={group.key} className="profile-history-group">
            <div className="profile-history-group-head">
              <strong>{group.label}</strong>
              <span>{group.items.length} 条浏览</span>
            </div>
            <ProductGrid
              items={group.items}
              renderItem={(item, index) => {
                if (isCampusServiceHistoryItem(item)) {
                  return (
                    <ProductSummaryCard
                      key={`service-${item.id}`}
                      item={{
                        ...item,
                        tags: item.summaryTags,
                      }}
                      imageSrc={item.imageUrl || '/images/products/demo-square.png'}
                      className="profile-fish-card service-task-card profile-history-service-card"
                      coverMeta={(
                        <div className="service-card-cover-stack">
                          <span className="service-card-cover-type">{item.intentLabel}</span>
                          <span className="service-card-cover-type">{item.statusLabel}</span>
                        </div>
                      )}
                      bodyMeta={item.sellerName}
                      priceValue={item.rewardLabel}
                      priceMeta="校园服务"
                      onOpen={() => navigate(`/campus-services/${item.id}`)}
                    />
                  );
                }

                const product = item as ProductHistoryItem;

                return (
                  <ProductSummaryCard
                    key={`product-${product.id}`}
                    className="profile-fish-card profile-history-product-card"
                    item={product}
                    imageSrc={getProductImage(product, index)}
                    priceMeta={undefined}
                    onOpen={() => navigate(`/products/${product.id}`)}
                  />
                );
              }}
            />
          </section>
        ))}
      </div>
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

  async function handleProfileSubmit(values: {
    displayName: string;
    studentId?: string;
    email: string;
    realName: string;
    college: string;
    phone: string;
    avatarUrl?: string;
  }) {
    if (!currentUser) {
      return;
    }

    setProfileSaving(true);
    try {
      const result = await updateUserProfile(currentUser.id, values);
      const trustResult = await fetchUserTrustSummary(currentUser.id);
      if (pendingAvatarUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(pendingAvatarUrl);
      }
      setProfile(result);
      setTrustSummary(trustResult);
      setPendingAvatarUrl(null);
      setSelectedAvatarUrl(result.avatarUrl ?? AVATAR_OPTIONS[0]?.src ?? '');
      form.setFieldsValue({
        ...values,
        studentId: result.studentId ?? undefined,
        avatarUrl: result.avatarUrl ?? ''
      });
      message.success('资料已更新');
      await refreshCurrentUser();
    } catch (error) {
      message.error(getApiErrorMessage(error, '资料更新失败'));
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleAvatarConfirm(file: File, previewUrl: string) {
    if (!currentUser) {
      return;
    }

    try {
      const uploaded = await uploadImageAsset(file, 'avatar');
      if (pendingAvatarUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(pendingAvatarUrl);
      }
      setPendingAvatarUrl(previewUrl);
      form.setFieldValue('avatarUrl', uploaded.url);
      setSelectedAvatarUrl(previewUrl);
      setAvatarModalOpen(false);
      message.success('头像已上传，保存资料后生效');
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      message.error(getApiErrorMessage(error, '头像上传失败'));
    }
  }

  function handlePresetAvatarSelect(src: string) {
    if (pendingAvatarUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(pendingAvatarUrl);
    }
    setPendingAvatarUrl(null);
    setSelectedAvatarUrl(src);
    form.setFieldValue('avatarUrl', src);
  }

  function renderProfileEditor() {
    if (loadingProfile) {
      return renderSectionPanel('资料编辑', <Skeleton active paragraph={{ rows: 8 }} />);
    }

    const isCustomAvatarSelected = Boolean(selectedAvatarUrl) && !PRESET_AVATAR_URLS.has(selectedAvatarUrl);

    return renderSectionPanel(
      '资料编辑',
      <Form
        form={form}
        layout="vertical"
        className="profile-edit-form"
        onFinish={(values) => void handleProfileSubmit(values as {
          displayName: string;
          studentId?: string;
          email: string;
          realName: string;
          college: string;
          phone: string;
          avatarUrl?: string;
        })}
      >
        <div className="register-section">
          <div className="register-section-head">
            <strong>头像</strong>
          </div>
          <div className="register-avatar-grid" role="radiogroup" aria-label="选择头像">
            {AVATAR_OPTIONS.map((item, index) => (
              <button
                key={item.key}
                type="button"
                className={selectedAvatarUrl === item.src ? 'register-avatar-option active' : 'register-avatar-option'}
                onClick={() => {
                  handlePresetAvatarSelect(item.src);
                }}
                aria-pressed={selectedAvatarUrl === item.src}
                aria-label={item.key === 'default' ? '选择默认头像' : `选择预设头像 ${index}`}
              >
                <UserAvatar src={item.src} alt="" fallbackLabel="" />
              </button>
            ))}
            <button
              type="button"
              className={isCustomAvatarSelected ? 'register-avatar-option active custom' : 'register-avatar-option custom'}
              onClick={() => setAvatarModalOpen(true)}
              aria-pressed={isCustomAvatarSelected}
              aria-label="上传自定义头像"
            >
              {isCustomAvatarSelected ? (
                <UserAvatar src={selectedAvatarUrl} alt="" fallbackLabel="" />
              ) : (
                <span className="register-avatar-upload-placeholder" aria-hidden="true">+</span>
              )}
            </button>
          </div>
        </div>
        <div className="register-section">
          <div className="register-section-head">
            <strong>基础信息</strong>
          </div>
        </div>
        <Form.Item name="avatarUrl" hidden>
          <Input />
        </Form.Item>
        <div className="profile-form-grid">
          <Form.Item label="展示名" name="displayName" rules={[{ required: true, message: '请输入展示名' }]}>
            <Input placeholder="例如：王同学" />
          </Form.Item>
          <Form.Item label="邮箱" name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入正确邮箱' }]}>
            <Input placeholder="例如：student@campus.edu.cn" />
          </Form.Item>
          <Form.Item label="学号" name="studentId">
            <Input placeholder="选填，例如：20260001" />
          </Form.Item>
          <Form.Item label="真实姓名" name="realName" rules={[{ required: true, message: '请输入真实姓名' }]}>
            <Input placeholder="例如：王小明" />
          </Form.Item>
          <Form.Item label="学院" name="college" rules={[{ required: true, message: '请输入学院' }]}>
            <Select
              placeholder="请选择学院"
              options={BJFU_COLLEGES.map((item) => ({ value: item, label: item }))}
              allowClear
            />
          </Form.Item>
          <Form.Item label="手机号" name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input placeholder="请输入手机号" />
          </Form.Item>
        </div>
        <div className="profile-form-actions">
          <Button type="primary" htmlType="submit" loading={profileSaving}>保存资料</Button>
        </div>
      </Form>,
      'profile-editor-panel'
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
        <EmptyState className="is-shell" title="暂无关注内容" />,
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
              aria-label={`查看 ${presentation.displayName} 的主页`}
              onClick={() => navigate(`/users/${item.id}`)}
            >
              <UserAvatar
                src={presentation.avatarUrl}
                alt={`${presentation.displayName}的头像`}
                fallbackLabel={presentation.initial}
                className="profile-following-avatar"
              />
              <div className="profile-following-copy">
                <div className="profile-following-head">
                  <strong>{presentation.displayName}</strong>
                  <span>{presentation.creditBadge.label}</span>
                </div>
                <p>{presentation.collegeLabel}</p>
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
      const servicePanelLoaded = publishedScope === 'products'
        ? loadingProducts
        : publishedScope === 'campus-services-request' || publishedScope === 'campus-services-offer'
          ? loadingCampusServices
          : loadingParticipatedCampusServices;
      const servicePanelHasItems = publishedScope === 'products'
        ? publishedProducts.length
        : publishedScope === 'campus-services-request'
          ? publishedRequestCampusServices.length
          : publishedScope === 'campus-services-offer'
            ? publishedOfferCampusServices.length
            : publishedScope === 'campus-services-provider'
              ? providerCampusServices.length
              : bookingCampusServices.length;

      return renderSectionPanel(
        campusServiceSectionTitle,
        renderPublishedScope(),
        (servicePanelHasItems || servicePanelLoaded)
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
          '暂无收藏'
        ),
        favoriteItems.length || loadingFavorites ? undefined : 'is-empty'
      );
    }

    if (activeSection === 'orders-buying') {
      return renderOrderList(
        buyingOrders,
        loadingOrders,
        '我买到的',
        ''
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
        renderHistoryList(historyItems, loadingHistory),
        historyItems.length || loadingHistory ? undefined : 'is-empty'
      );
    }

    if (activeSection === 'following') {
      return renderFollowingList(followingUsers, loadingFollowing);
    }

    return renderProfileEditor();
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
              <button
                type="button"
                className="profile-avatar-badge profile-avatar-trigger"
                onClick={openProfileEditor}
                aria-label="编辑资料"
              >
                <UserAvatar
                  src={userPresentation.avatarUrl}
                  alt={`${userPresentation.displayName}的头像`}
                  fallbackLabel={userPresentation.initial}
                  className="profile-avatar-image"
                />
                <span className="profile-avatar-overlay">
                  <ProfileOutlined />
                  <span>编辑</span>
                </span>
              </button>
              <div className="profile-hero-meta">
                <div className="profile-hero-title-row">
                  <h1>{userPresentation.displayName}</h1>
                  <div className="profile-hero-badges">
                    <div className={`ui-credit-badge is-${userPresentation.creditBadge.tone}`}>
                      <span className="ui-credit-badge-label">{userPresentation.creditBadge.label}</span>
                    </div>
                    <button
                      type="button"
                      className="profile-credit-entry"
                      onClick={() => navigate('/credit-center')}
                    >
                      <SafetyCertificateOutlined />
                      <span>信用中心</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {renderActiveSection()}
        </div>
      </div>

      <ImageCropUploadModal
        open={avatarModalOpen}
        title="上传头像"
        shape="round"
        aspect={1}
        outputWidth={512}
        outputHeight={512}
        onCancel={() => setAvatarModalOpen(false)}
        onConfirm={handleAvatarConfirm}
      />

      <Modal
        open={Boolean(publisherOrderWorkbenchListing)}
        title={publisherOrderWorkbenchListing ? `订单管理 · ${publisherOrderWorkbenchListing.title}` : '订单管理'}
        footer={null}
        width={960}
        onCancel={() => {
          setPublisherOrderWorkbenchListing(null);
          setPublisherOrderWorkbenchReloadVersion(0);
        }}
      >
        {publisherOrderWorkbenchListing ? (
          <CampusServicePublisherOrderWorkbench
            listing={publisherOrderWorkbenchListing}
            className="profile-publisher-order-workbench"
            initialGroup={publisherOrderWorkbenchGroup}
            reloadVersion={publisherOrderWorkbenchReloadVersion}
            emptyDescription="当前筛选下还没有相关订单。"
            onError={(nextMessage) => message.error(nextMessage)}
            onConfirmOrder={(item) => void handlePublisherCampusServiceOrderConfirm(item)}
            onRejectOrder={(item) => {
              setPublisherOrderDialogTarget(item);
              setPublisherOrderDialogReason('');
            }}
            onCompleteOrder={(item) => void handleCampusServiceOrderComplete(item)}
            onCancelOrder={(item) => {
              setPublisherOrderDialogTarget(item);
              setPublisherOrderDialogReason('');
            }}
            actingOrderId={actingCampusOrderId}
          />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(publisherOrderDialogTarget)}
        title={publisherOrderDialogTarget?.actionState.canReject ? (publisherOrderDialogTarget.actionLabels.reject ?? '拒绝申请') : (publisherOrderDialogTarget?.actionLabels.cancel ?? '取消服务单')}
        onCancel={() => {
          setPublisherOrderDialogTarget(null);
          setPublisherOrderDialogReason('');
        }}
        onOk={() => {
          if (!publisherOrderDialogTarget) {
            return;
          }
          void (
            publisherOrderDialogTarget.actionState.canReject
              ? handlePublisherCampusServiceOrderReject(publisherOrderDialogTarget)
              : handlePublisherCampusServiceOrderCancel(publisherOrderDialogTarget)
          );
        }}
        okText={publisherOrderDialogTarget?.actionState.canReject ? (publisherOrderDialogTarget.actionLabels.reject ?? '确认拒绝') : (publisherOrderDialogTarget?.actionLabels.cancel ?? '确认取消')}
        okButtonProps={{ danger: true, loading: publisherOrderDialogTarget ? actingCampusOrderId === publisherOrderDialogTarget.id : false }}
      >
        <Input.TextArea
          rows={4}
          value={publisherOrderDialogReason}
          onChange={(event) => setPublisherOrderDialogReason(event.target.value)}
        />
      </Modal>
    </div>
  );
}
