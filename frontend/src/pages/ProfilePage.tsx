import {
  AppstoreOutlined,
  SafetyCertificateOutlined,
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
import { Button, Empty, Form, Input, InputNumber, Modal, Select, Skeleton, message } from 'antd';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AVATAR_FRAMES, type AvatarFrameKey, UserAvatar } from '../components/user/UserAvatar';
import { EmptyState } from '../components/feedback';
import { ImageCropUploadModal } from '../components/image-upload';
import { CampusServiceOrderCard, CampusServicePublisherOrderWorkbench, ProductOrderCard } from '../components/listing';
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
  fetchUserReceivedReviews,
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
  type UserReceivedReviewItem,
  type UserTrustSummary
} from '../services/api';
import { useAuthState } from '../services/auth-state';
import { hasTradingAccess, isGuestUser } from '../services/session';
import { ConfirmReasonModal, CreditBadge, ProfileOrderScopePanel } from '../components/ui';
import { UserReviewCard } from '../components/user/UserReviewCard';
import { UserNameWithBadge } from '../components/user/UserNameWithBadge';
import { getListingStatusPresentation } from '../utils/listingStatus';
import {
  executeCampusServiceOrderAction,
  getCampusServiceOrderRejectOrCancelText
} from '../utils/campusServiceOrderActions';
import { getProductImage, resolvePrimaryProductImage } from '../utils/productCover';
import { getUserPresentation } from '../utils/userPresentation';
import type { PublisherOrderGroupKey } from '../components/listing/CampusServicePublisherOrderWorkbench';

type ProfileSection =
  | 'items'
  | 'campus-services-provider'
  | 'campus-services-booking'
  | 'orders-buying'
  | 'orders-selling'
  | 'favorites'
  | 'history'
  | 'following'
  | 'reviews'
  | 'profile';
type PublishedScope = 'products' | 'campus-services-request' | 'campus-services-offer';
type OrderProgressScope = 'active' | 'ended';

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

export function resolveProfileOrdersSection(orderScope: unknown) {
  if (orderScope === 'selling') {
    return 'orders-selling' as const;
  }

  if (orderScope === 'provider') {
    return 'campus-services-provider' as const;
  }

  if (orderScope === 'booking') {
    return 'campus-services-booking' as const;
  }

  return 'orders-buying' as const;
}

const PRESET_AVATAR_URLS = new Set<string>(AVATAR_OPTIONS.map((item) => item.src));
const AVATAR_FRAME_KEYS = new Set<AvatarFrameKey | 'none'>(['none', ...AVATAR_FRAMES.map((item) => item.key)]);

function isPresetAvatarUrl(url?: string | null) {
  return Boolean(url?.trim()) && PRESET_AVATAR_URLS.has(url!.trim());
}

const activeOrderStatuses = new Set(['PENDING', 'IN_PROGRESS', 'WAITING_REVIEW']);

function matchesOrderProgressScope(status: string, scope: OrderProgressScope) {
  return scope === 'active' ? activeOrderStatuses.has(status) : !activeOrderStatuses.has(status);
}

function matchesCampusServiceOrderProgressScope(
  item: CampusServiceOrderListItem,
  scope: OrderProgressScope
) {
  const isEnded = getCampusServiceOrderGroupKey(item) === 'ended';
  return scope === 'active' ? !isEnded : isEnded;
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

function getCampusServiceListingGroupKey(item: CampusServiceListItem): CampusServiceGroupKey {
  if (item.actionState.canConfirm || item.actionState.canReject) {
    return 'pending';
  }

  if (item.actionLabels.complete === '确认完工' || item.actionLabels.complete === '确认服务完成') {
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
    { key: 'waiting-complete', title: '待完成确认', description: '一方已提交完工，等待另一方确认。', items: [] },
    { key: 'ended', title: '已结束', description: '已完成、已取消、已拒绝或已过期。', items: [] }
  ];
  const groupMap = new Map(baseGroups.map((group) => [group.key, group]));

  items.forEach((item) => {
    groupMap.get(resolver(item))?.items.push(item);
  });

  return baseGroups.filter((group) => group.items.length > 0);
}

function renderPublishedProductCard(
  item: ProductSummary,
  index: number,
  navigate: ReturnType<typeof useNavigate>
) {
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
}

function renderCampusServiceMarketCard(
  item: CampusServiceListItem,
  navigate: ReturnType<typeof useNavigate>
) {
  return (
    <ProductSummaryCard
      key={item.id}
      item={item}
      imageSrc={resolvePrimaryProductImage({
        title: item.title,
        category: item.categoryLabel,
        price: item.reward,
        imageUrl: item.imageUrl
      }, item.id)}
      className="service-task-card"
      priceValue={item.rewardLabel}
      onOpen={() => navigate(`/campus-services/${item.id}`)}
    />
  );
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
      return resolveProfileOrdersSection(routeState.orderScope);
    }
    return 'items';
  });
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [campusServices, setCampusServices] = useState<CampusServiceListItem[]>([]);
  const [participatedCampusServices, setParticipatedCampusServices] = useState<CampusServiceOrderListItem[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [followingUsers, setFollowingUsers] = useState<FollowingUser[]>([]);
  const [receivedReviews, setReceivedReviews] = useState<UserReceivedReviewItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [publishedScope, setPublishedScope] = useState<PublishedScope>('products');
  const [buyingOrderScope, setBuyingOrderScope] = useState<OrderProgressScope>('active');
  const [sellingOrderScope, setSellingOrderScope] = useState<OrderProgressScope>('active');
  const [providerOrderScope, setProviderOrderScope] = useState<OrderProgressScope>('active');
  const [bookingOrderScope, setBookingOrderScope] = useState<OrderProgressScope>('active');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCampusServices, setLoadingCampusServices] = useState(true);
  const [loadingParticipatedCampusServices, setLoadingParticipatedCampusServices] = useState(true);
  const [loadingFavorites, setLoadingFavorites] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingFollowing, setLoadingFollowing] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trustSummary, setTrustSummary] = useState<UserTrustSummary | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [customAvatarPreviewUrl, setCustomAvatarPreviewUrl] = useState<string | null>(null);
  const [customAvatarValueUrl, setCustomAvatarValueUrl] = useState<string | null>(null);
  const [actingCampusOrderId, setActingCampusOrderId] = useState<number | null>(null);
  const [publisherOrderWorkbenchListing, setPublisherOrderWorkbenchListing] = useState<CampusServiceListItem | null>(null);
  const [publisherOrderWorkbenchGroup, setPublisherOrderWorkbenchGroup] = useState<PublisherOrderGroupKey>('PENDING');
  const [publisherOrderWorkbenchReloadVersion, setPublisherOrderWorkbenchReloadVersion] = useState(0);
  const [publisherOrderDialogTarget, setPublisherOrderDialogTarget] = useState<CampusServiceOrderListItem | null>(null);
  const [publisherOrderDialogReason, setPublisherOrderDialogReason] = useState('');
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>(AVATAR_OPTIONS[0]?.src ?? '');
  const [selectedAvatarFrame, setSelectedAvatarFrame] = useState<AvatarFrameKey | 'none'>('none');
  const [form] = Form.useForm<UserProfile & { studentId?: string; phone: string; realName: string; graduationYear?: number | null; avatarFrame?: string }>();

  useEffect(() => () => {
    if (customAvatarPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(customAvatarPreviewUrl);
    }
  }, [customAvatarPreviewUrl]);

  function syncAvatarSelection(avatarUrl?: string | null) {
    const normalizedAvatarUrl = avatarUrl?.trim() ?? '';
    const fallbackAvatarUrl = AVATAR_OPTIONS[0]?.src ?? '';

    if (normalizedAvatarUrl && !isPresetAvatarUrl(normalizedAvatarUrl)) {
      setCustomAvatarPreviewUrl(normalizedAvatarUrl);
      setCustomAvatarValueUrl(normalizedAvatarUrl);
      setSelectedAvatarUrl(normalizedAvatarUrl);
      return;
    }

    setCustomAvatarPreviewUrl(null);
    setCustomAvatarValueUrl(null);
    setSelectedAvatarUrl(normalizedAvatarUrl || fallbackAvatarUrl);
  }

  useEffect(() => {
    if (!hasTradingAccess(currentUser) || !currentUser) {
      setProducts([]);
      setCampusServices([]);
      setFavoriteItems([]);
      setHistoryItems([]);
      setFollowingUsers([]);
      setReceivedReviews([]);
      setOrders([]);
      setParticipatedCampusServices([]);
      setLoadingProducts(false);
      setLoadingCampusServices(false);
      setLoadingParticipatedCampusServices(false);
      setLoadingFavorites(false);
      setLoadingHistory(false);
      setLoadingFollowing(false);
      setLoadingReviews(false);
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
    setLoadingReviews(true);
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

    fetchUserReceivedReviews(currentUser.id)
      .then((result) => {
        if (!cancelled) {
          setReceivedReviews(result.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReceivedReviews([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingReviews(false);
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
          syncAvatarSelection(profileResult.avatarUrl);
          setSelectedAvatarFrame(
            profileResult.avatarFrame && AVATAR_FRAME_KEYS.has(profileResult.avatarFrame as AvatarFrameKey | 'none')
              ? (profileResult.avatarFrame as AvatarFrameKey | 'none')
              : 'none'
          );
          form.setFieldsValue({
            displayName: profileResult.displayName,
            studentId: profileResult.studentId ?? undefined,
            email: profileResult.email,
            realName: profileResult.realName,
            college: profileResult.college,
            graduationYear: profileResult.graduationYear ?? undefined,
            phone: profileResult.phone,
            avatarUrl: profileResult.avatarUrl ?? '',
            avatarFrame: profileResult.avatarFrame ?? 'none'
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

  const providerActiveCampusServices = useMemo(
    () => providerCampusServices.filter((item) => matchesCampusServiceOrderProgressScope(item, 'active')),
    [providerCampusServices]
  );

  const providerEndedCampusServices = useMemo(
    () => providerCampusServices.filter((item) => matchesCampusServiceOrderProgressScope(item, 'ended')),
    [providerCampusServices]
  );

  const bookingActiveCampusServices = useMemo(
    () => bookingCampusServices.filter((item) => matchesCampusServiceOrderProgressScope(item, 'active')),
    [bookingCampusServices]
  );

  const bookingEndedCampusServices = useMemo(
    () => bookingCampusServices.filter((item) => matchesCampusServiceOrderProgressScope(item, 'ended')),
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

  const buyingActiveOrders = useMemo(
    () => buyingOrders.filter((item) => matchesOrderProgressScope(item.status, 'active')),
    [buyingOrders]
  );

  const buyingEndedOrders = useMemo(
    () => buyingOrders.filter((item) => matchesOrderProgressScope(item.status, 'ended')),
    [buyingOrders]
  );

  const sellingActiveOrders = useMemo(
    () => sellingOrders.filter((item) => matchesOrderProgressScope(item.status, 'active')),
    [sellingOrders]
  );

  const sellingEndedOrders = useMemo(
    () => sellingOrders.filter((item) => matchesOrderProgressScope(item.status, 'ended')),
    [sellingOrders]
  );

  const sidebarItems: SidebarItem[] = [
    {
      key: 'items',
      icon: <AppstoreOutlined />,
      label: '我发布的',
      count: publishedProducts.length + publishedRequestCampusServices.length + publishedOfferCampusServices.length
    },
    { key: 'campus-services-provider', icon: <InboxOutlined />, label: '我接的单', count: providerCampusServices.length },
    { key: 'campus-services-booking', icon: <ProfileOutlined />, label: '我预约的服务', count: bookingCampusServices.length },
    { key: 'orders-buying', icon: <ShoppingOutlined />, label: '我买到的', count: buyingOrders.length },
    { key: 'orders-selling', icon: <ShopOutlined />, label: '我卖出的', count: sellingOrders.length },
    { key: 'favorites', icon: <StarOutlined />, label: '我的收藏', count: favoriteItems.length },
    { key: 'history', icon: <EyeOutlined />, label: '历史浏览', count: historyItems.length },
    { key: 'following', icon: <HeartOutlined />, label: '我的关注', count: followingUsers.length },
    { key: 'reviews', icon: <MessageOutlined />, label: '收到的评价', count: receivedReviews.length }
  ];

  function openProfileEditor() {
    setActiveSection('profile');
  }

  const campusServiceSectionTitle = publishedScope === 'products'
    ? '我发布的'
    : publishedScope === 'campus-services-request'
      ? '我发布的需求'
      : '我发布的服务';

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
              : null}
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
            <div className="profile-campus-service-group-head">
              <div>
                <strong>{group.title}</strong>
              </div>
            </div>
            <ProductGrid
              items={group.items}
              renderItem={(item) => (
                <div key={item.id} className="profile-published-service-card">
                  {renderCampusServiceMarketCard(item, navigate)}
                  <div className="profile-published-service-actions">
                    <button
                      type="button"
                      className="fish-item-link active"
                      onClick={() => {
                        setPublisherOrderWorkbenchListing(item);
                        setPublisherOrderWorkbenchGroup('PENDING');
                        setPublisherOrderWorkbenchReloadVersion((value) => value + 1);
                      }}
                    >
                      <InboxOutlined />
                      <span>申请与预约管理</span>
                    </button>
                  </div>
                </div>
              )}
            />
          </section>
        ))}
      </div>
    );
  }

  function renderParticipatedCampusServiceOrders(
    items: CampusServiceOrderListItem[],
    loading: boolean,
    title: string,
    emptyDescription: string,
    scope: OrderProgressScope,
    onScopeChange: (scope: OrderProgressScope) => void,
    scopeCounts: Record<OrderProgressScope, number>
  ) {
    let content: ReactNode;

    if (loading) {
      content = <Skeleton active paragraph={{ rows: 8 }} />;
    } else if (items.length) {
      content = (
        <div className="compact-list profile-orders-list">
          {items.map((item) => (
            <CampusServiceOrderCard
              key={item.id}
              order={item}
              actingOrderId={actingCampusOrderId}
              onOpenConversation={(current) => navigate(`/messages?conversationId=${current.conversationId}`)}
              onCancel={(current) => void handleCampusServiceOrderCancel(current)}
              onComplete={(current) => void handleCampusServiceOrderComplete(current)}
              onViewDetail={(current) => navigate(`/campus-service-orders/${current.id}`)}
              layout="compact"
            />
          ))}
        </div>
      );
    } else {
      content = <EmptyState className="is-shell" title={`暂无${title}`} description={emptyDescription} />;
    }

    return (
      <ProfileOrderScopePanel
        title={title}
        scope={scope}
        onScopeChange={onScopeChange}
        scopeCounts={scopeCounts}
      >
        {content}
      </ProfileOrderScopePanel>
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
    await executeCampusServiceOrderAction({
      run: () => completeCampusServiceOrder(item.id),
      onSuccess: () => reloadCampusServicePanels(),
      onFinally: () => setActingCampusOrderId(null),
      notifySuccess: (text) => message.success(text),
      notifyError: (text) => message.error(text),
      successMessage: `“${item.title}”已更新为最新进度`,
      fallbackErrorMessage: '更新协作进度失败'
    });
  }

  async function handleCampusServiceOrderCancel(item: CampusServiceOrderListItem) {
    setActingCampusOrderId(item.id);
    await executeCampusServiceOrderAction({
      run: () => cancelCampusServiceOrder(item.id),
      onSuccess: () => reloadCampusServicePanels(),
      onFinally: () => setActingCampusOrderId(null),
      notifySuccess: (text) => message.success(text),
      notifyError: (text) => message.error(text),
      successMessage: `“${item.title}”已取消`,
      fallbackErrorMessage: '取消协作失败'
    });
  }

  async function handlePublisherCampusServiceOrderConfirm(item: CampusServiceOrderListItem) {
    setActingCampusOrderId(item.id);
    await executeCampusServiceOrderAction({
      run: () => confirmCampusServiceOrder(item.id),
      onSuccess: async () => {
        await reloadCampusServicePanels();
        setPublisherOrderWorkbenchReloadVersion((value) => value + 1);
      },
      onFinally: () => setActingCampusOrderId(null),
      notifySuccess: (text) => message.success(text),
      notifyError: (text) => message.error(text),
      successMessage: `“${item.title}”已确认`,
      fallbackErrorMessage: '确认申请失败'
    });
  }

  async function handlePublisherCampusServiceOrderReject(item: CampusServiceOrderListItem) {
    setActingCampusOrderId(item.id);
    await executeCampusServiceOrderAction({
      run: () => rejectCampusServiceOrder(item.id, {
        reason: publisherOrderDialogReason.trim() || undefined
      }),
      onSuccess: async () => {
        setPublisherOrderDialogTarget(null);
        setPublisherOrderDialogReason('');
        await reloadCampusServicePanels();
        setPublisherOrderWorkbenchReloadVersion((value) => value + 1);
      },
      onFinally: () => setActingCampusOrderId(null),
      notifySuccess: (text) => message.success(text),
      notifyError: (text) => message.error(text),
      successMessage: `“${item.title}”已拒绝`,
      fallbackErrorMessage: '拒绝申请失败'
    });
  }

  async function handlePublisherCampusServiceOrderCancel(item: CampusServiceOrderListItem) {
    setActingCampusOrderId(item.id);
    await executeCampusServiceOrderAction({
      run: () => cancelCampusServiceOrder(item.id, {
        reason: publisherOrderDialogReason.trim() || undefined
      }),
      onSuccess: async () => {
        setPublisherOrderDialogTarget(null);
        setPublisherOrderDialogReason('');
        await reloadCampusServicePanels();
        setPublisherOrderWorkbenchReloadVersion((value) => value + 1);
      },
      onFinally: () => setActingCampusOrderId(null),
      notifySuccess: (text) => message.success(text),
      notifyError: (text) => message.error(text),
      successMessage: `“${item.title}”已取消`,
      fallbackErrorMessage: '取消协作失败'
    });
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
      setActiveSection(resolveProfileOrdersSection(routeState.orderScope));
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
        className={publishedScope === 'products' ? 'fish-feed-grid' : undefined}
        renderItem={(item, index) => (
          options?.hidePriceMeta
            ? (
              <ProductSummaryCard
                key={item.id}
                item={item}
                imageSrc={getProductImage(item, index)}
                priceMeta={undefined}
                tagItems={[item.status === 'ON_SALE' ? '在售' : item.status]}
                onOpen={() => navigate(`/products/${item.id}`)}
              />
            )
            : renderPublishedProductCard(item, index, navigate)
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
                        id: item.id,
                        title: item.title,
                        description: item.description,
                        price: item.price,
                        imageUrl: item.imageUrl,
                        tags: item.summaryTags,
                        status: item.status
                      }}
                      imageSrc={item.imageUrl || '/images/products/demo-square.png'}
                      className="profile-fish-card service-task-card"
                      priceValue={item.rewardLabel}
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
    graduationYear: number;
    phone: string;
    avatarUrl?: string;
    avatarFrame?: string;
  }) {
    if (!currentUser) {
      return;
    }

    setProfileSaving(true);
    try {
      const result = await updateUserProfile(currentUser.id, values);
      const trustResult = await fetchUserTrustSummary(currentUser.id);
      setProfile(result);
      setTrustSummary(trustResult);
      syncAvatarSelection(result.avatarUrl);
      setSelectedAvatarFrame(
        result.avatarFrame && AVATAR_FRAME_KEYS.has(result.avatarFrame as AvatarFrameKey | 'none')
          ? (result.avatarFrame as AvatarFrameKey | 'none')
          : 'none'
      );
      form.setFieldsValue({
        ...values,
        studentId: result.studentId ?? undefined,
        avatarUrl: result.avatarUrl ?? '',
        avatarFrame: result.avatarFrame ?? 'none'
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
      setCustomAvatarPreviewUrl(previewUrl);
      setCustomAvatarValueUrl(uploaded.url);
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
    setSelectedAvatarUrl(src);
    form.setFieldValue('avatarUrl', src);
  }

  function handleCustomAvatarSelect() {
    if (customAvatarPreviewUrl && customAvatarValueUrl && selectedAvatarUrl !== customAvatarPreviewUrl) {
      setSelectedAvatarUrl(customAvatarPreviewUrl);
      form.setFieldValue('avatarUrl', customAvatarValueUrl);
      return;
    }

    setAvatarModalOpen(true);
  }

  function handleAvatarFrameSelect(frame: AvatarFrameKey | 'none') {
    if (frame !== 'none' && !profile?.avatarFrameUnlocked) {
      message.warning('请先前往信用中心兑换头像框权益');
      return;
    }

    setSelectedAvatarFrame(frame);
    form.setFieldValue('avatarFrame', frame);
  }

  function renderProfileEditor() {
    if (loadingProfile) {
      return renderSectionPanel('资料编辑', <Skeleton active paragraph={{ rows: 8 }} />);
    }

    const hasCustomAvatarOption = Boolean(customAvatarPreviewUrl && customAvatarValueUrl);
    const isCustomAvatarSelected = hasCustomAvatarOption && selectedAvatarUrl === customAvatarPreviewUrl;
    const avatarFrameUnlocked = Boolean(profile?.avatarFrameUnlocked);

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
          graduationYear: number;
          phone: string;
          avatarUrl?: string;
          avatarFrame?: string;
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
                <UserAvatar src={item.src} alt="" fallbackLabel="" frame={selectedAvatarFrame} />
              </button>
            ))}
            <button
              type="button"
              className={isCustomAvatarSelected ? 'register-avatar-option active custom' : 'register-avatar-option custom'}
              onClick={handleCustomAvatarSelect}
              aria-pressed={isCustomAvatarSelected}
              aria-label={
                hasCustomAvatarOption
                  ? (isCustomAvatarSelected ? '更换自定义头像' : '选择已上传头像')
                  : '上传自定义头像'
              }
            >
              {hasCustomAvatarOption ? (
                <UserAvatar src={customAvatarPreviewUrl} alt="" fallbackLabel="" frame={selectedAvatarFrame} />
              ) : (
                <span className="register-avatar-upload-placeholder" aria-hidden="true">+</span>
              )}
            </button>
          </div>
        </div>
        <div className="register-section">
          <div className="register-section-head">
            <strong>头像框</strong>
            {avatarFrameUnlocked ? <span>已激活</span> : null}
          </div>
          {avatarFrameUnlocked ? (
            <div className="register-avatar-grid profile-avatar-frame-grid" role="radiogroup" aria-label="选择头像框">
              <button
                type="button"
                className={selectedAvatarFrame === 'none' ? 'register-avatar-option active' : 'register-avatar-option'}
                onClick={() => handleAvatarFrameSelect('none')}
                aria-pressed={selectedAvatarFrame === 'none'}
                aria-label="不使用头像框"
              >
                <UserAvatar src={selectedAvatarUrl} alt="" fallbackLabel="" />
              </button>
              {AVATAR_FRAMES.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={selectedAvatarFrame === item.key ? 'register-avatar-option active' : 'register-avatar-option'}
                  onClick={() => handleAvatarFrameSelect(item.key)}
                  aria-pressed={selectedAvatarFrame === item.key}
                  aria-label={`选择头像框 ${item.label}`}
                >
                  <UserAvatar src={selectedAvatarUrl} alt="" fallbackLabel="" frame={item.key} />
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              className="profile-avatar-frame-locked-card"
              onClick={() => navigate('/credit-center')}
              aria-label="前往信用中心兑换头像框"
            >
              <span className="profile-avatar-frame-locked-preview" aria-hidden="true">
                <span className="profile-avatar-frame-locked-stack">
                  <UserAvatar src={selectedAvatarUrl} alt="" fallbackLabel="" frame="blue-glow" />
                  <UserAvatar src={selectedAvatarUrl} alt="" fallbackLabel="" frame="gold-ring" />
                  <UserAvatar src={selectedAvatarUrl} alt="" fallbackLabel="" frame="aurora" />
                </span>
                <span className="profile-avatar-frame-locked-badge">5 款可兑换</span>
              </span>
              <span className="profile-avatar-frame-locked-copy">
                <strong>解锁头像框</strong>
                <span>前往信用中心兑换后，可在个人主页和消息列表中使用。</span>
              </span>
              <span className="profile-avatar-frame-locked-action">去信用中心</span>
            </button>
          )}
        </div>
        <div className="register-section">
          <div className="register-section-head">
            <strong>基础信息</strong>
          </div>
        </div>
        <Form.Item name="avatarUrl" hidden>
          <Input />
        </Form.Item>
        <Form.Item name="avatarFrame" hidden>
          <Input />
        </Form.Item>
        <div className="profile-form-grid">
          <Form.Item label="展示名" name="displayName" rules={[{ required: true, message: '请输入展示名' }]}>
            <Input placeholder="例如：王同学" />
          </Form.Item>
          <Form.Item label="邮箱" name="email" rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入正确邮箱' }]}>
            <Input placeholder="例如：student@campus.edu.cn" />
          </Form.Item>
          <Form.Item label="学号" name="studentId" rules={[{ pattern: /^\d{9}$/, message: '学号必须为 9 位数字' }]}>
            <Input placeholder="选填，例如：202600001" maxLength={9} />
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
          <Form.Item
            label="毕业年份"
            name="graduationYear"
            rules={[
              { required: true, message: '请输入毕业年份' },
              {
                validator: async (_, value) => {
                  const numeric = Number(value);
                  if (Number.isInteger(numeric) && numeric >= 2000 && numeric <= 2100) {
                    return;
                  }
                  throw new Error('请输入正确的毕业年份');
                }
              }
            ]}
          >
            <InputNumber placeholder="例如：2028" min={2000} max={2100} precision={0} style={{ width: '100%' }} />
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

  function renderOrderList(
    items: OrderItem[],
    loading: boolean,
    title: string,
    emptyDescription: string,
    scope: OrderProgressScope,
    onScopeChange: (scope: OrderProgressScope) => void,
    scopeCounts: Record<OrderProgressScope, number>
  ) {
    let content: ReactNode;

    if (loading) {
      content = <Skeleton active paragraph={{ rows: 8 }} />;
    } else if (items.length) {
      content = (
        <div className="compact-list profile-orders-list">
          {items.map((item, index) => (
            <ProductOrderCard
              key={item.id}
              order={item}
              currentUserId={currentUser?.id}
              imageVariant={index}
              onOpenConversation={(current) => navigate(`/messages?conversationId=${current.conversationId}`)}
              onViewDetail={(current) => navigate(`/orders/${current.id}`)}
            />
          ))}
        </div>
      );
    } else {
      content = <EmptyState className="is-shell" title={`暂无${title}`} description={emptyDescription} />;
    }

    return renderSectionPanel(
      title,
      <ProfileOrderScopePanel
        title={title}
        scope={scope}
        onScopeChange={onScopeChange}
        scopeCounts={scopeCounts}
        ariaLabel={`${title}订单进度筛选`}
      >
        {content}
      </ProfileOrderScopePanel>,
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
                frame={(presentation.avatarFrame as AvatarFrameKey | null) ?? undefined}
              />
              <div className="profile-following-copy">
                <div className="profile-following-head">
                  <UserNameWithBadge
                    as="strong"
                    name={presentation.displayName}
                    trustedBadgeUnlocked={presentation.trustedBadgeUnlocked}
                  />
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

  function renderReceivedReviewList(items: UserReceivedReviewItem[], loading: boolean) {
    if (loading) {
      return renderSectionPanel('收到的评价', <Skeleton active paragraph={{ rows: 8 }} />);
    }

    if (!items.length) {
      return renderSectionPanel(
        '收到的评价',
        <EmptyState className="is-shell" title="暂无收到的评价" />,
        'is-empty'
      );
    }

    return renderSectionPanel(
      '收到的评价',
      <div className="order-detail-review-list profile-user-review-list">
        {items.map((review) => (
          <UserReviewCard
            key={review.id}
            reviewerName={review.reviewerName}
            createdAt={review.createdAt}
            rating={review.rating}
            content={review.content}
            reviewerTrustedBadgeUnlocked={review.reviewerTrustedBadgeUnlocked}
          />
        ))}
      </div>
    );
  }

  function renderActiveSection() {
    if (activeSection === 'items') {
      const servicePanelLoaded = publishedScope === 'products'
        ? loadingProducts
        : loadingCampusServices;
      const servicePanelHasItems = publishedScope === 'products'
        ? publishedProducts.length
        : publishedScope === 'campus-services-request'
          ? publishedRequestCampusServices.length
          : publishedOfferCampusServices.length;

      return renderSectionPanel(
        campusServiceSectionTitle,
        renderPublishedScope(),
        (servicePanelHasItems || servicePanelLoaded)
          ? undefined
          : 'is-empty'
      );
    }

    if (activeSection === 'campus-services-provider') {
      return renderSectionPanel(
        '我接的单',
        renderParticipatedCampusServiceOrders(
          providerOrderScope === 'active' ? providerActiveCampusServices : providerEndedCampusServices,
          loadingParticipatedCampusServices,
          '我接的单',
          providerOrderScope === 'active' ? '当前没有进行中的接单记录。' : '还没有已结束的接单记录。',
          providerOrderScope,
          setProviderOrderScope,
          {
            active: providerActiveCampusServices.length,
            ended: providerEndedCampusServices.length
          }
        ),
        providerCampusServices.length || loadingParticipatedCampusServices ? 'profile-order-board' : 'profile-order-board is-empty'
      );
    }

    if (activeSection === 'campus-services-booking') {
      return renderSectionPanel(
        '我预约的服务',
        renderParticipatedCampusServiceOrders(
          bookingOrderScope === 'active' ? bookingActiveCampusServices : bookingEndedCampusServices,
          loadingParticipatedCampusServices,
          '我预约的服务',
          bookingOrderScope === 'active' ? '当前没有进行中的预约记录。' : '还没有已结束的预约记录。',
          bookingOrderScope,
          setBookingOrderScope,
          {
            active: bookingActiveCampusServices.length,
            ended: bookingEndedCampusServices.length
          }
        ),
        bookingCampusServices.length || loadingParticipatedCampusServices ? 'profile-order-board' : 'profile-order-board is-empty'
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
        buyingOrderScope === 'active' ? buyingActiveOrders : buyingEndedOrders,
        loadingOrders,
        '我买到的',
        buyingOrderScope === 'active' ? '当前没有进行中的买入订单。' : '还没有已结束的买入订单。',
        buyingOrderScope,
        setBuyingOrderScope,
        {
          active: buyingActiveOrders.length,
          ended: buyingEndedOrders.length
        }
      );
    }

    if (activeSection === 'orders-selling') {
      return renderOrderList(
        sellingOrderScope === 'active' ? sellingActiveOrders : sellingEndedOrders,
        loadingOrders,
        '我卖出的',
        sellingOrderScope === 'active' ? '当前没有进行中的卖出订单。' : '还没有已结束的卖出订单。',
        sellingOrderScope,
        setSellingOrderScope,
        {
          active: sellingActiveOrders.length,
          ended: sellingEndedOrders.length
        }
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

    if (activeSection === 'reviews') {
      return renderReceivedReviewList(receivedReviews, loadingReviews);
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
                  frame={(userPresentation.avatarFrame as AvatarFrameKey | null) ?? undefined}
                />
                <span className="profile-avatar-overlay">
                  <ProfileOutlined />
                  <span>编辑</span>
                </span>
              </button>
              <div className="profile-hero-meta">
                <div className="profile-hero-title-row">
                  <UserNameWithBadge
                    as="h1"
                    name={userPresentation.displayName}
                    trustedBadgeUnlocked={userPresentation.trustedBadgeUnlocked}
                  />
                  <div className="profile-hero-badges">
                    <CreditBadge
                      tone={userPresentation.creditBadge.tone}
                      label={userPresentation.creditBadge.label}
                    />
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
        title={publisherOrderWorkbenchListing ? `申请与预约管理 · ${publisherOrderWorkbenchListing.title}` : '申请与预约管理'}
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

      <ConfirmReasonModal
        open={Boolean(publisherOrderDialogTarget)}
        title={publisherOrderDialogTarget ? getCampusServiceOrderRejectOrCancelText(publisherOrderDialogTarget).title : '处理当前协作'}
        onCancel={() => {
          setPublisherOrderDialogTarget(null);
          setPublisherOrderDialogReason('');
        }}
        confirmText={publisherOrderDialogTarget ? getCampusServiceOrderRejectOrCancelText(publisherOrderDialogTarget).confirmText : '确认'}
        danger
        loading={publisherOrderDialogTarget ? actingCampusOrderId === publisherOrderDialogTarget.id : false}
        onConfirm={() => {
          if (!publisherOrderDialogTarget) {
            return;
          }
          void (
            publisherOrderDialogTarget.actionState.canReject
              ? handlePublisherCampusServiceOrderReject(publisherOrderDialogTarget)
              : handlePublisherCampusServiceOrderCancel(publisherOrderDialogTarget)
          );
        }}
        reason={publisherOrderDialogReason}
        onReasonChange={setPublisherOrderDialogReason}
      />
    </div>
  );
}
