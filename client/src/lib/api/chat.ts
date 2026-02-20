import { docsApiClient } from './core';

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

export const chatApi = {
    // List all channels
    getChannels: () =>
        docsApiClient.get<Channel[]>('/channels'),

    // Create a new channel
    createChannel: (data: CreateChannelRequest) =>
        docsApiClient.post<Channel>('/docs/chat', data),
};
