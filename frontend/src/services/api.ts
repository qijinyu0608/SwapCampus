import axios from 'axios';
import { clearDemoUser, getAccessToken } from './session';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearDemoUser();
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

export type ProductSummary = {
  id: number;
  title: string;
  category: string;
  price: number;
  condition: string;
  tags: string[];
  status: string;
  description: string;
  sellerName: string;
  sellerCreditScore?: number;
  sellerVerified?: boolean;
  recommendationReason?: string;
  imageUrl?: string;
  sellerId?: number;
  favoriteCount?: number;
  isFavorited?: boolean;
  favoritedAt?: string | null;
};

export type ProductDetail = ProductSummary & {
  images: string[];
  publishedAt: string;
  seller: {
    id: number;
    name: string;
    creditScore: number;
    creditLevel: string;
    verified: boolean;
    identityStatus: string;
    college: string;
    responseRate: number;
    averageRating: number;
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

export type DashboardStats = {
  userCount: number;
  productCount: number;
  pendingCount: number;
  targetSeedCount: number;
};

export type RegisterPayload = {
  studentId?: string;
  name: string;
  email: string;
  college?: string;
  password: string;
};

export type LoginPayload = {
  account: string;
  password: string;
};

export type AuthUser = {
  id: number;
  studentId: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  creditScore?: number;
  verified?: boolean;
};

export type AuthSessionResponse = {
  message: string;
  accessToken: string;
  expiresIn: string;
  account?: string;
  user: AuthUser;
};

export type ProductCreatePayload = {
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  tags: string;
};

export type OrderPayload = {
  productId: number;
  meetupLocation?: string;
  note?: string;
};

export type OrderItem = {
  id: number;
  productId: number;
  buyerId: number;
  sellerId: number;
  status: string;
  meetupLocation?: string | null;
  note?: string | null;
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
  buyerCreditScore: number | null;
  buyerVerified: boolean;
  sellerName: string;
  sellerCreditScore: number | null;
  sellerVerified: boolean;
};

export type OrderListParams = {
  userId?: number;
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

export type ConversationSummary = {
  id: number;
  orderId: number | null;
  productId: number | null;
  campusServiceTaskId: number | null;
  campusServiceTaskTitle: string | null;
  campusServiceTask: {
    id: number;
    title: string;
    category: CampusServiceCategory;
    reward: number;
    locationFrom: string;
    locationTo: string;
    deadlineLabel: string;
    estimatedMinutes: number;
    status: CampusServiceStatus;
  } | null;
  preview: string;
  updatedAt: string;
  latestMessageSenderId: number | null;
  latestMessageAt: string;
  selfRole: 'buyer' | 'seller' | null;
  participant: {
    id: number | null;
    name: string;
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
  content: string;
  type: string;
  createdAt: string;
};

export type SendMessagePayload = {
  content: string;
};

export type CreateConversationPayload = {
  productId: number;
  initialMessage?: string;
};

export type MessageDemoHydratePayload = {
  userId: number;
  studentId?: string;
  name?: string;
  email?: string;
};

export type MessageDemoHydrateResponse = {
  hydrated: boolean;
  userId: number;
  count: number;
  user: {
    id: number;
    studentId: string;
    name: string;
    email: string;
    role: 'USER' | 'ADMIN';
    creditScore?: number;
    verified?: boolean;
  };
};

export type CampusServiceCategory = 'ERRAND' | 'AGENCY' | 'GROUP_BUY' | 'HELP';
export type CampusServiceStatus = 'OPEN' | 'MATCHED' | 'DONE' | 'CANCELED';

export type CampusServiceTask = {
  id: number;
  title: string;
  category: CampusServiceCategory;
  description: string;
  reward: number;
  locationFrom: string;
  locationTo: string;
  deadlineLabel: string;
  estimatedMinutes: number;
  status: CampusServiceStatus;
  createdAt: string;
  updatedAt: string;
  conversationId: number | null;
  publisher: {
    id: number;
    name: string;
    creditScore: number;
    verified: boolean;
  };
  accepter: {
    id: number;
    name: string;
    creditScore: number;
    verified: boolean;
  } | null;
};

export type CampusServiceCreatePayload = {
  title: string;
  category: CampusServiceCategory;
  description: string;
  reward: number;
  locationFrom: string;
  locationTo: string;
  deadlineLabel: string;
  estimatedMinutes: number;
};

export type AdminOverview = {
  pendingProducts: number;
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
  name: string;
  studentId: string;
  email: string;
  creditScore: number;
  creditLevel: string;
  verified: boolean;
  identityStatus: string;
  college: string;
  completedOrders: number;
  activeOrders: number;
  waitingReviews: number;
  reportCount: number;
  responseRate: number;
  averageRating: number;
};

export type UserProfile = {
  id: number;
  name: string;
  studentId: string;
  email: string;
  role: 'USER' | 'ADMIN';
  creditScore: number;
  verified: boolean;
  identityStatus: string;
  realName: string;
  college: string;
  phone: string;
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
  name: string;
  email: string;
  studentId: string;
  creditScore: number;
  verified: boolean;
  isBanned: boolean;
  college: string;
  reportCount: number;
  openReportCount: number;
  activeProductCount: number;
  totalProductCount: number;
  pendingProductCount: number;
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
  reward: number;
  publisherId: number;
  publisherName: string;
  accepterId: number | null;
  accepterName: string | null;
  status: CampusServiceStatus;
  locationFrom: string;
  locationTo: string;
  deadlineLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type BehaviorEventType = 'VIEW' | 'FAVORITE' | 'UNFAVORITE' | 'CONTACT' | 'ORDER';

export async function fetchProducts() {
  const response = await apiClient.get<ProductSummary[]>('/products');
  return response.data;
}

export async function fetchRecommendations(userId?: number) {
  const response = await apiClient.get<ProductSummary[]>('/products/recommendations', {
    params: userId ? { userId } : undefined
  });
  return response.data;
}

export async function fetchProductDetail(id: number, userId?: number) {
  const response = await apiClient.get<ProductDetail>(`/products/${id}`, {
    params: userId ? { userId } : undefined
  });
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
  const response = await apiClient.post<AuthSessionResponse>('/auth/register', payload);
  return response.data;
}

export async function loginUser(payload: LoginPayload) {
  const response = await apiClient.post<AuthSessionResponse>('/auth/login', payload);
  return response.data;
}

export async function fetchCurrentSession() {
  const response = await apiClient.get<{ user: AuthUser }>('/auth/me');
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

export async function hydrateMessageDemos(payload: MessageDemoHydratePayload) {
  const response = await apiClient.post<MessageDemoHydrateResponse>(
    '/messages/demo-hydrate',
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
    status: CampusServiceStatus;
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

export async function updateUserProfile(
  id: number,
  payload: {
    name: string;
    email: string;
    realName: string;
    college: string;
    phone: string;
  }
) {
  const response = await apiClient.patch<UserProfile>(`/users/${id}/profile`, payload);
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
  targetUserId?: number;
  reason: string;
}) {
  const response = await apiClient.post('/reports', payload);
  return response.data;
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

export async function recordRecommendationBehavior(payload: {
  productId: number;
  eventType: BehaviorEventType;
}) {
  const response = await apiClient.post('/recommendations/behavior', payload);
  return response.data;
}

export async function fetchCampusServiceTasks(params?: {
  category?: CampusServiceCategory;
  status?: CampusServiceStatus;
  keyword?: string;
}) {
  const response = await apiClient.get<CampusServiceTask[]>('/campus-services', { params });
  return response.data;
}

export async function createCampusServiceTask(payload: CampusServiceCreatePayload) {
  const response = await apiClient.post<CampusServiceTask>('/campus-services', payload);
  return response.data;
}

export async function acceptCampusServiceTask(taskId: number, payload: {
  initialMessage?: string;
}) {
  const response = await apiClient.post<CampusServiceTask>(`/campus-services/${taskId}/accept`, payload);
  return response.data;
}

export async function completeCampusServiceTask(taskId: number) {
  const payload = {};
  const response = await apiClient.post<CampusServiceTask>(`/campus-services/${taskId}/complete`, payload);
  return response.data;
}
