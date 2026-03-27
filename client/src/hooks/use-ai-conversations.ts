import { create } from 'zustand';
import { getClient, ServiceName } from '@/lib/api/factory';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  title: string;
  model?: string;
  provider?: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens_used?: number;
  created_at: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  model?: string;
  provider?: string;
  messages: ConversationMessage[];
  created_at: string;
  updated_at: string;
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface ConversationsState {
  conversations: Conversation[];
  currentConversation: ConversationDetail | null;
  loading: boolean;
  error: string | null;

  fetchConversations: () => Promise<void>;
  fetchConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  reset: () => void;
}

const aiClient = getClient(ServiceName.AI);

export const useAiConversations = create<ConversationsState>()((set, get) => ({
  conversations: [],
  currentConversation: null,
  loading: false,
  error: null,

  fetchConversations: async () => {
    set({ loading: true, error: null });
    try {
      const res = await aiClient.get<{ conversations: Conversation[] }>(
        '/ai/conversations',
      );
      const conversations = res.data.conversations ?? (res.data as unknown as Conversation[]);
      set({
        conversations: Array.isArray(conversations) ? conversations : [],
        loading: false,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch conversations';
      set({ error: message, loading: false });
    }
  },

  fetchConversation: async (id: string) => {
    set({ loading: true, error: null, currentConversation: null });
    try {
      const res = await aiClient.get<ConversationDetail>(
        `/ai/conversations/${id}`,
      );
      set({ currentConversation: res.data, loading: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch conversation';
      set({ error: message, loading: false });
    }
  },

  deleteConversation: async (id: string) => {
    try {
      await aiClient.delete(`/ai/conversations/${id}`);
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        currentConversation:
          state.currentConversation?.id === id
            ? null
            : state.currentConversation,
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete conversation';
      set({ error: message });
    }
  },

  reset: () => {
    set({
      conversations: [],
      currentConversation: null,
      loading: false,
      error: null,
    });
  },
}));
