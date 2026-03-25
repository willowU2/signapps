import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  socialApi,
  SocialAccount,
  SocialPost,
  InboxItem,
  AnalyticsOverview,
  FollowerDataPoint,
  PlatformEngagement,
  RssFeed,
  PostTemplate,
} from '@/lib/api/social';

interface SocialState {
  // Data
  accounts: SocialAccount[];
  posts: SocialPost[];
  inboxItems: InboxItem[];
  analytics: AnalyticsOverview | null;
  followerHistory: FollowerDataPoint[];
  platformEngagement: PlatformEngagement[];
  topPosts: SocialPost[];
  rssFeeds: RssFeed[];
  templates: PostTemplate[];

  // UI state
  selectedAccountFilter: string | null;
  selectedPlatformFilter: string | null;
  isLoadingAccounts: boolean;
  isLoadingPosts: boolean;
  isLoadingInbox: boolean;
  isLoadingAnalytics: boolean;
  error: string | null;

  // Actions
  setSelectedAccountFilter: (id: string | null) => void;
  setSelectedPlatformFilter: (platform: string | null) => void;

  fetchAccounts: () => Promise<void>;
  fetchPosts: (params?: { status?: string; accountId?: string }) => Promise<void>;
  fetchInbox: (params?: { platform?: string; type?: string; unreadOnly?: boolean }) => Promise<void>;
  fetchAnalytics: () => Promise<void>;
  fetchRssFeeds: () => Promise<void>;
  fetchTemplates: () => Promise<void>;

  createPost: (data: Partial<SocialPost>) => Promise<SocialPost>;
  updatePost: (id: string, data: Partial<SocialPost>) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  publishPost: (id: string) => Promise<void>;
  schedulePost: (id: string, scheduledAt: string) => Promise<void>;

  markInboxRead: (id: string) => Promise<void>;
  replyToInbox: (id: string, content: string) => Promise<void>;

  addAccount: (data: { platform: string; instanceUrl?: string; handle?: string; appPassword?: string }) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;

  createRssFeed: (data: Omit<RssFeed, 'id' | 'createdAt' | 'lastCheckedAt'>) => Promise<void>;
  deleteRssFeed: (id: string) => Promise<void>;
  toggleRssFeed: (id: string, active: boolean) => Promise<void>;
  checkRssFeed: (id: string) => Promise<void>;

  createTemplate: (data: Omit<PostTemplate, 'id' | 'createdAt'>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  clearError: () => void;
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      accounts: [],
      posts: [],
      inboxItems: [],
      analytics: null,
      followerHistory: [],
      platformEngagement: [],
      topPosts: [],
      rssFeeds: [],
      templates: [],

      selectedAccountFilter: null,
      selectedPlatformFilter: null,
      isLoadingAccounts: false,
      isLoadingPosts: false,
      isLoadingInbox: false,
      isLoadingAnalytics: false,
      error: null,

      setSelectedAccountFilter: (id) => set({ selectedAccountFilter: id }),
      setSelectedPlatformFilter: (platform) => set({ selectedPlatformFilter: platform }),

      fetchAccounts: async () => {
        set({ isLoadingAccounts: true, error: null });
        try {
          const res = await socialApi.accounts.list();
          set({ accounts: res.data, isLoadingAccounts: false });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Failed to fetch accounts';
          set({ error: msg, isLoadingAccounts: false });
        }
      },

      fetchPosts: async (params) => {
        set({ isLoadingPosts: true, error: null });
        try {
          const res = await socialApi.posts.list(params);
          set({ posts: res.data.items, isLoadingPosts: false });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Failed to fetch posts';
          set({ error: msg, isLoadingPosts: false });
        }
      },

      fetchInbox: async (params) => {
        set({ isLoadingInbox: true, error: null });
        try {
          const res = await socialApi.inbox.list(params);
          set({ inboxItems: res.data.items, isLoadingInbox: false });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Failed to fetch inbox';
          set({ error: msg, isLoadingInbox: false });
        }
      },

      fetchAnalytics: async () => {
        set({ isLoadingAnalytics: true, error: null });
        try {
          const [overview, followers, byPlatform, top] = await Promise.all([
            socialApi.analytics.overview(),
            socialApi.analytics.followers(),
            socialApi.analytics.byPlatform(),
            socialApi.analytics.topPosts(),
          ]);
          set({
            analytics: overview.data,
            followerHistory: followers.data,
            platformEngagement: byPlatform.data,
            topPosts: top.data,
            isLoadingAnalytics: false,
          });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Failed to fetch analytics';
          set({ error: msg, isLoadingAnalytics: false });
        }
      },

      fetchRssFeeds: async () => {
        try {
          const res = await socialApi.rssFeeds.list();
          set({ rssFeeds: res.data });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Failed to fetch RSS feeds';
          set({ error: msg });
        }
      },

      fetchTemplates: async () => {
        try {
          const res = await socialApi.templates.list();
          set({ templates: res.data });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Failed to fetch templates';
          set({ error: msg });
        }
      },

      createPost: async (data) => {
        const res = await socialApi.posts.create(data);
        set((state) => ({ posts: [res.data, ...state.posts] }));
        return res.data;
      },

      updatePost: async (id, data) => {
        const res = await socialApi.posts.update(id, data);
        set((state) => ({
          posts: state.posts.map((p) => (p.id === id ? res.data : p)),
        }));
      },

      deletePost: async (id) => {
        await socialApi.posts.delete(id);
        set((state) => ({ posts: state.posts.filter((p) => p.id !== id) }));
      },

      publishPost: async (id) => {
        const res = await socialApi.posts.publish(id);
        set((state) => ({
          posts: state.posts.map((p) => (p.id === id ? res.data : p)),
        }));
      },

      schedulePost: async (id, scheduledAt) => {
        const res = await socialApi.posts.schedule(id, scheduledAt);
        set((state) => ({
          posts: state.posts.map((p) => (p.id === id ? res.data : p)),
        }));
      },

      markInboxRead: async (id) => {
        await socialApi.inbox.markRead(id);
        set((state) => ({
          inboxItems: state.inboxItems.map((i) => (i.id === id ? { ...i, read: true } : i)),
        }));
      },

      replyToInbox: async (id, content) => {
        await socialApi.inbox.reply(id, content);
        await get().markInboxRead(id);
      },

      addAccount: async (data) => {
        const res = await socialApi.accounts.create(data);
        set((state) => ({ accounts: [...state.accounts, res.data] }));
      },

      removeAccount: async (id) => {
        await socialApi.accounts.delete(id);
        set((state) => ({ accounts: state.accounts.filter((a) => a.id !== id) }));
      },

      createRssFeed: async (data) => {
        const res = await socialApi.rssFeeds.create(data);
        set((state) => ({ rssFeeds: [...state.rssFeeds, res.data] }));
      },

      deleteRssFeed: async (id) => {
        await socialApi.rssFeeds.delete(id);
        set((state) => ({ rssFeeds: state.rssFeeds.filter((f) => f.id !== id) }));
      },

      toggleRssFeed: async (id, active) => {
        await socialApi.rssFeeds.toggle(id, active);
        set((state) => ({
          rssFeeds: state.rssFeeds.map((f) => (f.id === id ? { ...f, active } : f)),
        }));
      },

      checkRssFeed: async (id) => {
        await socialApi.rssFeeds.checkNow(id);
      },

      createTemplate: async (data) => {
        const res = await socialApi.templates.create(data);
        set((state) => ({ templates: [...state.templates, res.data] }));
      },

      deleteTemplate: async (id) => {
        await socialApi.templates.delete(id);
        set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }));
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'social-store',
      partialize: (state) => ({
        selectedAccountFilter: state.selectedAccountFilter,
        selectedPlatformFilter: state.selectedPlatformFilter,
      }),
    }
  )
);
