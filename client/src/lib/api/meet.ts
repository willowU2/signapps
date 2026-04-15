/**
 * Meet API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, ServiceName } from './factory';

// Get the meet service client (cached)
const meetClient = getClient(ServiceName.MEET);

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

export interface InstantRoomResponse {
    id: string;
    room_code: string;
    name: string;
    livekit_url?: string;
}

export interface LobbyInfo {
    room_code: string;
    room_name: string;
    knock_required?: boolean;
    host_present?: boolean;
    participant_count?: number;
}

export interface KnockRequest {
    display_name?: string;
}

export interface KnockResponse {
    knock_id: string;
    status: 'pending' | 'admitted' | 'denied';
}

export interface JoinRoomResponse {
    token: string;
    livekit_url: string;
    room_name: string;
    room_code: string;
}

// ============================================================================
// Meet API
// ============================================================================

export const meetApi = {
    // ========================================================================
    // Config
    // ========================================================================

    getConfig: () =>
        meetClient.get<MeetConfig>('/meet/config'),

    // ========================================================================
    // Rooms
    // ========================================================================

    listRooms: () =>
        meetClient.get<Room[]>('/meet/rooms'),

    getRoom: (id: string) =>
        meetClient.get<Room>(`/meet/rooms/${id}`),

    createRoom: (data: CreateRoomRequest) =>
        meetClient.post<Room>('/meet/rooms', data),

    createInstantRoom: () =>
        meetClient.post<InstantRoomResponse>('/meet/rooms/instant'),

    getLobby: (code: string) =>
        meetClient.get<LobbyInfo>(`/meet/rooms/${code}/lobby`),

    knock: (code: string, data?: KnockRequest) =>
        meetClient.post<KnockResponse>(`/meet/rooms/${code}/knock`, data ?? {}),

    admitKnock: (code: string, knockId: string) =>
        meetClient.post(`/meet/rooms/${code}/admit`, { knock_id: knockId }),

    denyKnock: (code: string, knockId: string) =>
        meetClient.post(`/meet/rooms/${code}/deny`, { knock_id: knockId }),

    joinByCode: (code: string, displayName?: string) =>
        meetClient.post<JoinRoomResponse>(`/meet/rooms/${code}/join`, {
            display_name: displayName,
        }),

    updateRoom: (id: string, data: UpdateRoomRequest) =>
        meetClient.put<Room>(`/meet/rooms/${id}`, data),

    deleteRoom: (id: string) =>
        meetClient.delete(`/meet/rooms/${id}`),

    endRoom: (id: string) =>
        meetClient.post(`/meet/rooms/${id}/end`),

    // ========================================================================
    // Tokens
    // ========================================================================

    getToken: () =>
        meetClient.get<TokenResponse>('/meet/token'),

    getRoomToken: (roomId: string) =>
        meetClient.get<TokenResponse>(`/meet/rooms/${roomId}/token`),

    // ========================================================================
    // Participants
    // ========================================================================

    listParticipants: (roomId: string) =>
        meetClient.get<Participant[]>(`/meet/rooms/${roomId}/participants`),

    kickParticipant: (roomId: string, userId: string) =>
        meetClient.post(`/meet/rooms/${roomId}/participants/${userId}/kick`),

    muteParticipant: (roomId: string, userId: string, data: MuteRequest) =>
        meetClient.post(`/meet/rooms/${roomId}/participants/${userId}/mute`, data),

    // ========================================================================
    // Recordings
    // ========================================================================

    listRecordings: (roomId: string) =>
        meetClient.get<Recording[]>(`/meet/rooms/${roomId}/recordings`),

    startRecording: (roomId: string) =>
        meetClient.post<Recording>(`/meet/rooms/${roomId}/recordings`),

    getRecording: (recordingId: string) =>
        meetClient.get<Recording>(`/meet/recordings/${recordingId}`),

    stopRecording: (recordingId: string) =>
        meetClient.post<Recording>(`/meet/recordings/${recordingId}/stop`),

    deleteRecording: (recordingId: string) =>
        meetClient.delete(`/meet/recordings/${recordingId}`),

    // ========================================================================
    // History
    // ========================================================================

    listHistory: () =>
        meetClient.get<MeetingHistory[]>('/meet/history'),

    // ========================================================================
    // Voicemails — /api/v1/meet/voicemails
    // ========================================================================

    voicemails: {
        list: () =>
            meetClient.get<Voicemail[]>('/meet/voicemails'),
        delete: (id: string) =>
            meetClient.delete(`/meet/voicemails/${id}`),
        markRead: (id: string) =>
            meetClient.patch(`/meet/voicemails/${id}/read`),
    },

    // ========================================================================
    // Video Messages — /api/v1/meet/video-messages
    // ========================================================================

    videoMessages: {
        list: () =>
            meetClient.get<VideoMessage[]>('/meet/video-messages'),
        create: (data: CreateVideoMessageRequest) =>
            meetClient.post<VideoMessage>('/meet/video-messages', data),
        delete: (id: string) =>
            meetClient.delete(`/meet/video-messages/${id}`),
        markRead: (id: string) =>
            meetClient.patch(`/meet/video-messages/${id}/read`),
    },
};

// ============================================================================
// Meet — Voicemail & VideoMessage types
// ============================================================================

export interface Voicemail {
    id: string;
    user_id: string;
    caller_name?: string;
    caller_phone?: string;
    duration_seconds?: number;
    transcription?: string;
    audio_storage_key?: string;
    is_read: boolean;
    created_at: string;
}

export interface VideoMessage {
    id: string;
    sender_id: string;
    recipient_id: string;
    duration_seconds?: number;
    thumbnail_url?: string;
    video_storage_key?: string;
    is_read: boolean;
    created_at: string;
}

export interface CreateVideoMessageRequest {
    recipient_id: string;
    duration_seconds?: number;
    thumbnail_url?: string;
    video_storage_key?: string;
}
