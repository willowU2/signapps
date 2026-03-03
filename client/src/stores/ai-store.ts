"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: AiSource[];
}

export interface AiSource {
  document_id: string;
  filename: string;
  score: number;
  excerpt: string;
}

interface AiState {
  messages: AiMessage[];
  isStreaming: boolean;
  streamingMessageId: string | null;

  // Actions
  addMessage: (role: 'user' | 'assistant', content: string) => string;
  updateMessage: (id: string, content: string) => void;
  appendToMessage: (id: string, token: string) => void;
  setMessageSources: (id: string, sources: AiSource[]) => void;
  setStreaming: (isStreaming: boolean, messageId?: string | null) => void;
  clearMessages: () => void;
}

export const useAiStore = create<AiState>()(
  persist(
    (set, get) => ({
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Bonjour ! Comment puis-je vous aider aujourd\'hui ?',
          timestamp: new Date().toISOString(),
        },
      ],
      isStreaming: false,
      streamingMessageId: null,

      addMessage: (role, content) => {
        const id = crypto.randomUUID();
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id,
              role,
              content,
              timestamp: new Date().toISOString(),
            },
          ],
        }));
        return id;
      },

      updateMessage: (id, content) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, content } : msg
          ),
        }));
      },

      appendToMessage: (id, token) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, content: msg.content + token } : msg
          ),
        }));
      },

      setMessageSources: (id, sources) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, sources } : msg
          ),
        }));
      },

      setStreaming: (isStreaming, messageId = null) => {
        set({ isStreaming, streamingMessageId: messageId });
      },

      clearMessages: () => {
        set({
          messages: [
            {
              id: 'welcome',
              role: 'assistant',
              content: 'Bonjour ! Comment puis-je vous aider aujourd\'hui ?',
              timestamp: new Date().toISOString(),
            },
          ],
          isStreaming: false,
          streamingMessageId: null,
        });
      },
    }),
    {
      name: 'ai-chat-storage',
      partialize: (state) => ({
        messages: state.messages,
      }),
    }
  )
);

// Granular selector hooks for optimized re-renders
export const useAiMessages = () => useAiStore((state) => state.messages);

export const useAiStreamingState = () =>
  useAiStore(
    useShallow((state) => ({
      isStreaming: state.isStreaming,
      streamingMessageId: state.streamingMessageId,
    }))
  );

export const useAiMessageActions = () =>
  useAiStore(
    useShallow((state) => ({
      addMessage: state.addMessage,
      updateMessage: state.updateMessage,
      appendToMessage: state.appendToMessage,
      setMessageSources: state.setMessageSources,
      setStreaming: state.setStreaming,
      clearMessages: state.clearMessages,
    }))
  );
