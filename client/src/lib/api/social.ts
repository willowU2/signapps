import { getClient, ServiceName } from './factory';

// Raw axios client for the social service — base URL: http://localhost:3019/api/v1
// All social backend routes are under /social/... (full path: /api/v1/social/...)
// Export this so components can call with /social/<path> directly.
export const socialApiClient = getClient(ServiceName.SOCIAL);

// Internal helper used by socialApi methods — adds /social prefix automatically
const s = {
  get: <T = any>(path: string, config?: any) => socialApiClient.get<T>(`/social${path}`, config),
  post: <T = any>(path: string, data?: any, config?: any) => socialApiClient.post<T>(`/social${path}`, data, config),
  patch: <T = any>(path: string, data?: any, config?: any) => socialApiClient.patch<T>(`/social${path}`, data, config),
  put: <T = any>(path: string, data?: any, config?: any) => socialApiClient.put<T>(`/social${path}`, data, config),
  delete: <T = any>(path: string, config?: any) => socialApiClient.delete<T>(`/social${path}`, config),
};

// Aligned with Rust SocialAccount model (snake_case)
export interface SocialAccount {
  id: string;
  user_id: string;
  platform: string;
  platform_user_id?: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  token_expires_at?: string;
  platform_config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ThreadPost is a frontend-only abstraction (not returned by backend directly)
export interface ThreadPost {
  id: string;
  content: string;
  delayMinutes: number;
}

// Aligned with Rust Post model (snake_case)
export interface SocialPost {
  id: string;
  user_id: string;
  content: string;
  status: string; // 'draft' | 'scheduled' | 'published' | 'failed'
  media_urls: string[] | Record<string, unknown>;
  hashtags: string[] | Record<string, unknown>;
  scheduled_at?: string;
  published_at?: string;
  error_message?: string;
  is_evergreen: boolean;
  template_id?: string;
  created_at: string;
  updated_at: string;
}

// Aligned with Rust InboxItem model (snake_case)
export interface InboxItem {
  id: string;
  account_id: string;
  platform_item_id?: string;
  item_type: string; // 'comment' | 'mention' | 'dm'
  author_name?: string;
  author_avatar?: string;
  content?: string;
  post_id?: string;
  parent_id?: string;
  is_read: boolean;
  sentiment?: string;
  received_at: string;
  created_at: string;
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

// Aligned with Rust RssFeed model (snake_case)
export interface RssFeed {
  id: string;
  user_id: string;
  feed_url: string;
  name?: string;
  target_accounts: string[] | Record<string, unknown>;
  post_template?: string;
  is_active: boolean;
  last_checked_at?: string;
  last_item_guid?: string;
  check_interval_minutes: number;
  created_at: string;
}

// Aligned with Rust PostTemplate model (snake_case)
export interface PostTemplate {
  id: string;
  user_id: string;
  name: string;
  content: string;
  hashtags: string[] | Record<string, unknown>;
  category?: string;
  created_at: string;
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

// Aligned with Rust Signature model (snake_case)
export interface Signature {
  id: string;
  user_id: string;
  name: string;
  content: string;
  is_auto_add: boolean;
  created_at: string;
  updated_at: string;
}

// Aligned with Rust MediaItem model (snake_case)
export interface MediaItem {
  id: string;
  user_id: string;
  filename: string;
  original_name?: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  duration_seconds?: number;
  tags: unknown;
  usage_count: number;
  created_at: string;
}

// Aligned with Rust ShortUrl model (snake_case)
export interface ShortUrl {
  id: string;
  user_id: string;
  short_code: string;
  original_url: string;
  post_id?: string;
  clicks: number;
  created_at: string;
}

// Aligned with Rust Webhook model (snake_case)
export interface Webhook {
  id: string;
  user_id: string;
  name: string;
  url: string;
  events: string[] | Record<string, unknown>;
  account_filter?: string;
  secret?: string;
  is_active: boolean;
  last_triggered_at?: string;
  last_status_code?: number;
  failure_count: number;
  created_at: string;
}

// Aligned with Rust Workspace model (snake_case)
export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  avatar_url?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// Aligned with Rust WorkspaceMember model (snake_case)
export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  invited_at: string;
  accepted_at?: string;
}

// Aligned with Rust PostComment struct in models.rs
export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  parent_comment_id?: string;
  created_at: string;
  updated_at: string;
}

// Aligned with Rust TimeSlot model (snake_case)
export interface TimeSlot {
  id: string;
  user_id: string;
  account_id?: string;
  day_of_week: number; // 0=Sunday, 6=Saturday
  hour: number;
  minute: number;
  is_active: boolean;
  created_at: string;
}

// Aligned with Rust ContentSet model (snake_case)
export interface ContentSet {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  content: string;
  media_urls: unknown;
  hashtags: unknown;
  target_accounts: unknown;
  platform_overrides: unknown;
  signature_id?: string;
  created_at: string;
  updated_at: string;
}

// Aligned with Rust ApiKey model (snake_case)
export interface ApiKeyInfo {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  scopes: string[] | Record<string, unknown>;
  rate_limit_per_hour: number;
  last_used_at?: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
}

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

  posts: {
    // Backend returns SocialPost[] array directly (no pagination wrapper)
    list: (params?: { status?: string; accountId?: string; page?: number; limit?: number }) =>
      s.get<SocialPost[]>('/posts', { params }),
    get: (id: string) => s.get<SocialPost>(`/posts/${id}`),
    // CreatePostRequest: content, media_urls?, hashtags?, scheduled_at?, is_evergreen?, template_id?, account_ids?
    create: (data: {
      content: string;
      media_urls?: unknown;
      hashtags?: unknown;
      scheduled_at?: string;
      is_evergreen?: boolean;
      template_id?: string;
      account_ids?: string[];
    }) => s.post<SocialPost>('/posts', data),
    update: (id: string, data: {
      content?: string;
      media_urls?: unknown;
      hashtags?: unknown;
      scheduled_at?: string;
      is_evergreen?: boolean;
    }) => s.patch<SocialPost>(`/posts/${id}`, data),
    delete: (id: string) => s.delete(`/posts/${id}`),
    publish: (id: string) => s.post<SocialPost>(`/posts/${id}/publish`),
    schedule: (id: string, scheduledAt: string, repeatInterval?: number) =>
      // Backend expects snake_case fields: scheduled_at, repeat_interval
      s.post<SocialPost>(`/posts/${id}/schedule`, {
        scheduled_at: scheduledAt,
        repeat_interval: repeatInterval,
      }),
  },

  comments: {
    list: (postId: string) =>
      s.get<PostComment[]>(`/posts/${postId}/comments`),
    create: (postId: string, data: { content: string; parent_comment_id?: string }) =>
      s.post<PostComment>(`/posts/${postId}/comments`, data),
    delete: (postId: string, commentId: string) =>
      s.delete(`/posts/${postId}/comments/${commentId}`),
  },

  inbox: {
    // Backend returns InboxItem[] array directly (no pagination wrapper)
    // Backend query params: account_id, item_type, unread_only (not platform/type/unreadOnly)
    list: (params?: { account_id?: string; item_type?: string; unread_only?: boolean }) =>
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
      feed_url: string;
      name?: string;
      target_accounts?: unknown;
      post_template?: string;
      check_interval_minutes?: number;
    }) => s.post<RssFeed>('/rss-feeds', data),
    delete: (id: string) => s.delete(`/rss-feeds/${id}`),
    checkNow: (id: string) => s.post(`/rss-feeds/${id}/check`),
    toggle: (id: string, is_active: boolean) => s.patch(`/rss-feeds/${id}`, { is_active }),
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
    create: (data: { name: string; content: string; is_auto_add?: boolean }) =>
      s.post<Signature>('/signatures', data),
    update: (id: string, data: { name?: string; content?: string; is_auto_add?: boolean }) =>
      s.patch<Signature>(`/signatures/${id}`, data),
    delete: (id: string) => s.delete(`/signatures/${id}`),
  },

  media: {
    list: (params?: { mime_type?: string; sort?: string }) =>
      s.get<MediaItem[]>('/media', { params }),
    create: (data: {
      filename: string;
      mime_type: string;
      url: string;
      original_name?: string;
      size_bytes?: number;
      thumbnail_url?: string;
      width?: number;
      height?: number;
      tags?: unknown;
    }) => s.post<MediaItem>('/media', data),
    delete: (id: string) => s.delete(`/media/${id}`),
  },

  shortUrls: {
    list: () => s.get<ShortUrl[]>('/short-urls'),
    create: (data: { original_url: string; post_id?: string }) =>
      s.post<ShortUrl>('/short-urls', data),
    delete: (id: string) => s.delete(`/short-urls/${id}`),
  },

  webhooks: {
    list: () => s.get<Webhook[]>('/webhooks'),
    create: (data: {
      name: string;
      url: string;
      events: unknown;
      account_filter?: string;
      secret?: string;
      is_active?: boolean;
    }) => s.post<Webhook>('/webhooks', data),
    update: (id: string, data: Partial<Pick<Webhook, 'name' | 'url' | 'events' | 'is_active' | 'secret'>>) =>
      s.patch<Webhook>(`/webhooks/${id}`, data),
    delete: (id: string) => s.delete(`/webhooks/${id}`),
    test: (id: string) => s.post(`/webhooks/${id}/test`),
  },

  workspaces: {
    list: () => s.get<Workspace[]>('/workspaces'),
    create: (data: { name: string; slug: string; description?: string; avatar_url?: string }) =>
      s.post<Workspace>('/workspaces', data),
    get: (id: string) => s.get<Workspace>(`/workspaces/${id}`),
    delete: (id: string) => s.delete(`/workspaces/${id}`),
    listMembers: (id: string) =>
      s.get<WorkspaceMember[]>(`/workspaces/${id}/members`),
    inviteMember: (id: string, data: { userId: string; role?: string }) =>
      // Backend expects snake_case: user_id
      s.post<WorkspaceMember>(`/workspaces/${id}/members`, {
        user_id: data.userId,
        role: data.role,
      }),
    removeMember: (id: string, userId: string) =>
      s.delete(`/workspaces/${id}/members/${userId}`),
  },

  timeSlots: {
    list: () => s.get<TimeSlot[]>('/time-slots'),
    create: (data: { day_of_week: number; hour: number; minute?: number; account_id?: string }) =>
      s.post<TimeSlot>('/time-slots', data),
    delete: (id: string) => s.delete(`/time-slots/${id}`),
  },

  contentSets: {
    list: () => s.get<ContentSet[]>('/content-sets'),
    create: (data: {
      name: string;
      content: string;
      description?: string;
      media_urls?: unknown;
      hashtags?: unknown;
      target_accounts?: unknown;
      platform_overrides?: unknown;
      signature_id?: string;
    }) => s.post<ContentSet>('/content-sets', data),
    delete: (id: string) => s.delete(`/content-sets/${id}`),
  },

  apiKeys: {
    list: () => s.get<ApiKeyInfo[]>('/api-keys'),
    // Backend CreateApiKeyRequest: name, scopes?, rate_limit_per_hour?, expires_at?
    create: (data: { name: string; scopes?: unknown; rate_limit_per_hour?: number; expires_at?: string }) =>
      s.post<ApiKeyInfo & { key: string }>('/api-keys', data),
    revoke: (id: string) => s.post(`/api-keys/${id}/revoke`),
  },

  ai: {
    generate: (data: AiGenerateRequest) =>
      s.post<AiGenerateResponse>('/ai/generate', data),
    hashtags: (content: string) =>
      s.post<{ hashtags: string[] }>('/ai/hashtags', { content }),
    bestTime: (accountId: string) =>
      s.post<{ best_times: { day_of_week: number; hour: number; engagement_score: number }[] }>(`/ai/best-time`, { account_id: accountId }),
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
  user_id: string;
  title: string;
  messages: unknown; // JSON array of message objects
  created_at: string;
  updated_at: string;
}
