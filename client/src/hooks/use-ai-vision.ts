import { create } from 'zustand';
import { getClient, ServiceName } from '@/lib/api/factory';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VisionResult {
  description: string;
  tags?: string[];
  confidence?: number;
  objects?: DetectedObject[];
}

export interface DetectedObject {
  label: string;
  confidence: number;
  bbox?: { x: number; y: number; width: number; height: number };
}

export interface VqaResult {
  answer: string;
  confidence?: number;
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface VisionState {
  analyzing: boolean;
  result: VisionResult | null;
  vqaResult: VqaResult | null;
  error: string | null;

  describe: (image: File, prompt?: string) => Promise<void>;
  vqa: (image: File, question: string) => Promise<void>;
  reset: () => void;
}

const aiClient = getClient(ServiceName.AI);

export const useAiVision = create<VisionState>()((set) => ({
  analyzing: false,
  result: null,
  vqaResult: null,
  error: null,

  describe: async (image: File, prompt?: string) => {
    set({ analyzing: true, error: null, result: null });
    try {
      const formData = new FormData();
      formData.append('image', image);
      if (prompt) formData.append('prompt', prompt);

      const res = await aiClient.post<VisionResult>(
        '/ai/vision/describe',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      set({ result: res.data, analyzing: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Image description failed';
      set({ error: message, analyzing: false });
    }
  },

  vqa: async (image: File, question: string) => {
    set({ analyzing: true, error: null, vqaResult: null });
    try {
      const formData = new FormData();
      formData.append('image', image);
      formData.append('question', question);

      const res = await aiClient.post<VqaResult>(
        '/ai/vision/vqa',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      set({ vqaResult: res.data, analyzing: false });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Visual Q&A failed';
      set({ error: message, analyzing: false });
    }
  },

  reset: () => {
    set({ analyzing: false, result: null, vqaResult: null, error: null });
  },
}));
