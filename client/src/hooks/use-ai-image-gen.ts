import { create } from 'zustand';
import { getClient, ServiceName } from '@/lib/api/factory';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImageGenParams {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_steps?: number;
  guidance_scale?: number;
  seed?: number;
  model?: string;
  style?: string;
}

export interface ImageGenResult {
  image_url: string;
  seed_used: number;
  model_used: string;
  width: number;
  height: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  type: string;
  description?: string;
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface ImageGenState {
  generating: boolean;
  result: ImageGenResult | null;
  error: string | null;
  models: ModelInfo[];

  generate: (params: ImageGenParams) => Promise<void>;
  inpaint: (image: File, mask: File, prompt: string) => Promise<void>;
  img2img: (image: File, prompt: string, strength?: number) => Promise<void>;
  upscale: (image: File, scale?: number) => Promise<void>;
  fetchModels: () => Promise<void>;
  reset: () => void;
}

const aiClient = getClient(ServiceName.AI);

export const useAiImageGen = create<ImageGenState>()((set) => ({
  generating: false,
  result: null,
  error: null,
  models: [],

  generate: async (params: ImageGenParams) => {
    set({ generating: true, error: null, result: null });
    try {
      const res = await aiClient.post<ImageGenResult>(
        '/ai/image/generate',
        params,
      );
      set({ result: res.data, generating: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Image generation failed';
      set({ error: message, generating: false });
    }
  },

  inpaint: async (image: File, mask: File, prompt: string) => {
    set({ generating: true, error: null, result: null });
    try {
      const formData = new FormData();
      formData.append('image', image);
      formData.append('mask', mask);
      formData.append('prompt', prompt);

      const res = await aiClient.post<ImageGenResult>(
        '/ai/image/inpaint',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      set({ result: res.data, generating: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Inpainting failed';
      set({ error: message, generating: false });
    }
  },

  img2img: async (image: File, prompt: string, strength?: number) => {
    set({ generating: true, error: null, result: null });
    try {
      const formData = new FormData();
      formData.append('image', image);
      formData.append('prompt', prompt);
      if (strength !== undefined) {
        formData.append('strength', String(strength));
      }

      const res = await aiClient.post<ImageGenResult>(
        '/ai/image/img2img',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      set({ result: res.data, generating: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Image-to-image failed';
      set({ error: message, generating: false });
    }
  },

  upscale: async (image: File, scale?: number) => {
    set({ generating: true, error: null, result: null });
    try {
      const formData = new FormData();
      formData.append('image', image);
      if (scale !== undefined) {
        formData.append('scale', String(scale));
      }

      const res = await aiClient.post<ImageGenResult>(
        '/ai/image/upscale',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      set({ result: res.data, generating: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Upscale failed';
      set({ error: message, generating: false });
    }
  },

  fetchModels: async () => {
    try {
      const res = await aiClient.get<{ models: ModelInfo[] }>(
        '/ai/image/models',
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
