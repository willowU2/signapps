import { createApiClient } from './core';

export const SOCIAL_URL = process.env.NEXT_PUBLIC_SOCIAL_URL || 'http://localhost:3019/api/v1';

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

export interface SocialPost {
  id: string;
  content: string;
  platformContent?: Record<string, string>; // per-platform overrides
  accounts: string[]; // account IDs
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledAt?: string;
  publishedAt?: string;
  mediaUrls?: string[];
  hashtags?: string[];
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

export const socialApi = {
  accounts: {
    list: () => socialApiClient.get<SocialAccount[]>('/accounts'),
    create: (data: { platform: string; instanceUrl?: string; handle?: string; appPassword?: string }) =>
      socialApiClient.post<SocialAccount>('/accounts', data),
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
    schedule: (id: string, scheduledAt: string) =>
      socialApiClient.post<SocialPost>(`/posts/${id}/schedule`, { scheduledAt }),
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
    delete: (id: string) => socialApiClient.delete(`/templates/${id}`),
  },

  ai: {
    generate: (data: AiGenerateRequest) =>
      socialApiClient.post<AiGenerateResponse>('/ai/generate', data),
    hashtags: (content: string) =>
      socialApiClient.post<{ hashtags: string[] }>('/ai/hashtags', { content }),
    bestTime: (accountId: string) =>
      socialApiClient.get<{ hour: number; day: string; reason: string }>(`/ai/best-time/${accountId}`),
    smartReplies: (inboxItemId: string) =>
      socialApiClient.get<{ suggestions: string[] }>(`/ai/smart-replies/${inboxItemId}`),
  },
};
