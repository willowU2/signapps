import { create } from 'zustand';
import { getClient, ServiceName } from '@/lib/api/factory';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VideoGenParams {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
  model?: string;
}

export interface VideoResult {
  video_url: string;
  duration: number;
  width: number;
  height: number;
  model_used: string;
}

export interface VideoAnalysis {
  description: string;
  scenes: VideoScene[];
  transcript?: string;
  tags?: string[];
}

export interface VideoScene {
  start_time: number;
  end_time: number;
  description: string;
}

export interface ExtractedFrames {
  frames: FrameInfo[];
  total_frames: number;
}

export interface FrameInfo {
  index: number;
  timestamp: number;
  image_url: string;
}

export interface VideoTranscript {
  text: string;
  segments: TranscriptSegment[];
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  type: string;
  description?: string;
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface VideoState {
  generating: boolean;
  analyzing: boolean;
  result: VideoResult | null;
  analysis: VideoAnalysis | null;
  frames: ExtractedFrames | null;
  transcript: VideoTranscript | null;
  error: string | null;
  models: ModelInfo[];

  generateVideo: (params: VideoGenParams) => Promise<void>;
  imgToVideo: (image: File, prompt?: string, duration?: number) => Promise<void>;
  analyzeVideo: (video: File, prompt?: string) => Promise<void>;
  extractFrames: (video: File, maxFrames?: number) => Promise<void>;
  transcribeVideo: (video: File) => Promise<void>;
  fetchModels: () => Promise<void>;
  reset: () => void;
}

const aiClient = getClient(ServiceName.AI);

export const useAiVideo = create<VideoState>()((set) => ({
  generating: false,
  analyzing: false,
  result: null,
  analysis: null,
  frames: null,
  transcript: null,
  error: null,
  models: [],

  generateVideo: async (params: VideoGenParams) => {
    set({ generating: true, error: null, result: null });
    try {
      const res = await aiClient.post<VideoResult>(
        '/ai/video/generate',
        params,
      );
      set({ result: res.data, generating: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Video generation failed';
      set({ error: message, generating: false });
    }
  },

  imgToVideo: async (image: File, prompt?: string, duration?: number) => {
    set({ generating: true, error: null, result: null });
    try {
      const formData = new FormData();
      formData.append('image', image);
      if (prompt) formData.append('prompt', prompt);
      if (duration !== undefined) formData.append('duration', String(duration));

      const res = await aiClient.post<VideoResult>(
        '/ai/video/img2video',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      set({ result: res.data, generating: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Image-to-video failed';
      set({ error: message, generating: false });
    }
  },

  analyzeVideo: async (video: File, prompt?: string) => {
    set({ analyzing: true, error: null, analysis: null });
    try {
      const formData = new FormData();
      formData.append('video', video);
      if (prompt) formData.append('prompt', prompt);

      const res = await aiClient.post<VideoAnalysis>(
        '/ai/video/analyze',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      set({ analysis: res.data, analyzing: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Video analysis failed';
      set({ error: message, analyzing: false });
    }
  },

  extractFrames: async (video: File, maxFrames?: number) => {
    set({ analyzing: true, error: null, frames: null });
    try {
      const formData = new FormData();
      formData.append('video', video);
      if (maxFrames !== undefined) {
        formData.append('max_frames', String(maxFrames));
      }

      const res = await aiClient.post<ExtractedFrames>(
        '/ai/video/extract-frames',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      set({ frames: res.data, analyzing: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Frame extraction failed';
      set({ error: message, analyzing: false });
    }
  },

  transcribeVideo: async (video: File) => {
    set({ analyzing: true, error: null, transcript: null });
    try {
      const formData = new FormData();
      formData.append('video', video);

      const res = await aiClient.post<VideoTranscript>(
        '/ai/video/transcribe',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      set({ transcript: res.data, analyzing: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Video transcription failed';
      set({ error: message, analyzing: false });
    }
  },

  fetchModels: async () => {
    try {
      const res = await aiClient.get<{ models: ModelInfo[] }>(
        '/ai/video/models',
      );
      set({ models: res.data.models ?? [] });
    } catch {
      // Silently ignore — models list is non-critical
    }
  },

  reset: () => {
    set({
      generating: false,
      analyzing: false,
      result: null,
      analysis: null,
      frames: null,
      transcript: null,
      error: null,
    });
  },
}));
