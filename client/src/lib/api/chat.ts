/**
 * Chat API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, getServiceBaseUrl, ServiceName } from './factory';

// Get the docs service client (chat is served by docs service)
const docsClient = getClient(ServiceName.DOCS);

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

// ============================================================================
// Chat API - Channels
// ============================================================================

export const chatApi = {
    // List all channels
    getChannels: () =>
        docsClient.get<Channel[]>('/channels'),

    // Get a single channel
    getChannel: (id: string) =>
        docsClient.get<Channel>(`/channels/${id}`),

    // Create a new channel
    createChannel: (data: CreateChannelRequest) =>
        docsClient.post<Channel>('/docs/chat', data),

    // Update a channel
    updateChannel: (id: string, data: UpdateChannelRequest) =>
        docsClient.put<Channel>(`/channels/${id}`, data),

    // Delete a channel
    deleteChannel: (id: string) =>
        docsClient.delete(`/channels/${id}`),

    // ========================================================================
    // Channel Members
    // ========================================================================

    // Get channel members
    getMembers: (channelId: string) =>
        docsClient.get<ChannelMember[]>(`/channels/${channelId}/members`),

    // Add a member to a channel
    addMember: (channelId: string, data: AddMemberRequest) =>
        docsClient.post<ChannelMember>(`/channels/${channelId}/members`, data),

    // Remove a member from a channel
    removeMember: (channelId: string, userId: string) =>
        docsClient.delete(`/channels/${channelId}/members/${userId}`),

    // ========================================================================
    // Direct Messages
    // ========================================================================

    // Get direct messages for current user
    getDirectMessages: () =>
        docsClient.get<DirectMessage[]>('/dms'),

    // Create a direct message conversation
    createDirectMessage: (data: CreateDmRequest) =>
        docsClient.post<DirectMessage>('/dms', data),

    // ========================================================================
    // Read Status (Unread Counts)
    // ========================================================================

    // Get read status for a channel (unread count)
    getChannelReadStatus: (channelId: string) =>
        docsClient.get<ChannelReadStatus>(`/channels/${channelId}/read-status`),

    // Mark channel as read (reset unread count)
    markChannelRead: (channelId: string) =>
        docsClient.post<ChannelReadStatus>(`/channels/${channelId}/read-status`),

    // Get all unread counts for current user
    getAllUnreadCounts: () =>
        docsClient.get<ChannelReadStatus[]>('/unread-counts'),

    // ========================================================================
    // WebSocket URL helper
    // ========================================================================

    // Get WebSocket URL for a channel
    getWebSocketUrl: (channelId: string) => {
        const baseUrl = process.env.NEXT_PUBLIC_DOCS_URL || 'http://localhost:3010/api/v1';
        const wsBaseUrl = baseUrl.replace(/^http/, 'ws');
        return `${wsBaseUrl}/docs/chat/${channelId}/ws`;
    },
};
