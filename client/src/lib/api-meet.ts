import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_MEET_API_URL || 'http://localhost:3013/api/v1/meet'

// Create axios instance with auth
const meetClient = axios.create({
    baseURL: API_URL,
})

// Add auth interceptor
meetClient.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
    }
    return config
})

// ============================================================================
// Types
// ============================================================================

export interface Room {
    id: string
    name: string
    description?: string
    room_code: string
    status: string // 'scheduled' | 'active' | 'ended'
    is_private: boolean
    max_participants?: number
    scheduled_start?: string
    scheduled_end?: string
    actual_start?: string
    actual_end?: string
    settings?: Record<string, unknown>
    created_at: string
    participant_count: number
    livekit_url: string
}

export interface Participant {
    id: string
    user_id?: string
    display_name: string
    role: string // 'host' | 'moderator' | 'participant'
    joined_at: string
    is_muted: boolean
    is_video_off: boolean
    is_screen_sharing: boolean
}

export interface Recording {
    id: string
    room_id: string
    status: string // 'recording' | 'processing' | 'ready' | 'failed'
    started_at: string
    ended_at?: string
    duration_seconds?: number
    file_size_bytes?: number
    download_url?: string
}

export interface MeetingHistory {
    id: string
    room_name: string
    started_at: string
    ended_at?: string
    duration_seconds?: number
    participant_count: number
    had_recording: boolean
}

export interface TokenResponse {
    token: string
    livekit_url: string
    room_name: string
}

export interface MeetConfig {
    livekit_url: string
    max_participants_per_room: number
    recording_enabled: boolean
}

// ============================================================================
// Room API
// ============================================================================

export interface CreateRoomRequest {
    name: string
    description?: string
    is_private?: boolean
    password?: string
    max_participants?: number
    scheduled_start?: string
    scheduled_end?: string
    settings?: Record<string, unknown>
}

export interface UpdateRoomRequest {
    name?: string
    description?: string
    is_private?: boolean
    password?: string
    max_participants?: number
    scheduled_start?: string
    scheduled_end?: string
    settings?: Record<string, unknown>
}

export const roomApi = {
    list: async (): Promise<Room[]> => {
        const res = await meetClient.get('/rooms')
        return res.data
    },

    get: async (id: string): Promise<Room> => {
        const res = await meetClient.get(`/rooms/${id}`)
        return res.data
    },

    create: async (data: CreateRoomRequest): Promise<Room> => {
        const res = await meetClient.post('/rooms', data)
        return res.data
    },

    update: async (id: string, data: UpdateRoomRequest): Promise<Room> => {
        const res = await meetClient.put(`/rooms/${id}`, data)
        return res.data
    },

    delete: async (id: string): Promise<void> => {
        await meetClient.delete(`/rooms/${id}`)
    },

    end: async (id: string): Promise<Room> => {
        const res = await meetClient.post(`/rooms/${id}/end`)
        return res.data
    },
}

// ============================================================================
// Token API
// ============================================================================

export interface JoinRoomRequest {
    password?: string
    display_name?: string
}

export const tokenApi = {
    getToken: async (room: string, displayName?: string): Promise<TokenResponse> => {
        const params = new URLSearchParams({ room })
        if (displayName) params.append('display_name', displayName)
        const res = await meetClient.get(`/token?${params.toString()}`)
        return res.data
    },

    getRoomToken: async (roomId: string, data?: JoinRoomRequest): Promise<TokenResponse> => {
        const res = await meetClient.get(`/rooms/${roomId}/token`, { data })
        return res.data
    },
}

// ============================================================================
// Participant API
// ============================================================================

export interface MuteRequest {
    audio?: boolean
    video?: boolean
}

export const participantApi = {
    list: async (roomId: string): Promise<Participant[]> => {
        const res = await meetClient.get(`/rooms/${roomId}/participants`)
        return res.data
    },

    kick: async (roomId: string, userId: string): Promise<void> => {
        await meetClient.post(`/rooms/${roomId}/participants/${userId}/kick`)
    },

    mute: async (roomId: string, userId: string, data: MuteRequest): Promise<Participant> => {
        const res = await meetClient.post(`/rooms/${roomId}/participants/${userId}/mute`, data)
        return res.data
    },
}

// ============================================================================
// Recording API
// ============================================================================

export const recordingApi = {
    list: async (roomId: string): Promise<Recording[]> => {
        const res = await meetClient.get(`/rooms/${roomId}/recordings`)
        return res.data
    },

    start: async (roomId: string): Promise<Recording> => {
        const res = await meetClient.post(`/rooms/${roomId}/recordings`)
        return res.data
    },

    get: async (recordingId: string): Promise<Recording> => {
        const res = await meetClient.get(`/recordings/${recordingId}`)
        return res.data
    },

    stop: async (recordingId: string): Promise<Recording> => {
        const res = await meetClient.post(`/recordings/${recordingId}/stop`)
        return res.data
    },

    delete: async (recordingId: string): Promise<void> => {
        await meetClient.delete(`/recordings/${recordingId}`)
    },
}

// ============================================================================
// History & Config API
// ============================================================================

export const historyApi = {
    list: async (): Promise<MeetingHistory[]> => {
        const res = await meetClient.get('/history')
        return res.data
    },
}

export const configApi = {
    get: async (): Promise<MeetConfig> => {
        const res = await meetClient.get('/config')
        return res.data
    },
}

// ============================================================================
// Combined API export
// ============================================================================

export const meetApi = {
    rooms: roomApi,
    tokens: tokenApi,
    participants: participantApi,
    recordings: recordingApi,
    history: historyApi,
    config: configApi,
}

export default meetApi
