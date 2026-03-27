import { create } from 'zustand';
import { getClient, ServiceName } from '@/lib/api/factory';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface BackendInfo {
  name: string;
  backend_type: { type: string; url?: string; provider?: string };
  quality_score: number;
  available: boolean;
}

export interface Capability {
  capability: string;
  available: boolean;
  backends: BackendInfo[];
  active_backend: string;
  local_quality: number;
  cloud_quality: number | null;
  upgrade_recommended: boolean;
  gpu_loaded: boolean;
  vram_required_mb: number;
}

export interface LoadedModel {
  model_id: string;
  capability: string;
  vram_mb: number;
  loaded_at: string;
  last_used: string;
}

export interface GpuState {
  id: number;
  name: string;
  total_vram_mb: number;
  used_vram_mb: number;
  loaded_models: LoadedModel[];
  role: string;
}

export interface GpuStatus {
  gpus: GpuState[];
  total_vram_mb: number;
  free_vram_mb: number;
  tier: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

interface AiCapabilitiesStore {
  capabilities: Capability[];
  gpuStatus: GpuStatus | null;
  loading: boolean;
  error: string | null;
  fetchCapabilities: () => Promise<void>;
  fetchGpuStatus: () => Promise<void>;
}

export const useAiCapabilities = create<AiCapabilitiesStore>()((set) => ({
  capabilities: [],
  gpuStatus: null,
  loading: false,
  error: null,

  fetchCapabilities: async () => {
    set({ loading: true, error: null });
    try {
      const client = getClient(ServiceName.AI);
      const res = await client.get<{ capabilities: Capability[] }>('/ai/capabilities');
      const data = res.data;
      const capabilities = Array.isArray(data)
        ? (data as Capability[])
        : data.capabilities ?? [];
      set({ capabilities, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch capabilities';
      set({ error: message, loading: false });
    }
  },

  fetchGpuStatus: async () => {
    try {
      const client = getClient(ServiceName.AI);
      const res = await client.get<GpuStatus>('/ai/gpu/status');
      set({ gpuStatus: res.data });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch GPU status';
      set({ error: message });
    }
  },
}));
