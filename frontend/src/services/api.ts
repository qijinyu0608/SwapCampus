import axios from 'axios';
import Session from 'supertokens-auth-react/recipe/session';
import { clearCurrentUserStorage, getDevAuthToken, saveDevAuthToken } from './session';

function resolveBrowserApiBaseUrl() {
  if (typeof window === 'undefined') {
    return null;
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3001/api`;
}

const API_BASE_URL = resolveBrowserApiBaseUrl()
  ?? import.meta.env.VITE_API_BASE_URL
  ?? 'http://localhost:3001/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL
});

const authClient = axios.create({
  baseURL: API_BASE_URL
});

Session.addAxiosInterceptors(apiClient);
Session.addAxiosInterceptors(authClient);

apiClient.interceptors.request.use((config) => {
  const devAuthToken = getDevAuthToken();
  if (devAuthToken) {
    config.headers = config.headers ?? {};
    config.headers['x-dev-auth-user-id'] = devAuthToken;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearCurrentUserStorage();
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: unknown, fallback: string) {
  const maybeMessage = typeof error === 'object' && error && 'response' in error
    ? (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
    : null;

  if (Array.isArray(maybeMessage)) {
    return maybeMessage[0] ?? fallback;
  }

  if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
    return maybeMessage;
  }

  return fallback;
}

export type ListingSummary = {
  id: number;
  title: string;
  description: string;
  price: number;
  imageUrl?: string;
  tags: string[];
  status: string;
};

export type ListingParticipantBase = {
  id: number;
  displayName: string;
  studentId?: string | null;
  avatarUrl?: string | null;
  avatarFrame?: string | null;
  creditScore: number;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  accountStatus: 'ACTIVE' | 'BANNED';
};

export type ListingDetailMetaItem = {
  key: string;
  label: string;
  value: string;
};

export type ListingTimelineItem = {
  key: string;
  label: string;
  value: string;
};

export type ListingDetailBase = ListingSummary & {
  type: 'PRODUCT' | 'CAMPUS_SERVICE';
  amountLabel: string;
  images?: string[];
  statusLabel: string;
  publisher: ListingParticipantBase;
  summaryTags: string[];
  metaItems: ListingDetailMetaItem[];
  timeline: ListingTimelineItem[];
};

export type ProductSummary = ListingSummary & {
  category: string;
  condition: string;
  sellerName: string;
  sellerCreditScore?: number;
  sellerVerified?: boolean;
  sellerId?: number;
  favoriteCount?: number;
  wantCount?: number;
  isFavorited?: boolean;
  favoritedAt?: string | null;
};

export type ProductDetail = ProductSummary & {
  images: string[];
  publishedAt: string;
  seller: ListingParticipantBase & {
    creditLevel: string;
    college: string;
    averageRating: number | null;
    completedOrders: number;
  };
  stats: {
    favoriteCount: number;
    reportCount: number;
    wantCount: number;
    viewCount: number;
  };
  compliance: {
    allowedCategory: boolean;
    trustSignals: string[];
    reviewFlow: string[];
  };
  relatedProducts: ProductSummary[];
};

export type ProductDetailView = ProductDetail & {
  detailBase: ListingDetailBase;
};

export type FavoriteItem = ProductSummary & {
  favoritedAt: string;
  favoriteCount: number;
  isFavorited: true;
};

export type FavoriteListResponse = {
  items: FavoriteItem[];
  total: number;
};

export type FavoriteMutationResponse = {
  productId: number;
  isFavorited: boolean;
  favoritedAt?: string;
  favoriteCount: number;
};

export type ProductSearchParams = {
  q?: string;
  category?: string;
  condition?: string;
  sellerId?: number;
  ids?: number[];
  status?: 'ALL' | 'ON_SALE' | 'SOLD' | 'OFFLINE';
  trade?: 'all' | 'meetup' | 'dorm_pickup' | 'available_today';
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc';
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
};

export type PaginatedProductsResponse = {
  items: ProductSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type DashboardStats = {
  userCount: number;
  productCount: number;
  onSaleCount: number;
};

export type RegisterPayload = {
  studentId?: string;
  displayName: string;
  email: string;
  college?: string;
  avatarUrl?: string;
  password: string;
};

export type LoginPayload = {
  account: string;
  password: string;
};

export type AuthUser = {
  id: number;
  studentId?: string | null;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  avatarFrame?: string | null;
  avatarFrameUnlocked?: boolean;
  role: 'USER' | 'ADMIN';
  creditScore?: number;
  verificationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  accountStatus?: 'ACTIVE' | 'BANNED';
};

export type AuthSessionResponse = {
  message: string;
  account?: string;
  devAuthToken?: string | null;
  user: AuthUser;
};

export type CreditCenterSummary = {
  userId: number;
  creditScore: number;
  creditLevel: string;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  availablePoints: number;
  totalEarnedPoints: number;
  totalSpentPoints: number;
  signInStreak: number;
  checkedInToday: boolean;
  nextCheckInBasePoints: number;
  nextCheckInBonusPoints: number;
};

export type CreditCenterCheckInResult = {
  success: boolean;
  rewardPoints: number;
  basePoints: number;
  bonusPoints: number;
  signInStreak: number;
  availablePoints: number;
};

export type CreditMissionItem = {
  code: string;
  title: string;
  description: string;
  cycleType: 'once' | 'daily' | 'weekly' | 'monthly';
  rewardPoints: number;
  creditScoreDelta: number;
  progressCurrent: number;
  progressTarget: number;
  completed: boolean;
  claimed: boolean;
  cycleKey: string;
};

export type CreditMissionListResponse = {
  items: CreditMissionItem[];
};

export type CreditMissionClaimResult = {
  missionCode: string;
  rewardPoints: number;
  creditScoreDelta: number;
  availablePoints: number;
};

export type CreditLedgerItem = {
  id: number;
  changeType: 'EARN' | 'SPEND' | 'ADJUST';
  sourceType: 'SIGNIN' | 'MISSION' | 'REDEEM' | 'ADMIN';
  sourceId: string | null;
  pointsDelta: number;
  balanceAfter: number;
  remark: string | null;
  createdAt: string;
};

export type CreditLedgerResponse = {
  items: CreditLedgerItem[];
};

export type CreditRewardItem = {
  code: string;
  title: string;
  description: string;
  pointsCost: number;
  minCreditScore: number;
  canRedeem: boolean;
  redeemed: boolean;
};

export type CreditRewardListResponse = {
  items: CreditRewardItem[];
};

export type CreditRedeemResult = {
  id: number;
  rewardCode: string;
  pointsCost: number;
  availablePoints: number;
  status: 'CREATED' | 'FULFILLED' | 'CANCELED' | 'REJECTED';
};

export type ProductCreatePayload = {
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  tags: string[];
  imageUrls?: string[];
};

export type OrderPayload = {
  productId: number;
  meetupLocation?: string;
  meetupTime?: string;
  paymentIntent?: string;
  note?: string;
};

export type OrderItem = {
  id: number;
  orderCode: string;
  productId: number;
  buyerId: number;
  sellerId: number;
  status: string;
  meetupLocation?: string | null;
  note?: string | null;
  paymentIntent?: string | null;
  autoConfirmAt?: string | null;
  autoConfirmCountdownSeconds?: number;
  canBuyerComplete?: boolean;
  canReview?: boolean;
  createdAt: string;
  updatedAt: string;
  productTitle: string;
  productPrice: number | null;
  productCategory: string | null;
  productCondition: string | null;
  productStatus: string | null;
  productImageUrl: string | null;
  conversationId: number | null;
  buyerName: string;
  buyerAvatarUrl?: string | null;
  buyerAvatarFrame?: string | null;
  buyerCreditScore: number | null;
  buyerVerified: boolean;
  sellerName: string;
  sellerAvatarUrl?: string | null;
  sellerAvatarFrame?: string | null;
  sellerCreditScore: number | null;
  sellerVerified: boolean;
};

export type OrderReviewItem = {
  id: number;
  rating: number;
  content: string;
  createdAt: string;
  reviewerId: number;
  reviewerName: string;
};

export type OrderDetail = OrderItem & {
  completedAt?: string | null;
  canceledAt?: string | null;
  orderSnapshot: {
    productId: number;
    title: string;
    description: string;
    price: number;
    category: string;
    condition: string;
    imageUrl: string | null;
    sellerId: number;
    sellerName: string | null;
  };
  timeline: Array<{
    label: string;
    value: string;
  }>;
  reviews: OrderReviewItem[];
  actionState: {
    canComplete: boolean;
    canReview: boolean;
    canAppeal: boolean;
    canOpenConversation: boolean;
  };
};

export type OrderListParams = {
  page?: number;
  pageSize?: number;
};

export type PaginatedOrdersResponse = {
  items: OrderItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type CampusServiceConversationListing = {
  id: number;
  title: string;
  category: CampusServiceCategory;
  intent: CampusServiceIntent;
  intentLabel: string;
  reward: number;
  locationFrom: string;
  locationTo: string;
  deadlineLabel: string;
  estimatedMinutes: number;
  status: AdminCampusServiceStatus;
};

export type CampusServiceConversationDisplay = {
  title: string;
  category: CampusServiceCategory | null;
  categoryLabel: string | null;
  intent: CampusServiceIntent | null;
  intentLabel: string | null;
  reward: number | null;
  routeLabel: string | null;
  locationFrom: string | null;
  locationTo: string | null;
  deadlineLabel: string | null;
  estimatedMinutes: number | null;
  status: AdminCampusServiceStatus | null;
  statusLabel: string | null;
};

export type ConversationSummary = {
  id: number;
  orderId: number | null;
  productId: number | null;
  campusServiceOrderId: number | null;
  campusServiceListing: CampusServiceConversationListing | null;
  campusServiceDisplay: CampusServiceConversationDisplay | null;
  preview: string;
  updatedAt: string;
  latestMessageSenderId: number | null;
  latestMessageAt: string;
  selfRole: 'buyer' | 'seller' | null;
  participant: {
    id: number | null;
    displayName: string;
    avatarUrl: string | null;
    avatarFrame?: string | null;
    college: string | null;
    isSeller: boolean;
  };
  product: {
    id: number;
    title: string;
    price: number;
    category: string;
    condition: string;
    imageUrl: string | null;
    status: string;
    meetupLocation: string | null;
  } | null;
};

export type ConversationMessage = {
  id: number;
  senderId: number;
  senderName: string;
  senderAvatarUrl?: string | null;
  senderAvatarFrame?: string | null;
  content: string;
  type: string;
  attachment?: {
    kind: 'image' | 'video';
    objectKey: string;
    url: string;
    mimeType: string;
    size: number;
    width?: number;
    height?: number;
    originalName?: string;
  } | null;
  orderEvent?: {
    kind: 'product-order-event';
    event: string;
    title: string;
    summary: string;
    orderId: number;
    productId: number;
    orderCode: string;
    actionLabel?: string | null;
    actionTarget?: string | null;
    badge?: string | null;
    meta?: Array<{ label: string; value: string }>;
  } | null;
  previewText?: string;
  createdAt: string;
};

export type SendMessagePayload = {
  content?: string;
  type?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'EMOJI';
  attachment?: {
    objectKey: string;
    url: string;
    mimeType: string;
    size: number;
    width?: number;
    height?: number;
    originalName?: string;
  };
};

export type CreateConversationPayload = {
  productId: number;
  initialMessage?: string;
};

export type CampusServiceCategory =
  | 'ERRAND'
  | 'AGENCY'
  | 'GROUP_BUY'
  | 'MOVING'
  | 'TUTORING'
  | 'SKILL'
  | 'REPAIR'
  | 'EVENT'
  | 'OTHER'
  | 'HELP';
export type CampusServiceStatus = 'OPEN' | 'BUSY' | 'PAUSED' | 'ENDED' | 'CANCELED';
export type AdminCampusServiceStatus = 'OPEN' | 'BUSY' | 'PAUSED' | 'ENDED' | 'CANCELED' | 'MATCHED' | 'DONE';
export type AdminCampusServiceAction = 'REOPEN' | 'FORCE_MATCH' | 'FORCE_COMPLETE' | 'CANCEL';
export type CampusServiceIntent = 'REQUEST' | 'OFFER';
export type CampusServicePattern = 'ONE_TIME' | 'REUSABLE';
export type CampusServicePriceMode = 'FIXED' | 'NEGOTIABLE' | 'FREE';
export type CampusServiceLocationMode = 'ONLINE' | 'ON_SITE' | 'DELIVERY' | 'FLEXIBLE';
export type CampusServiceUrgency = 'NORMAL' | 'TODAY' | 'URGENT';
export type CampusServiceFulfillmentMode = 'DROP_OFF' | 'FACE_TO_FACE' | 'FLEXIBLE';
export type CampusServiceContactPreference = 'CHAT_ONLY' | 'PHONE_AFTER_MATCH' | 'FLEXIBLE';

export type CampusServiceViewerContext = {
  role: 'GUEST' | 'DISCOVER' | 'PUBLISHER' | 'PARTICIPANT' | 'OTHER';
  canAccept: boolean;
  canConfirm: boolean;
  canReject: boolean;
  canComplete: boolean;
  canPause: boolean;
  canReopen: boolean;
  canEnd: boolean;
  canCancel: boolean;
  canOpenConversation: boolean;
};

export type CampusServiceActionState = {
  isPublisher: boolean;
  isParticipant: boolean;
  canAccept: boolean;
  canConfirm: boolean;
  canReject: boolean;
  canComplete: boolean;
  canPause: boolean;
  canReopen: boolean;
  canEnd: boolean;
  canCancel: boolean;
  canOpenConversation: boolean;
};

export type CampusServiceActionLabels = {
  accept: string | null;
  confirm: string | null;
  reject: string | null;
  complete: string | null;
  pause: string | null;
  reopen: string | null;
  end: string | null;
  cancel: string | null;
  conversation: string | null;
};

export type CampusServiceParticipant = ListingParticipantBase;

export type CampusServiceListItem = ListingSummary & {
  id: number;
  title: string;
  category: CampusServiceCategory;
  categoryLabel: string;
  intent: CampusServiceIntent;
  intentLabel: string;
  pattern: CampusServicePattern;
  serviceType: {
    key: CampusServiceCategory;
    label: string;
  };
  imageUrl?: string;
  price: number;
  reward: number;
  rewardLabel: string;
  route: {
    from: string;
    to: string;
    label: string;
  };
  deadlineLabel: string;
  estimatedMinutes: number;
  urgency: CampusServiceUrgency;
  urgencyLabel: string;
  fulfillmentMode: CampusServiceFulfillmentMode;
  fulfillmentModeLabel: string;
  schedule: {
    deadlineLabel: string;
    estimatedMinutes: number;
    urgency: CampusServiceUrgency;
    urgencyLabel: string;
    summary: string;
  };
  status: CampusServiceStatus;
  statusLabel: string;
  tags: string[];
  summaryTags: string[];
  participantSummary: {
    publisherLabel: string;
    participantLabel: string | null;
  };
  viewerContext: CampusServiceViewerContext;
  actionState: CampusServiceActionState;
  actionLabels: CampusServiceActionLabels;
  latestOrderId: number | null;
  actionOrderId: number | null;
  activeOrderCount: number;
  pendingOrderCount: number;
  waitingCompleteOrderCount: number;
  endedOrderCount: number;
  totalOrderCount: number;
  createdAt: string;
  updatedAt: string;
  conversationId: number | null;
  publisher: CampusServiceParticipant;
  participant: CampusServiceParticipant | null;
};

export type CampusServiceDetail = CampusServiceListItem & {
  stats: {
    favoriteCount: number;
    reportCount: number;
    wantCount: number;
    viewCount: number;
  };
  isFavorited: boolean;
  images?: string[];
  preview: {
    title: string;
    subtitle: string;
    metrics: Array<{
      label: string;
      value: string;
    }>;
  };
  locationFrom: string;
  locationTo: string;
  contactPreference: CampusServiceContactPreference;
  contactPreferenceLabel: string;
  itemCount: number;
  trustNote: string | null;
  timeline: ListingTimelineItem[];
  fulfillment: {
    routeLabel: string;
    deadlineLabel: string;
    estimatedMinutes: number;
    rewardLabel: string;
    mode: CampusServiceFulfillmentMode;
    modeLabel: string;
    contactPreference: CampusServiceContactPreference;
    contactPreferenceLabel: string;
    itemCount: number;
    trustNote: string | null;
    cancelReason: string | null;
    canceledById: number | null;
    intent: CampusServiceIntent;
    intentLabel: string;
    pattern: CampusServicePattern;
    maxTotalOrders: number | null;
    maxConcurrentOrders: number | null;
    validFromAt: string;
    validUntilAt: string;
    totalOrderCount: number;
    activeOrderCount: number;
  };
};

export type CampusServiceDetailView = CampusServiceDetail & {
  detailBase: ListingDetailBase;
  autoConfirm: boolean;
};

export type PaginatedCampusServicesResponse = {
  items: CampusServiceListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type CampusServiceCreatePayload = {
  intent?: CampusServiceIntent;
  pattern?: CampusServicePattern;
  title: string;
  category: CampusServiceCategory;
  description: string;
  reward?: number;
  amount?: number;
  priceMode?: CampusServicePriceMode;
  locationFrom?: string;
  locationTo?: string;
  locationMode?: CampusServiceLocationMode;
  locationNote?: string;
  deadlineLabel?: string;
  validFromAt?: string;
  validUntilAt?: string;
  estimatedMinutes: number;
  urgency?: CampusServiceUrgency;
  fulfillmentMode?: CampusServiceFulfillmentMode;
  contactPreference?: CampusServiceContactPreference;
  itemCount?: number;
  maxTotalOrders?: number;
  maxConcurrentOrders?: number;
  autoConfirm?: boolean;
  trustNote?: string;
  imageUrls?: string[];
};

export type CampusServiceOrderListParams = {
  listingId?: number;
  role?: 'REQUESTER' | 'PROVIDER';
  intent?: CampusServiceIntent;
  status?: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'WAITING_COMPLETE_CONFIRM' | 'COMPLETED' | 'REJECTED' | 'CANCELED' | 'EXPIRED';
  group?: 'PENDING' | 'ACTIVE' | 'WAITING_COMPLETE' | 'ENDED';
  page?: number;
  pageSize?: number;
};

export type CampusServiceOrderParticipant = ListingParticipantBase;

export type CampusServiceOrderListItem = {
  id: number;
  listingId: number;
  title: string;
  description: string;
  price: number;
  imageUrl?: string;
  tags: string[];
  status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'WAITING_COMPLETE_CONFIRM' | 'COMPLETED' | 'REJECTED' | 'CANCELED' | 'EXPIRED';
  statusLabel: string;
  orderStatus: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'WAITING_COMPLETE_CONFIRM' | 'COMPLETED' | 'REJECTED' | 'CANCELED' | 'EXPIRED';
  orderStatusLabel: string;
  listingStatus: AdminCampusServiceStatus;
  listingStatusLabel: string;
  intent: CampusServiceIntent;
  intentLabel: string;
  category: CampusServiceCategory;
  categoryLabel: string;
  reward: number;
  rewardLabel: string;
  route: {
    from: string;
    to: string;
    label: string;
  };
  deadlineLabel: string;
  estimatedMinutes: number;
  role: 'REQUESTER' | 'PROVIDER';
  roleLabel: string;
  summaryTags: string[];
  actionState: {
    canComplete: boolean;
    canCancel: boolean;
    canOpenConversation: boolean;
    canConfirm: boolean;
    canReject: boolean;
  };
  actionLabels: {
    confirm: string | null;
    reject: string | null;
    complete: string | null;
    cancel: string | null;
    conversation: string | null;
  };
  conversationId: number | null;
  counterpart: CampusServiceOrderParticipant;
  publisher: CampusServiceOrderParticipant;
  createdAt: string;
  updatedAt: string;
};

export type AdminOverview = {
  onSaleProducts: number;
  totalUsers: number;
  reportCount: number;
  activeOrders: number;
  activeCampusServices: number;
  recentProducts: Array<{
    id: number;
    title: string;
    status: string;
    sellerId: number;
  }>;
  recentReports: Array<{
    id: number;
    productId: number | null;
    targetUserId: number | null;
    reason: string;
    status: string;
  }>;
};

export type PublishingRules = {
  allowedCategories: string[];
  prohibitedKeywords: string[];
  dormElectricalWhitelist: string[];
  communityNotices: string[];
  ruleHighlights: string[];
  reviewFlow: string[];
  trustSignals: string[];
};

export type UserTrustSummary = {
  id: number;
  displayName: string;
  studentId?: string | null;
  email: string;
  avatarUrl?: string | null;
  avatarFrame?: string | null;
  avatarFrameUnlocked?: boolean;
  creditScore: number;
  creditLevel: string;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  accountStatus: 'ACTIVE' | 'BANNED';
  college: string;
  completedOrders: number;
  activeOrders: number;
  waitingReviews: number;
  reportCount: number;
  followerCount: number;
  isFollowing: boolean;
  averageRating: number | null;
};

export type UserProfile = {
  id: number;
  displayName: string;
  studentId?: string | null;
  email: string;
  avatarUrl?: string | null;
  avatarFrame?: string | null;
  avatarFrameUnlocked?: boolean;
  role: 'USER' | 'ADMIN';
  creditScore: number;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  accountStatus: 'ACTIVE' | 'BANNED';
  realName: string;
  college: string;
  phone: string;
};

export type ProductHistoryItem = ProductSummary & {
  type?: 'product';
  viewedAt: string | null;
};

export type CampusServiceHistoryItem = {
  type: 'campus-service';
  id: number;
  title: string;
  description: string;
  category: CampusServiceCategory;
  categoryLabel: string;
  intent: CampusServiceIntent;
  intentLabel: string;
  status: CampusServiceStatus;
  statusLabel: string;
  imageUrl?: string;
  price: number;
  rewardLabel: string;
  sellerName: string;
  publisher: {
    id: number;
    displayName: string;
  };
  summaryTags: string[];
  viewedAt: string | null;
};

export type HistoryItem = ProductHistoryItem | CampusServiceHistoryItem;

export type BrowsingHistoryResponse = {
  items: HistoryItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type FollowingUser = {
  id: number;
  displayName: string;
  studentId?: string | null;
  email: string;
  avatarUrl?: string | null;
  avatarFrame?: string | null;
  avatarFrameUnlocked?: boolean;
  creditScore: number;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  accountStatus: 'ACTIVE' | 'BANNED';
  college: string;
  activeProductCount: number;
  followerCount: number;
  followedAt: string | null;
};

export type FollowingListResponse = {
  items: FollowingUser[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type FollowMutationResponse = {
  isFollowing: boolean;
  followerCount: number;
  followedAt?: string;
  user?: FollowingUser;
};

export type ReportItem = {
  id: number;
  reporterId: number;
  productId: number | null;
  targetUserId: number | null;
  reason: string;
  status: string;
  resolutionNote?: string | null;
  handledBy?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditLogItem = {
  id: number;
  actorName: string;
  action: string;
  targetType: string;
  targetId: number;
  detail: string;
  createdAt: string;
};

export type ModerationUserItem = {
  id: number;
  displayName: string;
  email: string;
  studentId?: string | null;
  avatarUrl?: string | null;
  creditScore: number;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  accountStatus: 'ACTIVE' | 'BANNED';
  isBanned: boolean;
  college: string;
  reportCount: number;
  openReportCount: number;
  activeProductCount: number;
  totalProductCount: number;
  offlineProductCount: number;
  orderCount: number;
  activeOrderCount: number;
  completedOrderCount: number;
  canceledOrderCount: number;
  campusServiceCount: number;
  activeCampusServiceCount: number;
  messageCount: number;
  lastActiveAt: string;
  createdAt: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedAction: string;
};

export type ModerationUsersResponse = {
  items: ModerationUserItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  collegeStats: Array<{
    college: string;
    count: number;
  }>;
};

export type AdminOrderItem = {
  id: number;
  productId: number;
  productTitle: string;
  productStatus: string | null;
  buyerId: number;
  buyerName: string;
  sellerId: number;
  sellerName: string;
  status: string;
  meetupLocation?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminCampusServiceItem = {
  id: number;
  title: string;
  category: CampusServiceCategory;
  intent: CampusServiceIntent;
  intentLabel: string;
  reward: number;
  publisherId: number;
  publisherName: string;
  participantId: number | null;
  participantName: string | null;
  status: AdminCampusServiceStatus;
  locationFrom: string;
  locationTo: string;
  deadlineLabel: string;
  createdAt: string;
  updatedAt: string;
};

export async function fetchProducts(params?: ProductSearchParams) {
  const response = await apiClient.get<PaginatedProductsResponse>('/products', {
    params: {
      ...params,
      ids: params?.ids?.length ? params.ids.join(',') : undefined
    }
  });
  return response.data;
}

export async function fetchHomeRecommendations() {
  const response = await apiClient.get<ProductSummary[]>('/products/home-recommendations');
  return response.data;
}

export async function fetchProductDetail(id: number) {
  const response = await apiClient.get<ProductDetailView>(`/products/${id}`);
  return response.data;
}

export async function recordProductContact(productId: number) {
  const response = await apiClient.post<{ productId: number; recorded: boolean }>(`/products/${productId}/contact`);
  return response.data;
}

export async function fetchFavoriteList() {
  const response = await apiClient.get<FavoriteListResponse>('/favorites');
  return response.data;
}

export async function addFavorite(productId: number) {
  const response = await apiClient.post<FavoriteMutationResponse>(`/favorites/${productId}`);
  return response.data;
}

export async function removeFavorite(productId: number) {
  const response = await apiClient.delete<FavoriteMutationResponse>(`/favorites/${productId}`);
  return response.data;
}

export async function fetchPublishingRules() {
  const response = await apiClient.get<PublishingRules>('/products/publishing-rules');
  return response.data;
}

export async function fetchDashboardStats() {
  const response = await apiClient.get<DashboardStats>('/products/dashboard');
  return response.data;
}

export async function registerUser(payload: RegisterPayload) {
  clearCurrentUserStorage();
  const response = await authClient.post<AuthSessionResponse>('/auth/register', payload);
  saveDevAuthToken(response.data.devAuthToken ?? null);
  return response.data;
}

export async function loginUser(payload: LoginPayload) {
  clearCurrentUserStorage();
  const response = await authClient.post<AuthSessionResponse>('/auth/login', payload);
  saveDevAuthToken(response.data.devAuthToken ?? null);
  return response.data;
}

export async function fetchCurrentSession() {
  const response = await apiClient.get<{ user: AuthUser }>('/auth/me');
  return response.data;
}

export async function logoutUser() {
  const response = await apiClient.post<{ message: string }>('/auth/logout');
  saveDevAuthToken(null);
  return response.data;
}

export async function fetchBrowsingHistory(params?: { page?: number; pageSize?: number }) {
  const response = await apiClient.get<BrowsingHistoryResponse>('/users/me/history', {
    params
  });
  return response.data;
}

export async function fetchFollowingUsers(params?: { page?: number; pageSize?: number }) {
  const response = await apiClient.get<FollowingListResponse>('/users/me/following', {
    params
  });
  return response.data;
}

export async function followUser(userId: number) {
  const response = await apiClient.post<FollowMutationResponse>(`/users/${userId}/follow`);
  return response.data;
}

export async function unfollowUser(userId: number) {
  const response = await apiClient.delete<FollowMutationResponse>(`/users/${userId}/follow`);
  return response.data;
}

export async function createProduct(payload: ProductCreatePayload) {
  const response = await apiClient.post('/products', payload);
  return response.data;
}

export async function fetchOrders(params?: OrderListParams) {
  const response = await apiClient.get<PaginatedOrdersResponse>('/orders', {
    params
  });
  return response.data;
}

export async function fetchOrderDetail(id: number) {
  const response = await apiClient.get<OrderDetail>(`/orders/${id}`);
  return response.data;
}

export async function createOrder(payload: OrderPayload) {
  const response = await apiClient.post('/orders', payload);
  return response.data;
}

export async function confirmOrderMeetup(
  id: number,
  payload: {
    meetupLocation?: string;
    note?: string;
  }
) {
  const response = await apiClient.patch<OrderItem>(`/orders/${id}/meetup`, payload);
  return response.data;
}

export async function cancelOrder(
  id: number,
  payload: {
    reason?: string;
  }
) {
  const response = await apiClient.patch<OrderItem>(`/orders/${id}/cancel`, payload);
  return response.data;
}

export async function completeOrderMeetup(id: number) {
  const payload = {};
  const response = await apiClient.patch<OrderItem>(`/orders/${id}/complete`, payload);
  return response.data;
}

export async function createOrderReview(
  id: number,
  payload: {
    rating: number;
    content?: string;
  }
) {
  const response = await apiClient.post(`/orders/${id}/reviews`, payload);
  return response.data;
}

export async function fetchConversations() {
  const response = await apiClient.get<ConversationSummary[]>('/messages/conversations');
  return response.data;
}

export async function createConversation(payload: CreateConversationPayload) {
  const response = await apiClient.post<{ id: number; productId: number; reused: boolean }>(
    '/messages/conversations',
    payload
  );
  return response.data;
}

export async function fetchConversationMessages(id: number) {
  const response = await apiClient.get<ConversationMessage[]>(`/messages/conversations/${id}`);
  return response.data;
}

export async function sendConversationMessage(id: number, payload: SendMessagePayload) {
  const response = await apiClient.post<ConversationMessage>(`/messages/conversations/${id}`, payload);
  return response.data;
}

export async function fetchAdminOverview() {
  const response = await apiClient.get<AdminOverview>('/admin/overview');
  return response.data;
}

export async function updateAdminProductStatus(
  id: number,
  status: 'ON_SALE' | 'OFFLINE',
  payload?: {
    reason?: string;
  }
) {
  const response = await apiClient.patch(`/admin/products/${id}/status`, {
    status,
    ...payload
  });
  return response.data;
}

export async function fetchAdminOrders() {
  const response = await apiClient.get<AdminOrderItem[]>('/admin/orders');
  return response.data;
}

export async function updateAdminOrderStatus(
  id: number,
  payload: {
    status: 'PENDING' | 'IN_PROGRESS' | 'WAITING_REVIEW' | 'COMPLETED' | 'CANCELED';
    reason?: string;
  }
) {
  const response = await apiClient.patch(`/admin/orders/${id}/status`, payload);
  return response.data;
}

export async function fetchAdminCampusServices() {
  const response = await apiClient.get<AdminCampusServiceItem[]>('/admin/campus-services');
  return response.data;
}

export async function updateAdminCampusServiceStatus(
  id: number,
  payload: {
    action: AdminCampusServiceAction;
    reason?: string;
  }
) {
  const response = await apiClient.patch(`/admin/campus-services/${id}/status`, payload);
  return response.data;
}

export async function fetchUserTrustSummary(id: number) {
  const response = await apiClient.get<UserTrustSummary>(`/users/${id}/trust-summary`);
  return response.data;
}

export async function fetchUserProfile(id: number) {
  const response = await apiClient.get<UserProfile>(`/users/${id}/profile`);
  return response.data;
}

export async function fetchCreditCenterSummary() {
  const response = await apiClient.get<CreditCenterSummary>('/credit-center/summary');
  return response.data;
}

export async function checkInCreditCenter() {
  const response = await apiClient.post<CreditCenterCheckInResult>('/credit-center/check-in', {});
  return response.data;
}

export async function fetchCreditCenterMissions() {
  const response = await apiClient.get<CreditMissionListResponse>('/credit-center/missions');
  return response.data;
}

export async function claimCreditMission(missionCode: string) {
  const response = await apiClient.post<CreditMissionClaimResult>(`/credit-center/missions/${missionCode}/claim`, {});
  return response.data;
}

export async function fetchCreditCenterLedger() {
  const response = await apiClient.get<CreditLedgerResponse>('/credit-center/ledger');
  return response.data;
}

export async function fetchCreditCenterRewards() {
  const response = await apiClient.get<CreditRewardListResponse>('/credit-center/rewards');
  return response.data;
}

export async function redeemCreditReward(rewardCode: string, payload?: { note?: string }) {
  const response = await apiClient.post<CreditRedeemResult>(
    `/credit-center/rewards/${rewardCode}/redeem`,
    payload ?? {}
  );
  return response.data;
}

export async function updateUserProfile(
  id: number,
  payload: {
    studentId?: string | null;
    displayName: string;
    email: string;
    realName: string;
    college: string;
    phone: string;
    avatarUrl?: string | null;
    avatarFrame?: string | null;
  }
) {
  const response = await apiClient.patch<UserProfile>(`/users/${id}/profile`, payload);
  return response.data;
}

export async function uploadImageAsset(file: File, purpose: 'avatar' | 'product' = 'avatar') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('purpose', purpose);
  const response = await apiClient.post<{
    objectKey: string;
    url: string;
    width: number;
    height: number;
    mimeType: string;
    size: number;
  }>('/media/images', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
}

export async function uploadMessageAttachment(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<{
    objectKey: string;
    url: string;
    mimeType: string;
    size: number;
    width?: number;
    height?: number;
    originalName?: string;
  }>('/media/messages', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
}

export async function fetchModerationUsers(params?: {
  page?: number;
  pageSize?: number;
  college?: string;
  keyword?: string;
}) {
  const response = await apiClient.get<ModerationUsersResponse>('/users/moderation/list', { params });
  return response.data;
}

export async function updateUserBanStatus(
  id: number,
  payload: {
    banned: boolean;
    reason?: string;
  }
) {
  const response = await apiClient.patch(`/users/${id}/ban-status`, payload);
  return response.data;
}

export async function createReport(payload: {
  productId?: number;
  campusServiceListingId?: number;
  targetUserId?: number;
  reason: string;
}) {
  const response = await apiClient.post('/reports', payload);
  return response.data;
}

export async function addCampusServiceFavorite(listingId: number) {
  const response = await apiClient.post(`/campus-service-favorites/${listingId}`);
  return response.data as {
    listingId: number;
    isFavorited: boolean;
    favoritedAt?: string;
    favoriteCount: number;
  };
}

export async function removeCampusServiceFavorite(listingId: number) {
  const response = await apiClient.delete(`/campus-service-favorites/${listingId}`);
  return response.data as {
    listingId: number;
    isFavorited: boolean;
    favoriteCount: number;
  };
}

export async function fetchReports() {
  const response = await apiClient.get<ReportItem[]>('/reports');
  return response.data;
}

export async function resolveReport(id: number, payload: {
  resolutionNote: string;
  nextStatus: 'RESOLVED' | 'REJECTED' | 'OFFLINE_PRODUCT' | 'BAN_USER' | 'UNBAN_USER';
}) {
  const response = await apiClient.patch(`/reports/${id}/resolve`, payload);
  return response.data;
}

export async function fetchAuditLogs() {
  const response = await apiClient.get<AuditLogItem[]>('/reports/logs');
  return response.data;
}

export async function fetchCampusServiceListings(params?: {
  intent?: CampusServiceIntent;
  category?: CampusServiceCategory;
  status?: CampusServiceStatus;
  ownerId?: number;
  keyword?: string;
  sort?: 'composite' | 'price_asc' | 'price_desc' | 'newest';
  minReward?: number;
  maxReward?: number;
  credit?: Array<'OUTSTANDING' | 'EXCELLENT' | 'GOOD' | 'STABLE' | 'NORMAL' | 'IMPROVE'>;
  page?: number;
  pageSize?: number;
}) {
  const response = await apiClient.get<PaginatedCampusServicesResponse>('/campus-services', {
    params,
    paramsSerializer: {
      indexes: null
    }
  });
  return response.data;
}

export async function fetchCampusServiceDetail(id: number) {
  const response = await apiClient.get<CampusServiceDetailView>(`/campus-services/${id}`);
  return response.data;
}

export async function createCampusServiceListing(payload: CampusServiceCreatePayload) {
  const response = await apiClient.post<CampusServiceDetailView>('/campus-services', payload);
  return response.data;
}

export async function acceptCampusServiceListing(listingId: number, payload: {
  initialMessage?: string;
  serviceLocation?: string;
  serviceTime?: string;
  paymentIntent?: string;
}) {
  const response = await apiClient.post<CampusServiceDetailView>(`/campus-services/${listingId}/orders`, payload);
  return response.data;
}

export async function pauseCampusServiceListing(listingId: number) {
  const response = await apiClient.post<CampusServiceDetailView>(`/campus-services/${listingId}/pause`, {});
  return response.data;
}

export async function reopenCampusServiceListing(listingId: number) {
  const response = await apiClient.post<CampusServiceDetailView>(`/campus-services/${listingId}/reopen`, {});
  return response.data;
}

export async function endCampusServiceListing(listingId: number, payload?: { reason?: string }) {
  const response = await apiClient.post<CampusServiceDetailView>(`/campus-services/${listingId}/end`, payload ?? {});
  return response.data;
}

export async function completeCampusServiceListing(listingId: number) {
  const payload = {};
  const response = await apiClient.post<CampusServiceDetailView>(`/campus-services/${listingId}/complete`, payload);
  return response.data;
}

export async function cancelCampusServiceListing(listingId: number, payload?: { reason?: string }) {
  const response = await apiClient.post<CampusServiceDetailView>(`/campus-services/${listingId}/cancel`, payload ?? {});
  return response.data;
}

export async function confirmCampusServiceOrder(orderId: number) {
  const response = await apiClient.post<CampusServiceDetailView>(`/campus-service-orders/${orderId}/confirm`, {});
  return response.data;
}

export async function rejectCampusServiceOrder(orderId: number, payload?: { reason?: string }) {
  const response = await apiClient.post<CampusServiceDetailView>(`/campus-service-orders/${orderId}/reject`, payload ?? {});
  return response.data;
}

export async function completeCampusServiceOrder(orderId: number) {
  const response = await apiClient.post<CampusServiceDetailView>(`/campus-service-orders/${orderId}/complete`, {});
  return response.data;
}

export async function cancelCampusServiceOrder(orderId: number, payload?: { reason?: string }) {
  const response = await apiClient.post<CampusServiceDetailView>(`/campus-service-orders/${orderId}/cancel`, payload ?? {});
  return response.data;
}

export async function fetchCampusServiceOrders(params?: CampusServiceOrderListParams) {
  const response = await apiClient.get<{
    items: CampusServiceOrderListItem[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }>('/campus-service-orders', {
    params
  });
  return response.data;
}
