import { createApiClient } from './core';

export const SOCIAL_URL = process.env.NEXT_PUBLIC_SOCIAL_URL || 'http://localhost:3019/api/v1/social';

export const socialApiClient = createApiClient(SOCIAL_URL);

export interface SocialAccount {
  id: string;
  platform: 'twitter' | 'facebook' | 'instagram' | 'linkedin' | 'mastodon' | 'bluesky';
  username: string;
  displayName: string;
  avatar?: string;
  status: 'connected' | 'expired' | 'error';
  followersCount?: number;
  instanceUrl?: string; // for mastodon
  createdAt: string;
}

export interface ThreadPost {
  id: string;
  content: string;
  delayMinutes: number; // delay before posting this item (0 for first)
}

export interface SocialPost {
  id: string;
  content: string;
  platformContent?: Record<string, string>; // per-platform overrides
  threadPosts?: ThreadPost[]; // multi-post thread array
  platformOverrides?: Record<string, { content: string; threadPosts?: ThreadPost[] }>; // full per-platform overrides
  accounts: string[]; // account IDs
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledAt?: string;
  publishedAt?: string;
  mediaUrls?: string[];
  hashtags?: string[];
  repeatInterval?: number; // recurring post interval in days (0 or undefined = no repeat)
  engagementCount?: number;
  likesCount?: number;
  sharesCount?: number;
  commentsCount?: number;
  platformPostIds?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface InboxItem {
  id: string;
  accountId: string;
  platform: SocialAccount['platform'];
  type: 'comment' | 'mention' | 'dm';
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  content: string;
  read: boolean;
  postId?: string;
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
  name: string;
  url: string;
  targetAccountIds: string[];
  template: string; // supports {{title}} {{link}} {{description}}
  active: boolean;
  lastCheckedAt?: string;
  createdAt: string;
}

export interface PostTemplate {
  id: string;
  name: string;
  content: string;
  hashtags: string[];
  category: string;
  createdAt: string;
}

export interface AiGenerateRequest {
  topic: string;
  platform?: SocialAccount['platform'];
  tone?: string;
}

export interface AiGenerateResponse {
  content: string;
  hashtags: string[];
}

export interface Signature {
  id: string;
  name: string;
  content: string;
  autoAdd: boolean;
  createdAt: string;
}

export interface MediaItem {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  alt?: string;
  createdAt: string;
}

export interface ShortUrl {
  id: string;
  originalUrl: string;
  shortCode: string;
  shortUrl: string;
  postId?: string;
  clicks: number;
  createdAt: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  memberCount: number;
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface PostComment {
  id: string;
  postId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar?: string;
  content: string;
  platform: SocialAccount['platform'];
  createdAt: string;
}

export interface TimeSlot {
  id: string;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  hour: number;
  minute: number;
  accountIds?: string[];
  createdAt: string;
}

export interface ContentSet {
  id: string;
  name: string;
  description?: string;
  postIds: string[];
  createdAt: string;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt?: string;
  expiresAt?: string;
  revoked: boolean;
  createdAt: string;
}

export const socialApi = {
  accounts: {
    list: () => socialApiClient.get<SocialAccount[]>('/accounts'),
    create: (data: { platform: string; instanceUrl?: string; handle?: string; appPassword?: string }) =>
      socialApiClient.post<SocialAccount>('/accounts', data),
    update: (id: string, data: Partial<SocialAccount>) =>
      socialApiClient.patch<SocialAccount>(`/accounts/${id}`, data),
    delete: (id: string) => socialApiClient.delete(`/accounts/${id}`),
    refreshToken: (id: string) => socialApiClient.post(`/accounts/${id}/refresh`),
  },

  posts: {
    list: (params?: { status?: string; accountId?: string; page?: number; limit?: number }) =>
      socialApiClient.get<{ items: SocialPost[]; total: number }>('/posts', { params }),
    get: (id: string) => socialApiClient.get<SocialPost>(`/posts/${id}`),
    create: (data: Partial<SocialPost>) => socialApiClient.post<SocialPost>('/posts', data),
    update: (id: string, data: Partial<SocialPost>) => socialApiClient.patch<SocialPost>(`/posts/${id}`, data),
    delete: (id: string) => socialApiClient.delete(`/posts/${id}`),
    publish: (id: string) => socialApiClient.post<SocialPost>(`/posts/${id}/publish`),
    schedule: (id: string, scheduledAt: string, repeatInterval?: number) =>
      socialApiClient.post<SocialPost>(`/posts/${id}/schedule`, { scheduledAt, repeatInterval }),
  },

  comments: {
    list: (postId: string) =>
      socialApiClient.get<PostComment[]>(`/posts/${postId}/comments`),
    create: (postId: string, data: { content: string }) =>
      socialApiClient.post<PostComment>(`/posts/${postId}/comments`, data),
    delete: (postId: string, commentId: string) =>
      socialApiClient.delete(`/posts/${postId}/comments/${commentId}`),
  },

  inbox: {
    list: (params?: { platform?: string; type?: string; unreadOnly?: boolean }) =>
      socialApiClient.get<{ items: InboxItem[]; total: number }>('/inbox', { params }),
    markRead: (id: string) => socialApiClient.patch(`/inbox/${id}/read`),
    reply: (id: string, content: string) => socialApiClient.post(`/inbox/${id}/reply`, { content }),
  },

  analytics: {
    overview: () => socialApiClient.get<AnalyticsOverview>('/analytics/overview'),
    postAnalytics: (postId: string) => socialApiClient.get(`/analytics/posts/${postId}`),
    followers: (days?: number) =>
      socialApiClient.get<FollowerDataPoint[]>('/analytics/followers', { params: { days: days ?? 30 } }),
    byPlatform: () => socialApiClient.get<PlatformEngagement[]>('/analytics/by-platform'),
    topPosts: (limit?: number) =>
      socialApiClient.get<SocialPost[]>('/analytics/top-posts', { params: { limit: limit ?? 10 } }),
  },

  rssFeeds: {
    list: () => socialApiClient.get<RssFeed[]>('/rss-feeds'),
    create: (data: Omit<RssFeed, 'id' | 'createdAt' | 'lastCheckedAt'>) =>
      socialApiClient.post<RssFeed>('/rss-feeds', data),
    delete: (id: string) => socialApiClient.delete(`/rss-feeds/${id}`),
    checkNow: (id: string) => socialApiClient.post(`/rss-feeds/${id}/check`),
    toggle: (id: string, active: boolean) => socialApiClient.patch(`/rss-feeds/${id}`, { active }),
  },

  templates: {
    list: () => socialApiClient.get<PostTemplate[]>('/templates'),
    create: (data: Omit<PostTemplate, 'id' | 'createdAt'>) => socialApiClient.post<PostTemplate>('/templates', data),
    update: (id: string, data: Partial<PostTemplate>) =>
      socialApiClient.patch<PostTemplate>(`/templates/${id}`, data),
    delete: (id: string) => socialApiClient.delete(`/templates/${id}`),
  },

  signatures: {
    list: () => socialApiClient.get<Signature[]>('/signatures'),
    create: (data: Omit<Signature, 'id' | 'createdAt'>) =>
      socialApiClient.post<Signature>('/signatures', data),
    update: (id: string, data: Partial<Omit<Signature, 'id' | 'createdAt'>>) =>
      socialApiClient.patch<Signature>(`/signatures/${id}`, data),
    delete: (id: string) => socialApiClient.delete(`/signatures/${id}`),
  },

  media: {
    list: (params?: { mime_type?: string; sort?: string }) =>
      socialApiClient.get<MediaItem[]>('/media', { params }),
    create: (data: Omit<MediaItem, 'id' | 'createdAt'>) =>
      socialApiClient.post<MediaItem>('/media', data),
    delete: (id: string) => socialApiClient.delete(`/media/${id}`),
  },

  shortUrls: {
    list: () => socialApiClient.get<ShortUrl[]>('/short-urls'),
    create: (data: { original_url: string; post_id?: string }) =>
      socialApiClient.post<ShortUrl>('/short-urls', data),
    delete: (id: string) => socialApiClient.delete(`/short-urls/${id}`),
  },

  webhooks: {
    list: () => socialApiClient.get<Webhook[]>('/webhooks'),
    create: (data: Omit<Webhook, 'id' | 'createdAt' | 'lastTriggeredAt'>) =>
      socialApiClient.post<Webhook>('/webhooks', data),
    update: (id: string, data: Partial<Webhook>) =>
      socialApiClient.patch<Webhook>(`/webhooks/${id}`, data),
    delete: (id: string) => socialApiClient.delete(`/webhooks/${id}`),
    test: (id: string) => socialApiClient.post(`/webhooks/${id}/test`),
  },

  workspaces: {
    list: () => socialApiClient.get<Workspace[]>('/workspaces'),
    create: (data: { name: string; description?: string }) =>
      socialApiClient.post<Workspace>('/workspaces', data),
    get: (id: string) => socialApiClient.get<Workspace>(`/workspaces/${id}`),
    delete: (id: string) => socialApiClient.delete(`/workspaces/${id}`),
    listMembers: (id: string) =>
      socialApiClient.get<WorkspaceMember[]>(`/workspaces/${id}/members`),
    inviteMember: (id: string, data: { userId: string; role?: string }) =>
      socialApiClient.post<WorkspaceMember>(`/workspaces/${id}/members`, data),
    removeMember: (id: string, userId: string) =>
      socialApiClient.delete(`/workspaces/${id}/members/${userId}`),
  },

  timeSlots: {
    list: () => socialApiClient.get<TimeSlot[]>('/time-slots'),
    create: (data: Omit<TimeSlot, 'id' | 'createdAt'>) =>
      socialApiClient.post<TimeSlot>('/time-slots', data),
    delete: (id: string) => socialApiClient.delete(`/time-slots/${id}`),
  },

  contentSets: {
    list: () => socialApiClient.get<ContentSet[]>('/content-sets'),
    create: (data: Omit<ContentSet, 'id' | 'createdAt'>) =>
      socialApiClient.post<ContentSet>('/content-sets', data),
    delete: (id: string) => socialApiClient.delete(`/content-sets/${id}`),
  },

  apiKeys: {
    list: () => socialApiClient.get<ApiKeyInfo[]>('/api-keys'),
    create: (data: { name: string; scopes: string[]; expiresAt?: string }) =>
      socialApiClient.post<ApiKeyInfo & { key: string }>('/api-keys', data),
    revoke: (id: string) => socialApiClient.post(`/api-keys/${id}/revoke`),
  },

  ai: {
    generate: (data: AiGenerateRequest) =>
      socialApiClient.post<AiGenerateResponse>('/ai/generate', data),
    hashtags: (content: string) =>
      socialApiClient.post<{ hashtags: string[] }>('/ai/hashtags', { content }),
    bestTime: (accountId: string) =>
      socialApiClient.post<{ best_times: { day_of_week: number; hour: number; engagement_score: number }[] }>(`/ai/best-time`, { account_id: accountId }),
    smartReplies: (inboxItemId: string) =>
      socialApiClient.get<{ suggestions: string[] }>(`/ai/smart-replies/${inboxItemId}`),
  },
};
