import { meetApiClient } from './core';

// ============================================================================
// Types
// ============================================================================

export interface Room {
    id: string;
    name: string;
    description?: string;
    room_code: string;
    status: 'scheduled' | 'active' | 'ended';
    is_private: boolean;
    max_participants?: number;
    scheduled_start?: string;
    scheduled_end?: string;
    actual_start?: string;
    actual_end?: string;
    settings?: Record<string, unknown>;
    created_at: string;
    participant_count?: number;
    livekit_url?: string;
}

export interface CreateRoomRequest {
    name: string;
    description?: string;
    is_private?: boolean;
    password?: string;
    max_participants?: number;
    scheduled_start?: string;
    scheduled_end?: string;
    settings?: Record<string, unknown>;
}

export interface UpdateRoomRequest {
    name?: string;
    description?: string;
    is_private?: boolean;
    password?: string;
    max_participants?: number;
    scheduled_start?: string;
    scheduled_end?: string;
    settings?: Record<string, unknown>;
}

export interface Participant {
    id: string;
    user_id?: string;
    display_name: string;
    role: 'host' | 'moderator' | 'participant';
    joined_at: string;
    is_muted: boolean;
    is_video_off: boolean;
    is_screen_sharing: boolean;
}

export interface TokenResponse {
    token: string;
    livekit_url: string;
    room_name: string;
}

export interface Recording {
    id: string;
    room_id: string;
    status: 'recording' | 'processing' | 'ready' | 'failed';
    started_at: string;
    ended_at?: string;
    duration_seconds?: number;
    file_size_bytes?: number;
    download_url?: string;
}

export interface MeetingHistory {
    id: string;
    room_name: string;
    started_at: string;
    ended_at?: string;
    duration_seconds?: number;
    participant_count: number;
    had_recording: boolean;
}

export interface MeetConfig {
    livekit_url: string;
    max_participants_per_room: number;
    recording_enabled: boolean;
}

export interface MuteRequest {
    audio?: boolean;
    video?: boolean;
}

// ============================================================================
// Meet API
// ============================================================================

export const meetApi = {
    // ========================================================================
    // Config
    // ========================================================================

    getConfig: () =>
        meetApiClient.get<MeetConfig>('/meet/config'),

    // ========================================================================
    // Rooms
    // ========================================================================

    listRooms: () =>
        meetApiClient.get<Room[]>('/meet/rooms'),

    getRoom: (id: string) =>
        meetApiClient.get<Room>(`/meet/rooms/${id}`),

    createRoom: (data: CreateRoomRequest) =>
        meetApiClient.post<Room>('/meet/rooms', data),

    updateRoom: (id: string, data: UpdateRoomRequest) =>
        meetApiClient.put<Room>(`/meet/rooms/${id}`, data),

    deleteRoom: (id: string) =>
        meetApiClient.delete(`/meet/rooms/${id}`),

    endRoom: (id: string) =>
        meetApiClient.post(`/meet/rooms/${id}/end`),

    // ========================================================================
    // Tokens
    // ========================================================================

    getToken: () =>
        meetApiClient.get<TokenResponse>('/meet/token'),

    getRoomToken: (roomId: string) =>
        meetApiClient.get<TokenResponse>(`/meet/rooms/${roomId}/token`),

    // ========================================================================
    // Participants
    // ========================================================================

    listParticipants: (roomId: string) =>
        meetApiClient.get<Participant[]>(`/meet/rooms/${roomId}/participants`),

    kickParticipant: (roomId: string, userId: string) =>
        meetApiClient.post(`/meet/rooms/${roomId}/participants/${userId}/kick`),

    muteParticipant: (roomId: string, userId: string, data: MuteRequest) =>
        meetApiClient.post(`/meet/rooms/${roomId}/participants/${userId}/mute`, data),

    // ========================================================================
    // Recordings
    // ========================================================================

    listRecordings: (roomId: string) =>
        meetApiClient.get<Recording[]>(`/meet/rooms/${roomId}/recordings`),

    startRecording: (roomId: string) =>
        meetApiClient.post<Recording>(`/meet/rooms/${roomId}/recordings`),

    getRecording: (recordingId: string) =>
        meetApiClient.get<Recording>(`/meet/recordings/${recordingId}`),

    stopRecording: (recordingId: string) =>
        meetApiClient.post<Recording>(`/meet/recordings/${recordingId}/stop`),

    deleteRecording: (recordingId: string) =>
        meetApiClient.delete(`/meet/recordings/${recordingId}`),

    // ========================================================================
    // History
    // ========================================================================

    listHistory: () =>
        meetApiClient.get<MeetingHistory[]>('/meet/history'),
};
