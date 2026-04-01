/**
 * Chat API Module
 *
 * Uses the signapps-chat service (port 3020).
 * REST endpoints for channels, messages, reactions, pins, DMs, presence,
 * search, unread counts and export.
 * WebSocket endpoint for real-time updates.
 */
import { getClient, getServiceBaseUrl, ServiceName } from './factory';

import { CHAT_URL } from '@/lib/api/core';
const chatClient = getClient(ServiceName.CHAT);

// ============================================================================
// Types
// ============================================================================

export interface Channel {
    id: string;
    name: string;
    topic?: string;
    is_private: boolean;
    created_at: string;
    created_by: string;
}

export interface CreateChannelRequest {
    name: string;
    topic?: string;
    is_private?: boolean;
}

export interface UpdateChannelRequest {
    name?: string;
    topic?: string;
    is_private?: boolean;
}

export interface ChannelMember {
    user_id: string;
    username: string;
    role: 'owner' | 'admin' | 'member';
    joined_at: string;
}

export interface AddMemberRequest {
    user_id: string;
    role?: 'owner' | 'admin' | 'member';
}

export interface ChatAttachment {
    url: string;
    filename: string;
    content_type: string;
    size: number;
}

export interface DirectMessage {
    id: string;
    participants: DmParticipant[];
    created_at: string;
    last_message_at?: string;
}

export interface DmParticipant {
    user_id: string;
    username: string;
}

export interface CreateDmRequest {
    participant_ids: string[];
}

export interface ChannelReadStatus {
    channel_id: string;
    user_id: string;
    unread_count: number;
    last_read_at: string;
}

export interface PresenceEntry {
    user_id: string;
    status: 'online' | 'away' | 'busy' | 'offline';
    updated_at: string;
}

export interface ChatMessage {
    id: string;
    channel_id: string;
    user_id: string;
    username: string;
    content: string;
    created_at: string;
    updated_at?: string;
    parent_id?: string;
    reactions?: Record<string, number>;
    attachment?: ChatAttachment;
    is_pinned?: boolean;
}

export interface SendMessageRequest {
    content: string;
    parent_id?: string;
}

export interface AddReactionRequest {
    emoji: string;
}

// ============================================================================
// Chat API
// ============================================================================

export const chatApi = {
    // ========================================================================
    // Channels
    // ========================================================================

    getChannels: () =>
        chatClient.get<Channel[]>('/channels'),

    getChannel: (id: string) =>
        chatClient.get<Channel>(`/channels/${id}`),

    createChannel: (data: CreateChannelRequest) =>
        chatClient.post<Channel>('/channels', data),

    updateChannel: (id: string, data: UpdateChannelRequest) =>
        chatClient.put<Channel>(`/channels/${id}`, data),

    deleteChannel: (id: string) =>
        chatClient.delete(`/channels/${id}`),

    // ========================================================================
    // Channel Members
    // NOTE: signapps-chat backend has no /members routes — not implemented yet.
    // These are forwarded to the docs service chat channels for now.
    // ========================================================================

    getMembers: (channelId: string) =>
        chatClient.get<ChannelMember[]>(`/channels/${channelId}/members`),

    addMember: (channelId: string, data: AddMemberRequest) =>
        chatClient.post<ChannelMember>(`/channels/${channelId}/members`, data),

    removeMember: (channelId: string, userId: string) =>
        chatClient.delete(`/channels/${channelId}/members/${userId}`),

    // ========================================================================
    // Messages (IDEA-133 threads via parent_id)
    // ========================================================================

    getMessages: (channelId: string) =>
        chatClient.get<ChatMessage[]>(`/channels/${channelId}/messages`),

    sendMessage: (channelId: string, data: SendMessageRequest) =>
        chatClient.post<ChatMessage>(`/channels/${channelId}/messages`, data),

    editMessage: (channelId: string, messageId: string, content: string) =>
        chatClient.patch<ChatMessage>(`/channels/${channelId}/messages/${messageId}`, { content }),

    deleteMessage: (channelId: string, messageId: string) =>
        chatClient.delete(`/channels/${channelId}/messages/${messageId}`),

    // ========================================================================
    // File sharing (IDEA-134)
    // ========================================================================

    uploadFile: (channelId: string, file: File, onProgress?: (pct: number) => void) => {
        const form = new FormData();
        form.append('file', file);
        return chatClient.post<ChatAttachment>(`/channels/${channelId}/upload`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (e: { loaded: number; total?: number }) => {
                if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
            },
        });
    },

    // ========================================================================
    // Reactions (IDEA-131)
    // ========================================================================

    addReaction: (messageId: string, data: AddReactionRequest) =>
        chatClient.post(`/messages/${messageId}/reactions`, data),

    // ========================================================================
    // Pinned messages (IDEA-132)
    // ========================================================================

    getPinnedMessages: (channelId: string) =>
        chatClient.get<ChatMessage[]>(`/channels/${channelId}/pins`),

    pinMessage: (channelId: string, messageId: string) =>
        chatClient.post(`/channels/${channelId}/messages/${messageId}/pin`, {}),

    unpinMessage: (channelId: string, messageId: string) =>
        chatClient.delete(`/channels/${channelId}/messages/${messageId}/pin`),

    // ========================================================================
    // Direct Messages (IDEA-137)
    // ========================================================================

    getDirectMessages: () =>
        chatClient.get<DirectMessage[]>('/dms'),

    createDirectMessage: (data: CreateDmRequest) =>
        chatClient.post<DirectMessage>('/dms', data),

    deleteDirectMessage: (id: string) =>
        chatClient.delete(`/dms/${id}`),

    getDmMessages: (roomId: string) =>
        chatClient.get<ChatMessage[]>(`/dms/${roomId}/messages`),

    sendDmMessage: (roomId: string, data: SendMessageRequest) =>
        chatClient.post<ChatMessage>(`/dms/${roomId}/messages`, data),

    // ========================================================================
    // Presence (IDEA-136)
    // ========================================================================

    getPresence: () =>
        chatClient.get<PresenceEntry[]>('/presence'),

    setPresence: (status: 'online' | 'away' | 'busy' | 'offline') =>
        chatClient.post<PresenceEntry>('/presence', { status }),

    // ========================================================================
    // Full-text search (IDEA-138)
    // ========================================================================

    searchMessages: (channelId: string, query: string) =>
        chatClient.get<ChatMessage[]>(`/channels/${channelId}/search`, { params: { q: query } }),

    // ========================================================================
    // Read Status / Unread Counts (IDEA-140)
    // ========================================================================

    getChannelReadStatus: (channelId: string) =>
        chatClient.get<ChannelReadStatus>(`/channels/${channelId}/read-status`),

    markChannelRead: (channelId: string) =>
        chatClient.post<ChannelReadStatus>(`/channels/${channelId}/read-status`, {}),

    getAllUnreadCounts: () =>
        chatClient.get<ChannelReadStatus[]>('/unread-counts'),

    // ========================================================================
    // Export (IDEA-142)
    // ========================================================================

    getExportUrl: (channelId: string, format: 'json' | 'csv' = 'json') => {
        const base = CHAT_URL;
        return `${base}/channels/${channelId}/export?format=${format}`;
    },

    // ========================================================================
    // WebSocket URL helper
    // Backend registers: /api/v1/ws (not /ws)
    // ========================================================================

    getWebSocketUrl: () => {
        const baseUrl = CHAT_URL;
        // baseUrl already ends in /api/v1, replace http→ws and append /ws
        const wsBaseUrl = baseUrl.replace(/^http/, 'ws');
        return `${wsBaseUrl}/ws`;
    },
};
