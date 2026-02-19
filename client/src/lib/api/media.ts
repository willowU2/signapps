import { mediaApiClient, MEDIA_URL } from './core';

// OCR API
export const ocrApi = {
    extractText: (file: File, options?: OcrOptions) => {
        const formData = new FormData();
        formData.append('file', file);
        return mediaApiClient.post<OcrResponse>('/ocr', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            params: options,
        });
    },
    processDocument: (file: File, options?: OcrOptions) => {
        const formData = new FormData();
        formData.append('file', file);
        return mediaApiClient.post<OcrResponse>('/ocr/document', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            params: options,
        });
    },
    batchProcess: (files: string[], options?: OcrOptions) =>
        mediaApiClient.post<BatchOcrResponse>('/ocr/batch', { files, ...options }),
};

export interface OcrOptions {
    languages?: string;
    detect_layout?: boolean;
    detect_tables?: boolean;
}

export interface OcrResponse {
    success: boolean;
    text: string;
    confidence: number;
    pages: OcrPage[];
    metadata: OcrMetadata;
}

export interface OcrPage {
    page_number: number;
    text: string;
    blocks_count: number;
    tables_count: number;
}

export interface OcrMetadata {
    provider: string;
    processing_time_ms: number;
    total_pages: number;
    detected_languages: string[];
}

export interface BatchOcrResponse {
    job_id: string;
    status: string;
    total_files: number;
}

// TTS API (Text-to-Speech)
export const ttsApi = {
    synthesize: (text: string, options?: TtsOptions) =>
        mediaApiClient.post('/tts/synthesize', { text, ...options }, {
            responseType: 'blob',
        }),
    synthesizeStream: (text: string, options?: TtsOptions) =>
        `${MEDIA_URL}/tts/stream`,
    listVoices: () => mediaApiClient.get<Voice[]>('/tts/voices'),
};

export interface TtsOptions {
    voice?: string;
    speed?: number;
    pitch?: number;
    format?: 'wav' | 'mp3' | 'ogg' | 'flac';
}

export interface Voice {
    id: string;
    name: string;
    language: string;
    gender?: string;
    description?: string;
}

// STT API (Speech-to-Text)
export const sttApi = {
    transcribe: (file: File, options?: SttOptions) => {
        const formData = new FormData();
        formData.append('file', file);
        return mediaApiClient.post<TranscribeResponse>('/stt/transcribe', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            params: options,
        });
    },
    transcribeStream: (file: File, options?: SttOptions) => {
        const formData = new FormData();
        formData.append('file', file);
        // Returns EventSource URL
        return mediaApiClient.post('/stt/transcribe/stream', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            params: options,
        });
    },
    listModels: () => mediaApiClient.get<SttModel[]>('/stt/models'),
};

export interface SttOptions {
    language?: string;
    model?: string;
    task?: 'transcribe' | 'translate';
    word_timestamps?: boolean;
    diarize?: boolean;
}

export interface TranscribeResponse {
    success: boolean;
    text: string;
    language: string;
    language_probability: number;
    duration_seconds: number;
    segments: TranscribeSegment[];
    words?: TranscribeWord[];
    speakers?: Speaker[];
    model_used: string;
    processing_time_ms: number;
}

export interface TranscribeSegment {
    id: number;
    start: number;
    end: number;
    text: string;
    speaker?: string;
}

export interface TranscribeWord {
    word: string;
    start: number;
    end: number;
    probability: number;
    speaker?: string;
}

export interface Speaker {
    id: string;
    label: string;
    speaking_time: number;
    // Make sure we have start/end for speaker timeline if needed, but the original file didn't have it explicitly separate from segments
}

export interface SttModel {
    id: string;
    name: string;
    language?: string;
    size?: string;
}

// Media Jobs API
export const mediaJobsApi = {
    getStatus: (jobId: string) =>
        mediaApiClient.get<MediaJobStatus>(`/jobs/${jobId}`),
};

export interface MediaJobStatus {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    total_items: number;
    completed_items: number;
    failed_items: number;
    created_at: string;
    updated_at: string;
    result?: Record<string, unknown>;
    error?: string;
}

// Voice WebSocket helper
export function getVoiceWebSocketUrl(): string {
    const baseUrl = MEDIA_URL.replace(/^http/, 'ws');
    return `${baseUrl}/voice`;
}
