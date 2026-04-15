import { create } from "zustand";
import { getClient, ServiceName } from "@/lib/api/factory";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MusicParams {
  prompt: string;
  duration?: number;
  temperature?: number;
  model?: string;
  genre?: string;
  bpm?: number;
}

export interface SfxParams {
  prompt: string;
  duration?: number;
  model?: string;
}

export interface AudioResult {
  audio_url: string;
  duration: number;
  sample_rate: number;
  model_used: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  type: string;
  description?: string;
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface AudioGenState {
  generating: boolean;
  result: AudioResult | null;
  error: string | null;
  models: ModelInfo[];

  generateMusic: (params: MusicParams) => Promise<void>;
  generateSfx: (params: SfxParams) => Promise<void>;
  fetchModels: () => Promise<void>;
  reset: () => void;
}

const aiClient = getClient(ServiceName.AI);

export const useAiAudioGen = create<AudioGenState>()((set) => ({
  generating: false,
  result: null,
  error: null,
  models: [],

  generateMusic: async (params: MusicParams) => {
    set({ generating: true, error: null, result: null });
    try {
      const res = await aiClient.post<AudioResult>(
        "/ai/audio/generate/music",
        params,
      );
      set({ result: res.data, generating: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Music generation failed";
      set({ error: message, generating: false });
    }
  },

  generateSfx: async (params: SfxParams) => {
    set({ generating: true, error: null, result: null });
    try {
      const res = await aiClient.post<AudioResult>(
        "/ai/audio/generate/sfx",
        params,
      );
      set({ result: res.data, generating: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "SFX generation failed";
      set({ error: message, generating: false });
    }
  },

  fetchModels: async () => {
    try {
      const res = await aiClient.get<{ models: ModelInfo[] }>(
        "/ai/audio/models",
      );
      set({ models: res.data.models ?? [] });
    } catch {
      // Silently ignore — models list is non-critical
    }
  },

  reset: () => {
    set({ generating: false, result: null, error: null });
  },
}));
