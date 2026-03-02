import { docsApiClient } from './core';

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

// ============================================================================
// Chat API - Channels
// ============================================================================

export const chatApi = {
    // List all channels
    getChannels: () =>
        docsApiClient.get<Channel[]>('/channels'),

    // Get a single channel
    getChannel: (id: string) =>
        docsApiClient.get<Channel>(`/channels/${id}`),

    // Create a new channel
    createChannel: (data: CreateChannelRequest) =>
        docsApiClient.post<Channel>('/docs/chat', data),

    // Update a channel
    updateChannel: (id: string, data: UpdateChannelRequest) =>
        docsApiClient.put<Channel>(`/channels/${id}`, data),

    // Delete a channel
    deleteChannel: (id: string) =>
        docsApiClient.delete(`/channels/${id}`),

    // ========================================================================
    // Channel Members
    // ========================================================================

    // Get channel members
    getMembers: (channelId: string) =>
        docsApiClient.get<ChannelMember[]>(`/channels/${channelId}/members`),

    // Add a member to a channel
    addMember: (channelId: string, data: AddMemberRequest) =>
        docsApiClient.post<ChannelMember>(`/channels/${channelId}/members`, data),

    // Remove a member from a channel
    removeMember: (channelId: string, userId: string) =>
        docsApiClient.delete(`/channels/${channelId}/members/${userId}`),

    // ========================================================================
    // Direct Messages
    // ========================================================================

    // Get direct messages for current user
    getDirectMessages: () =>
        docsApiClient.get<DirectMessage[]>('/dms'),

    // Create a direct message conversation
    createDirectMessage: (data: CreateDmRequest) =>
        docsApiClient.post<DirectMessage>('/dms', data),

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
