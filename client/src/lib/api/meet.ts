/**
 * Meet API Module
 *
 * Migrated to use API Factory pattern.
 * @see factory.ts for client creation details
 */
import { getClient, getServiceBaseUrl, ServiceName } from './factory';

// Get the meet service client (cached)
const meetClient = getClient(ServiceName.MEET);
const MEET_BASE_URL = getServiceBaseUrl(ServiceName.MEET);

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

/** Response of `GET /meet/rooms/by-code/:code/recording` (public). */
export interface ActiveRecordingByCode {
    is_recording: boolean;
    recording_id?: string;
    started_at?: string;
    room_id: string;
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
    /** Room UUID (for code→id resolution without a separate round-trip). */
    room_id: string;
    /** Human-readable room name. */
    room_name: string;
    /** Whether the room accepts joins (not `ended`). */
    is_open: boolean;
    /** Whether the host requires explicit admission (knock flow). */
    requires_knock: boolean;
    /** Whether the room is password-protected. */
    has_password: boolean;
}

export interface KnockRequest {
    display_name: string;
    identity?: string;
}

export type KnockStatus = 'pending' | 'admitted' | 'denied';

export interface KnockResponse {
    request_id: string;
    identity: string;
    status: KnockStatus;
}

export interface KnockEntry {
    request_id: string;
    identity: string;
    display_name: string;
    status: KnockStatus;
    created_at: string;
    resolved_at?: string;
}

export interface KnockStatusResponse {
    status: KnockStatus;
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

    /** DB-backed knock flow (persisted in meet.waiting_room_requests). */
    knock: (code: string, data: KnockRequest) =>
        meetClient.post<KnockResponse>(`/meet/rooms/${code}/knock`, data),

    /** Public polling endpoint — returns the current status for an identity. */
    getKnockStatus: (code: string, identity: string) =>
        meetClient.get<KnockStatusResponse>(
            `/meet/rooms/${code}/knock-status?identity=${encodeURIComponent(identity)}`,
        ),

    /** Host-only — returns pending knockers for this room. */
    listKnocks: (code: string) =>
        meetClient.get<KnockEntry[]>(`/meet/rooms/${code}/knocks`),

    admitKnock: (code: string, identity: string) =>
        meetClient.post<KnockEntry>(
            `/meet/rooms/${code}/admit/${encodeURIComponent(identity)}`,
        ),

    denyKnock: (code: string, identity: string) =>
        meetClient.post<KnockEntry>(
            `/meet/rooms/${code}/deny/${encodeURIComponent(identity)}`,
        ),

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

    // Code-addressed convenience endpoints (host-only except the first).
    recordings: {
        /** Public. Returns `{ is_recording, recording_id?, started_at?, room_id }`. */
        getActiveByCode: (code: string) =>
            meetClient.get<ActiveRecordingByCode>(
                `/meet/rooms/by-code/${encodeURIComponent(code)}/recording`,
            ),
        /** Host-only. Starts a DB-tracked recording for the given room code. */
        startByCode: (code: string) =>
            meetClient.post<Recording>(
                `/meet/rooms/by-code/${encodeURIComponent(code)}/recording/start`,
            ),
        /** Host-only. Stops the active recording (if any) for the given room code. */
        stopByCode: (code: string) =>
            meetClient.post<Recording>(
                `/meet/rooms/by-code/${encodeURIComponent(code)}/recording/stop`,
            ),
        listByRoom: (roomId: string) =>
            meetClient.get<Recording[]>(`/meet/rooms/${roomId}/recordings`),
    },

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

    // ========================================================================
    // Live transcription (Phase 3b)
    // ========================================================================

    transcription: {
        /**
         * Persist a single utterance. Called by every client with the
         * transcription toggle enabled, once per audio chunk successfully
         * transcribed by signapps-media.
         */
        ingest: (code: string, data: TranscriptionChunk) =>
            meetClient.post<TranscriptionIngestResponse>(
                `/meet/rooms/${encodeURIComponent(code)}/transcription/ingest`,
                data,
            ),
        /** Fetch recent utterances (ordered by `timestamp_ms ASC`). */
        history: (code: string, limit = 200) =>
            meetClient.get<TranscriptionEntry[]>(
                `/meet/rooms/${encodeURIComponent(code)}/transcription/history?limit=${limit}`,
            ),
        /** Absolute URL for the export endpoint (for anchor hrefs / `window.open`). */
        exportUrl: (code: string, format: TranscriptionExportFormat = 'txt') =>
            `${MEET_BASE_URL}/meet/rooms/${encodeURIComponent(
                code,
            )}/transcription/export?format=${format}`,
    },

    // ========================================================================
    // Raise hand (Phase 3c)
    // ========================================================================

    hands: {
        list: (code: string) =>
            meetClient.get<RaisedHand[]>(
                `/meet/rooms/${encodeURIComponent(code)}/hands`,
            ),
        raise: (code: string) =>
            meetClient.post<RaiseHandResponse>(
                `/meet/rooms/${encodeURIComponent(code)}/hands/raise`,
            ),
        lower: (code: string) =>
            meetClient.post<LowerHandResponse>(
                `/meet/rooms/${encodeURIComponent(code)}/hands/lower`,
            ),
        lowerOther: (code: string, identity: string) =>
            meetClient.post<LowerHandResponse>(
                `/meet/rooms/${encodeURIComponent(code)}/hands/lower/${encodeURIComponent(
                    identity,
                )}`,
            ),
    },

    // ========================================================================
    // Polls (Phase 3c)
    // ========================================================================

    polls: {
        list: (code: string) =>
            meetClient.get<MeetPoll[]>(
                `/meet/rooms/${encodeURIComponent(code)}/polls`,
            ),
        create: (code: string, data: CreateMeetPollRequest) =>
            meetClient.post<MeetPoll>(
                `/meet/rooms/${encodeURIComponent(code)}/polls`,
                data,
            ),
        vote: (pollId: string, data: VoteMeetPollRequest) =>
            meetClient.post<MeetPoll>(
                `/meet/polls/${encodeURIComponent(pollId)}/vote`,
                data,
            ),
        close: (pollId: string) =>
            meetClient.post<MeetPoll>(
                `/meet/polls/${encodeURIComponent(pollId)}/close`,
            ),
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

// ============================================================================
// Live transcription (Phase 3b)
// ============================================================================

/** Payload for `POST /meet/rooms/:code/transcription/ingest` and the
 * LiveKit data-channel broadcast — identical shape on both sides. */
export interface TranscriptionChunk {
    speaker_identity: string;
    text: string;
    timestamp_ms: number;
    language?: string | null;
}

/** Response of `POST /meet/rooms/:code/transcription/ingest`. */
export interface TranscriptionIngestResponse {
    id: string;
}

/** One persisted utterance returned by the history endpoint. */
export interface TranscriptionEntry {
    id: string;
    room_id: string;
    speaker_identity: string;
    text: string;
    timestamp_ms: number;
    language?: string | null;
    created_at: string;
}

export type TranscriptionExportFormat = 'md' | 'srt' | 'txt';

// ============================================================================
// Raise hand (Phase 3c)
// ============================================================================

export interface RaisedHand {
    identity: string;
    raised_at: string;
}

export interface RaiseHandResponse {
    identity: string;
    raised_at: string;
}

export interface LowerHandResponse {
    identity: string;
}

// ============================================================================
// Polls (Phase 3c)
// ============================================================================

/** A live poll inside a meet room. Named `MeetPoll` to avoid a name
 * collision with the calendar module's `Poll` type. */
export interface MeetPoll {
    id: string;
    room_id: string;
    created_by: string;
    question: string;
    /** Options is a JSON array of strings. */
    options: string[];
    /** Vote map keyed by identity. */
    votes: Record<string, number>;
    created_at: string;
    closed_at?: string | null;
}

export interface CreateMeetPollRequest {
    question: string;
    options: string[];
}

export interface VoteMeetPollRequest {
    option_index: number;
}
