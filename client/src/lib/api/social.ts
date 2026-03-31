import { getClient, ServiceName } from './factory';

// ============================================================================
// Case-conversion utilities
// ============================================================================

// Recursively converts all object keys from snake_case to camelCase.
// Applied to every response coming from the Rust backend.
function snakeToCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
        snakeToCamel(v),
      ])
    );
  }
  return obj;
}

// Recursively converts all object keys from camelCase to snake_case.
// Applied to every request body before it reaches the Rust backend.
function camelToSnake(obj: any): any {
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k.replace(/[A-Z]/g, c => '_' + c.toLowerCase()),
        camelToSnake(v),
      ])
    );
  }
  return obj;
}

// ============================================================================
// Raw axios client for the social service — base URL: http://localhost:3019/api/v1
// All social backend routes are under /social/... (full path: /api/v1/social/...)
// Export this so components can call with /social/<path> directly.
// ============================================================================

export const socialApiClient = getClient(ServiceName.SOCIAL);

// Attach case-conversion interceptors on the shared social client.
// These run after (response) or before (request) the factory-level interceptors.
socialApiClient.interceptors.response.use((response) => {
  response.data = snakeToCamel(response.data);
  return response;
});

socialApiClient.interceptors.request.use((config) => {
  if (config.data) config.data = camelToSnake(config.data);
  return config;
});

// Internal helper used by socialApi methods — adds /social prefix automatically
const s = {
  get: <T = any>(path: string, config?: any) => socialApiClient.get<T>(`/social${path}`, config),
  post: <T = any>(path: string, data?: any, config?: any) => socialApiClient.post<T>(`/social${path}`, data, config),
  patch: <T = any>(path: string, data?: any, config?: any) => socialApiClient.patch<T>(`/social${path}`, data, config),
  put: <T = any>(path: string, data?: any, config?: any) => socialApiClient.put<T>(`/social${path}`, data, config),
  delete: <T = any>(path: string, config?: any) => socialApiClient.delete<T>(`/social${path}`, config),
};

// ============================================================================
// Interfaces — all fields use camelCase to match UI components.
// The response interceptor above converts snake_case JSON from the backend
// automatically; the request interceptor converts back before sending.
// ============================================================================

export interface SocialAccount {
  id: string;
  userId: string;
  platform: string;
  platformUserId?: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  /** Alias for avatarUrl — used by account-connector and channel-sidebar */
  avatar?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  platformConfig: Record<string, unknown>;
  isActive: boolean;
  status?: string;
  followersCount?: number;
  /** Mastodon / self-hosted platform instance URL */
  instanceUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ThreadPost is a frontend-only abstraction (not returned by backend directly)
export interface ThreadPost {
  id: string;
  content: string;
  delayMinutes: number;
}

export interface SocialPost {
  id: string;
  userId: string;
  content: string;
  status: string; // 'draft' | 'scheduled' | 'published' | 'failed'
  mediaUrls: string[] | Record<string, unknown>;
  hashtags: string[] | Record<string, unknown>;
  scheduledAt?: string;
  publishedAt?: string;
  errorMessage?: string;
  isEvergreen: boolean;
  templateId?: string;
  accountIds?: string[];
  /** Alias for accountIds — used by calendar/dashboard/analytics components */
  accounts?: string[];
  threadId?: string;
  parentId?: string;
  likesCount?: number;
  sharesCount?: number;
  commentsCount?: number;
  /** Resolved platform name — set by calendar's EnrichedPost local type */
  platform?: string;
  /** Repeat interval in days (evergreen scheduling) */
  repeatInterval?: number;
  /** Engagement count — total interactions (likes + shares + comments) */
  engagementCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface InboxItem {
  id: string;
  accountId: string;
  platformItemId?: string;
  itemType: string; // 'comment' | 'mention' | 'dm'
  /** Alias for itemType — used by social-inbox components */
  type?: string;
  authorName?: string;
  authorAvatar?: string;
  content?: string;
  postId?: string;
  parentId?: string;
  isRead: boolean;
  /** Alias for isRead — used by social-inbox components */
  read?: boolean;
  sentiment?: string;
  externalId?: string;
  externalUrl?: string;
  /** Platform of the account this item belongs to — joined/enriched by store */
  platform?: string;
  receivedAt: string;
  createdAt: string;
}

export interface AnalyticsOverview {
  totalFollowers: number;
  followersGrowth: number;
  engagementRate: number;
  totalReach: number;
  totalClicks: number;
  postsThisWeek: number;
  pendingInbox: number;
}

export interface FollowerDataPoint {
  date: string;
  followers: number;
  platform: string;
}

export interface PlatformEngagement {
  platform: string;
  engagement: number;
  posts: number;
}

export interface RssFeed {
  id: string;
  userId: string;
  feedUrl: string;
  /** Alias for feedUrl — used by rss-manager components */
  url?: string;
  name?: string;
  targetAccountIds: string[];
  postTemplate?: string;
  /** Alias for postTemplate — used by rss-manager form */
  template?: string;
  isActive: boolean;
  /** Alias for isActive — used by rss-manager toggle */
  active?: boolean;
  lastCheckedAt?: string;
  lastItemGuid?: string;
  checkIntervalMinutes: number;
  autoPublish?: boolean;
  createdAt: string;
}

export interface PostTemplate {
  id: string;
  userId: string;
  name: string;
  content: string;
  hashtags: string[];
  category?: string;
  createdAt: string;
}

export interface AiGenerateRequest {
  topic: string;
  platform?: SocialAccount['platform'];
  tone?: string;
}

// Aligned with backend ai_generate response: only `content` is guaranteed
export interface AiGenerateResponse {
  content: string;
  hashtags?: string[];
}

export interface Signature {
  id: string;
  userId: string;
  name: string;
  content: string;
  isDefault?: boolean;
  autoAdd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MediaItem {
  id: string;
  userId: string;
  filename: string;
  originalName?: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  tags: unknown;
  usageCount: number;
  createdAt: string;
}

export interface ShortUrl {
  id: string;
  userId: string;
  shortCode: string;
  originalUrl: string;
  postId?: string;
  clickCount: number;
  /** Alias for clickCount — used by url-shortener components */
  clicks?: number;
  /** Full short URL string — may be returned by backend or constructed client-side */
  shortUrl?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface Webhook {
  id: string;
  userId: string;
  name: string;
  url: string;
  events: string[];
  accountFilter?: string;
  secret?: string;
  active: boolean;
  lastTriggeredAt?: string;
  lastStatusCode?: number;
  failureCount: number;
  createdAt: string;
}

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  avatarUrl?: string;
  description?: string;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  displayName?: string;
  username?: string;
  invitedAt: string;
  acceptedAt?: string;
  joinedAt?: string;
}

// Aligned with Rust PostComment struct in models.rs
export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  parentCommentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  id: string;
  userId: string;
  accountIds?: string[];
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  hour: number;
  minute: number;
  isActive: boolean;
  createdAt: string;
}

export interface ContentSet {
  id: string;
  userId: string;
  name: string;
  description?: string;
  content: string;
  mediaUrls: unknown;
  hashtags: unknown;
  targetAccounts: unknown;
  platformOverrides: unknown;
  signatureId?: string;
  postIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyInfo {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  scopes: string[];
  rateLimitPerHour: number;
  lastUsedAt?: string;
  expiresAt?: string;
  active: boolean;
  /** Inverse of active — used by api-key-manager to show revoked state */
  revoked?: boolean;
  createdAt: string;
}

// ============================================================================
// API methods
// ============================================================================

export const socialApi = {
  accounts: {
    list: () => s.get<SocialAccount[]>('/accounts'),
    create: (data: Record<string, string>) =>
      s.post<SocialAccount>('/accounts', data),
    update: (id: string, data: Partial<SocialAccount>) =>
      s.patch<SocialAccount>(`/accounts/${id}`, data),
    delete: (id: string) => s.delete(`/accounts/${id}`),
    refreshToken: (id: string) => s.post(`/accounts/${id}/refresh-token`),
  },

  oauth: {
    /**
     * Get the OAuth redirect URL for a given platform.
     * For Mastodon, pass `instance` query param (e.g. "mastodon.social").
     */
    authorize: (platform: string, params?: { instance?: string }) =>
      s.get<{ redirect_url: string; state: string }>(
        `/oauth/${platform}/authorize`,
        { params },
      ),
    /**
     * Save OAuth client_id and client_secret for a platform in the DB.
     * These credentials are used in preference to env vars.
     */
    saveCredentials: (data: { platform: string; client_id: string; client_secret: string }) =>
      s.post<{ status: string; platform: string }>('/oauth/credentials', data),
  },

  posts: {
    // Backend returns SocialPost[] array directly (no pagination wrapper)
    list: (params?: { status?: string; accountId?: string; page?: number; limit?: number }) =>
      s.get<SocialPost[]>('/posts', { params }),
    get: (id: string) => s.get<SocialPost>(`/posts/${id}`),
    create: (data: {
      content: string;
      mediaUrls?: unknown;
      hashtags?: unknown;
      scheduledAt?: string;
      isEvergreen?: boolean;
      templateId?: string;
      accountIds?: string[];
    }) => s.post<SocialPost>('/posts', data),
    update: (id: string, data: {
      content?: string;
      mediaUrls?: unknown;
      hashtags?: unknown;
      scheduledAt?: string;
      isEvergreen?: boolean;
    }) => s.patch<SocialPost>(`/posts/${id}`, data),
    delete: (id: string) => s.delete(`/posts/${id}`),
    publish: (id: string) => s.post<SocialPost>(`/posts/${id}/publish`),
    schedule: (id: string, scheduledAt: string, repeatInterval?: number) =>
      s.post<SocialPost>(`/posts/${id}/schedule`, {
        scheduledAt,
        repeatInterval,
      }),
    // Post approval workflow
    submitForReview: (id: string) =>
      s.post<{ status: string }>(`/posts/${id}/submit-for-review`),
    approve: (id: string) =>
      s.post<{ status: string }>(`/posts/${id}/approve`),
    reject: (id: string, rejectionReason?: string) =>
      s.post<{ status: string }>(`/posts/${id}/reject`, { rejectionReason }),
    listReviewQueue: () =>
      s.get<SocialPost[]>('/posts/review-queue'),
  },

  comments: {
    list: (postId: string) =>
      s.get<PostComment[]>(`/posts/${postId}/comments`),
    create: (postId: string, data: { content: string; parentCommentId?: string }) =>
      s.post<PostComment>(`/posts/${postId}/comments`, data),
    delete: (postId: string, commentId: string) =>
      s.delete(`/posts/${postId}/comments/${commentId}`),
  },

  inbox: {
    // Backend returns InboxItem[] array directly (no pagination wrapper)
    // Backend query params: account_id, item_type, unread_only
    // camelToSnake interceptor handles the conversion automatically.
    list: (params?: { accountId?: string; itemType?: string; unreadOnly?: boolean }) =>
      s.get<InboxItem[]>('/inbox', { params }),
    markRead: (id: string) => s.patch(`/inbox/${id}/read`),
    reply: (id: string, content: string) => s.post(`/inbox/${id}/reply`, { content }),
  },

  analytics: {
    overview: () => s.get<AnalyticsOverview>('/analytics/overview'),
    postAnalytics: (postId: string) => s.get(`/analytics/posts/${postId}`),
    followers: (days?: number) =>
      s.get<FollowerDataPoint[]>('/analytics/followers', { params: { days: days ?? 30 } }),
    byPlatform: () => s.get<PlatformEngagement[]>('/analytics/by-platform'),
    topPosts: (limit?: number) =>
      s.get<SocialPost[]>('/analytics/top-posts', { params: { limit: limit ?? 10 } }),
  },

  rssFeeds: {
    list: () => s.get<RssFeed[]>('/rss-feeds'),
    create: (data: {
      feedUrl: string;
      name?: string;
      targetAccountIds?: unknown;
      postTemplate?: string;
      checkIntervalMinutes?: number;
      autoPublish?: boolean;
    }) => s.post<RssFeed>('/rss-feeds', data),
    delete: (id: string) => s.delete(`/rss-feeds/${id}`),
    checkNow: (id: string) => s.post(`/rss-feeds/${id}/check`),
    toggle: (id: string, isActive: boolean) => s.patch(`/rss-feeds/${id}`, { isActive }),
  },

  templates: {
    list: () => s.get<PostTemplate[]>('/templates'),
    create: (data: { name: string; content: string; hashtags?: unknown; category?: string }) =>
      s.post<PostTemplate>('/templates', data),
    update: (id: string, data: { name?: string; content?: string; hashtags?: unknown; category?: string }) =>
      s.patch<PostTemplate>(`/templates/${id}`, data),
    delete: (id: string) => s.delete(`/templates/${id}`),
  },

  signatures: {
    list: () => s.get<Signature[]>('/signatures'),
    create: (data: { name: string; content: string; autoAdd?: boolean; isDefault?: boolean }) =>
      s.post<Signature>('/signatures', data),
    update: (id: string, data: { name?: string; content?: string; autoAdd?: boolean; isDefault?: boolean }) =>
      s.patch<Signature>(`/signatures/${id}`, data),
    delete: (id: string) => s.delete(`/signatures/${id}`),
  },

  media: {
    list: (params?: { mimeType?: string; sort?: string }) =>
      s.get<MediaItem[]>('/media', { params }),
    create: (data: {
      filename: string;
      mimeType: string;
      url: string;
      originalName?: string;
      size?: number;
      thumbnailUrl?: string;
      width?: number;
      height?: number;
      tags?: unknown;
    }) => s.post<MediaItem>('/media', data),
    delete: (id: string) => s.delete(`/media/${id}`),
  },

  shortUrls: {
    list: () => s.get<ShortUrl[]>('/short-urls'),
    create: (data: { originalUrl: string; postId?: string }) =>
      s.post<ShortUrl>('/short-urls', data),
    delete: (id: string) => s.delete(`/short-urls/${id}`),
  },

  webhooks: {
    list: () => s.get<Webhook[]>('/webhooks'),
    create: (data: {
      name: string;
      url: string;
      events: unknown;
      accountFilter?: string;
      secret?: string;
      active?: boolean;
    }) => s.post<Webhook>('/webhooks', data),
    update: (id: string, data: Partial<Pick<Webhook, 'name' | 'url' | 'events' | 'active' | 'secret'>>) =>
      s.patch<Webhook>(`/webhooks/${id}`, data),
    delete: (id: string) => s.delete(`/webhooks/${id}`),
    test: (id: string) => s.post(`/webhooks/${id}/test`),
  },

  workspaces: {
    list: () => s.get<Workspace[]>('/workspaces'),
    create: (data: { name: string; slug?: string; description?: string; avatarUrl?: string }) =>
      s.post<Workspace>('/workspaces', data),
    get: (id: string) => s.get<Workspace>(`/workspaces/${id}`),
    delete: (id: string) => s.delete(`/workspaces/${id}`),
    listMembers: (id: string) =>
      s.get<WorkspaceMember[]>(`/workspaces/${id}/members`),
    inviteMember: (id: string, data: { userId: string; role?: string }) =>
      s.post<WorkspaceMember>(`/workspaces/${id}/members`, data),
    removeMember: (id: string, userId: string) =>
      s.delete(`/workspaces/${id}/members/${userId}`),
  },

  timeSlots: {
    list: () => s.get<TimeSlot[]>('/time-slots'),
    create: (data: { dayOfWeek: number; hour: number; minute?: number; accountIds?: string[] }) =>
      s.post<TimeSlot>('/time-slots', data),
    delete: (id: string) => s.delete(`/time-slots/${id}`),
  },

  contentSets: {
    list: () => s.get<ContentSet[]>('/content-sets'),
    create: (data: {
      name: string;
      content: string;
      description?: string;
      mediaUrls?: unknown;
      hashtags?: unknown;
      targetAccounts?: unknown;
      platformOverrides?: unknown;
      signatureId?: string;
    }) => s.post<ContentSet>('/content-sets', data),
    delete: (id: string) => s.delete(`/content-sets/${id}`),
  },

  apiKeys: {
    list: () => s.get<ApiKeyInfo[]>('/api-keys'),
    // Backend CreateApiKeyRequest: name, scopes?, rate_limit_per_hour?, expires_at?
    create: (data: { name: string; scopes?: unknown; rateLimitPerHour?: number; expiresAt?: string }) =>
      s.post<ApiKeyInfo & { key: string }>('/api-keys', data),
    revoke: (id: string) => s.post(`/api-keys/${id}/revoke`),
  },

  ai: {
    generate: (data: AiGenerateRequest) =>
      s.post<AiGenerateResponse>('/ai/generate', data),
    hashtags: (content: string) =>
      s.post<{ hashtags: string[] }>('/ai/hashtags', { content }),
    bestTime: (accountId: string) =>
      s.post<{ bestTimes: { dayOfWeek: number; hour: number; engagementScore: number }[] }>(`/ai/best-time`, { accountId }),
    smartReplies: (inboxItemId: string) =>
      s.get<{ suggestions: string[] }>(`/ai/smart-replies/${inboxItemId}`),
  },

  // AI Threads — /api/v1/social/ai-threads
  aiThreads: {
    list: () =>
      s.get<AiThread[]>('/ai-threads'),
    create: (data: { title: string; messages?: unknown }) =>
      s.post<AiThread>('/ai-threads', data),
    get: (id: string) =>
      s.get<AiThread>(`/ai-threads/${id}`),
    update: (id: string, data: { title?: string; messages?: unknown }) =>
      s.put<AiThread>(`/ai-threads/${id}`, data),
    delete: (id: string) =>
      s.delete(`/ai-threads/${id}`),
  },
};

// ============================================================================
// AI Thread type
// ============================================================================

export interface AiThread {
  id: string;
  userId: string;
  title: string;
  messages: unknown; // JSON array of message objects
  createdAt: string;
  updatedAt: string;
}
