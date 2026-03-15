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
};
