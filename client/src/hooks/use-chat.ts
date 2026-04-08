"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { chatApi, ChatAttachment as Attachment } from "@/lib/api/chat";

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  parentId?: string;
  reactions?: Record<string, number>;
  attachment?: Attachment;
  isPinned?: boolean;
  isEdited?: boolean;
}

// ── localStorage persistence helpers ────────────────────────────────────────
const CHAT_STORAGE_PREFIX = "signapps_chat_messages_";
const MAX_CACHED_MESSAGES = 200;

function getCachedMessages(channelId: string): Message[] {
  try {
    const raw = localStorage.getItem(`${CHAT_STORAGE_PREFIX}${channelId}`);
    if (!raw) return [];
    return JSON.parse(raw) as Message[];
  } catch {
    return [];
  }
}

function setCachedMessages(channelId: string, messages: Message[]): void {
  try {
    // Only cache real messages (not optimistic ones)
    const toCache = messages
      .filter((m) => !m.id.startsWith("opt-"))
      .slice(-MAX_CACHED_MESSAGES);
    localStorage.setItem(
      `${CHAT_STORAGE_PREFIX}${channelId}`,
      JSON.stringify(toCache),
    );
  } catch {
    // localStorage full or unavailable — ignore
  }
}

function mapApiMessage(m: {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
  parent_id?: string;
  reactions?: Record<string, number>;
  attachment?: Attachment;
  is_pinned?: boolean;
}): Message {
  return {
    id: m.id,
    senderId: m.user_id,
    senderName: m.username,
    content: m.content,
    timestamp: m.created_at,
    parentId: m.parent_id,
    reactions: m.reactions,
    attachment: m.attachment,
    isPinned: m.is_pinned,
  };
}

interface WsMessageShape {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
  parent_id?: string;
  reactions?: Record<string, number>;
  attachment?: Attachment;
  is_pinned?: boolean;
}

// Backend sends: { "type": "<event>", "payload": { ... } }
// Payload content varies per event type:
//   new_message:      { message: WsMessageShape }
//   message_edited:   { message: WsMessageShape }
//   message_deleted:  { message_id: string, channel_id?: string }
//   message_pinned:   { message_id: string, channel_id?: string }
//   reaction_added:   { message_id: string, emoji: string, count?: number, user_id?: string }
interface WsEvent {
  type:
    | "new_message"
    | "message_edited"
    | "reaction_added"
    | "message_deleted"
    | "message_pinned"
    | "presence_updated";
  // Flat fields (legacy / DM in-memory broadcast)
  channel_id?: string;
  message?: WsMessageShape;
  message_id?: string;
  emoji?: string;
  count?: number;
  // Nested payload (channel message broadcasts from DB handlers)
  payload?: {
    message?: WsMessageShape;
    message_id?: string;
    channel_id?: string;
    user_id?: string;
    status?: string;
    emoji?: string;
    count?: number;
  };
}

export function useChat(
  channelId: string,
  userId: string,
  userName: string,
  isDm = false,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnecté, setIsConnecté] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Load existing messages via REST on channel change, fallback to localStorage
  useEffect(() => {
    if (!channelId || channelId === "accueil") return;

    // Immediately show cached messages while loading from API
    const cached = getCachedMessages(channelId);
    if (cached.length > 0) {
      setMessages(cached);
    } else {
      setMessages([]);
    }

    let cancelled = false;

    const loadMessages = async () => {
      try {
        const res = isDm
          ? await chatApi.getDmMessages(channelId)
          : await chatApi.getMessages(channelId);
        if (!cancelled) {
          const apiMessages = (res.data || []).map(mapApiMessage);
          setMessages(apiMessages);
          setCachedMessages(channelId, apiMessages);
        }
      } catch (e) {
        console.warn("Failed to load messages for channel", channelId, e);
        // Keep cached messages (already set above) as fallback
      }
    };

    loadMessages();

    // Mark channel read on entry (only for real channels, not DMs)
    if (!isDm) chatApi.markChannelRead(channelId).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [channelId, isDm]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (!channelId || channelId === "accueil" || messages.length === 0) return;
    setCachedMessages(channelId, messages);
  }, [channelId, messages]);

  // WebSocket connection for real-time events
  useEffect(() => {
    if (!channelId || channelId === "accueil") return;

    const connect = () => {
      const wsUrl = chatApi.getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecté(true);
        ws.send(JSON.stringify({ type: "subscribe", channel_id: channelId }));
      };

      ws.onmessage = (event) => {
        try {
          const evt: WsEvent = JSON.parse(event.data);

          // Support both flat fields and payload envelope
          const message = evt.message ?? evt.payload?.message;
          const messageId = evt.message_id ?? evt.payload?.message_id;
          const emoji = evt.emoji ?? evt.payload?.emoji;
          const count = evt.count ?? evt.payload?.count;

          if (evt.type === "new_message" && message) {
            const msg = mapApiMessage(message);
            setMessages((prev) => {
              if (prev.find((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            if (message.user_id !== userId) {
              setUnreadCount((c) => c + 1);
            }
          } else if (evt.type === "message_edited" && message) {
            const updated = mapApiMessage(message);
            setMessages((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m)),
            );
          } else if (evt.type === "reaction_added" && messageId && emoji) {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== messageId) return m;
                const reactions = { ...(m.reactions || {}) };
                reactions[emoji] = count ?? (reactions[emoji] || 0) + 1;
                return { ...m, reactions };
              }),
            );
          } else if (evt.type === "message_deleted" && messageId) {
            setMessages((prev) => prev.filter((m) => m.id !== messageId));
          } else if (evt.type === "message_pinned" && messageId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === messageId ? { ...m, isPinned: true } : m,
              ),
            );
          }
        } catch (e) {
          console.warn("Failed to parse WS event", e);
        }
      };

      ws.onclose = () => {
        setIsConnecté(false);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
      wsRef.current = null;
      setIsConnecté(false);
    };
  }, [channelId, userId]);

  const sendMessage = useCallback(
    async (content: string, parentId?: string, attachment?: Attachment) => {
      if (!channelId || channelId === "accueil") return;

      const optimisticId = `opt-${Date.now()}-${Math.random()}`;
      const optimistic: Message = {
        id: optimisticId,
        senderId: userId,
        senderName: userName,
        content,
        timestamp: new Date().toISOString(),
        parentId,
        attachment,
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        // Use DM endpoint for DM rooms, channel endpoint for channels
        const res = isDm
          ? await chatApi.sendDmMessage(channelId, { content })
          : await chatApi.sendMessage(channelId, {
              content,
              parent_id: parentId,
            });
        const confirmed = mapApiMessage(res.data);
        // Preserve attachment in confirmed message if backend doesn't return it
        if (attachment && !confirmed.attachment)
          confirmed.attachment = attachment;
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? confirmed : m)),
        );
      } catch (e) {
        console.error("Failed to send message", e);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    },
    [channelId, userId, userName, isDm],
  );

  const addReaction = useCallback(async (msgId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const reactions = { ...(m.reactions || {}) };
        reactions[emoji] = (reactions[emoji] || 0) + 1;
        return { ...m, reactions };
      }),
    );

    try {
      await chatApi.addReaction(msgId, { emoji });
    } catch (e) {
      console.warn("Failed to add reaction", e);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          const reactions = { ...(m.reactions || {}) };
          if (reactions[emoji] !== undefined) {
            reactions[emoji] = Math.max(0, reactions[emoji] - 1);
            if (reactions[emoji] === 0) delete reactions[emoji];
          }
          return { ...m, reactions };
        }),
      );
    }
  }, []);

  const pinMessage = useCallback(
    async (msgId: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, isPinned: true } : m)),
      );
      try {
        await chatApi.pinMessage(channelId, msgId);
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, isPinned: false } : m)),
        );
      }
    },
    [channelId],
  );

  const unpinMessage = useCallback(
    async (msgId: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, isPinned: false } : m)),
      );
      try {
        await chatApi.unpinMessage(channelId, msgId);
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, isPinned: true } : m)),
        );
      }
    },
    [channelId],
  );

  const markRead = useCallback(() => {
    setUnreadCount(0);
    if (!isDm) chatApi.markChannelRead(channelId).catch(() => {});
  }, [channelId, isDm]);

  // Optimistic local update after an edit confirmed by the API.
  const updateMessageContent = useCallback(
    (msgId: string, newContent: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, content: newContent, isEdited: true } : m,
        ),
      );
    },
    [],
  );

  // Optimistic local removal after a delete confirmed by the API.
  const removeMessage = useCallback((msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  }, []);

  return {
    messages,
    sendMessage,
    addReaction,
    pinMessage,
    unpinMessage,
    markRead,
    updateMessageContent,
    removeMessage,
    isConnecté,
    unreadCount,
  };
}
