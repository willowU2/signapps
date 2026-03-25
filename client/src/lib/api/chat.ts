/**
 * Chat API Module
 *
 * Uses the signapps-chat service (port 3020).
 * REST endpoints for channels, messages and reactions.
 * WebSocket endpoint for real-time updates.
 */
import { getClient, getServiceBaseUrl, ServiceName } from './factory';

// Get the chat service client
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

export interface ChatMessage {
    id: string;
    channel_id: string;
    user_id: string;
    username: string;
    content: string;
    created_at: string;
    updated_at?: string;
    parent_id?: string;
    reactions?: Record<string, number>; // emoji -> count
}

export interface SendMessageRequest {
    content: string;
    parent_id?: string;
}

export interface AddReactionRequest {
    emoji: string;
}

// ============================================================================
// Chat API - Channels
// ============================================================================

export const chatApi = {
    // ========================================================================
    // Channels
    // ========================================================================

    // List all channels
    getChannels: () =>
        chatClient.get<Channel[]>('/channels'),

    // Get a single channel
    getChannel: (id: string) =>
        chatClient.get<Channel>(`/channels/${id}`),

    // Create a new channel
    createChannel: (data: CreateChannelRequest) =>
        chatClient.post<Channel>('/channels', data),

    // Update a channel
    updateChannel: (id: string, data: UpdateChannelRequest) =>
        chatClient.put<Channel>(`/channels/${id}`, data),

    // Delete a channel
    deleteChannel: (id: string) =>
        chatClient.delete(`/channels/${id}`),

    // ========================================================================
    // Channel Members
    // ========================================================================

    // Get channel members
    getMembers: (channelId: string) =>
        chatClient.get<ChannelMember[]>(`/channels/${channelId}/members`),

    // Add a member to a channel
    addMember: (channelId: string, data: AddMemberRequest) =>
        chatClient.post<ChannelMember>(`/channels/${channelId}/members`, data),

    // Remove a member from a channel
    removeMember: (channelId: string, userId: string) =>
        chatClient.delete(`/channels/${channelId}/members/${userId}`),

    // ========================================================================
    // Messages
    // ========================================================================

    // List messages in a channel
    getMessages: (channelId: string) =>
        chatClient.get<ChatMessage[]>(`/channels/${channelId}/messages`),

    // Send a message to a channel
    sendMessage: (channelId: string, data: SendMessageRequest) =>
        chatClient.post<ChatMessage>(`/channels/${channelId}/messages`, data),

    // ========================================================================
    // Reactions
    // ========================================================================

    // Add a reaction to a message
    addReaction: (messageId: string, data: AddReactionRequest) =>
        chatClient.post(`/messages/${messageId}/reactions`, data),

    // ========================================================================
    // Direct Messages
    // ========================================================================

    // Get direct messages for current user
    getDirectMessages: () =>
        chatClient.get<DirectMessage[]>('/dms'),

    // Create a direct message conversation
    createDirectMessage: (data: CreateDmRequest) =>
        chatClient.post<DirectMessage>('/dms', data),

    // Delete a direct message
    deleteDirectMessage: (id: string) =>
        chatClient.delete(`/dms/${id}`),

    // ========================================================================
    // Read Status (Unread Counts)
    // ========================================================================

    // Get read status for a channel (unread count)
    getChannelReadStatus: (channelId: string) =>
        chatClient.get<ChannelReadStatus>(`/channels/${channelId}/read-status`),

    // Mark channel as read (reset unread count)
    markChannelRead: (channelId: string) =>
        chatClient.post<ChannelReadStatus>(`/channels/${channelId}/read-status`),

    // Get all unread counts for current user
    getAllUnreadCounts: () =>
        chatClient.get<ChannelReadStatus[]>('/unread-counts'),

    // ========================================================================
    // WebSocket URL helper
    // ========================================================================

    // Get WebSocket URL for real-time updates
    getWebSocketUrl: () => {
        const baseUrl = process.env.NEXT_PUBLIC_CHAT_URL || 'http://localhost:3020/api/v1';
        const wsBaseUrl = baseUrl.replace(/^http/, 'ws');
        return `${wsBaseUrl}/ws`;
    },
};
