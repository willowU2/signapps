/**
 * Deploy page state. Holds the envs list, currently running deploy (if any),
 * and a short log ring for the WebSocket frames.
 */
import { create } from "zustand";
import type { EnvStatus, DeploymentEntry } from "@/lib/api/deploy";

const MAX_LOG_FRAMES = 200;

interface LogFrame {
  timestamp: string;
  channel: string;
  payload: unknown;
}

interface DeployState {
  envs: EnvStatus[];
  activeDeployment: DeploymentEntry | null;
  logFrames: LogFrame[];
  setEnvs: (envs: EnvStatus[]) => void;
  setActiveDeployment: (d: DeploymentEntry | null) => void;
  pushLogFrame: (frame: Omit<LogFrame, "timestamp">) => void;
  clearLogs: () => void;
}

export const useDeployStore = create<DeployState>((set) => ({
  envs: [],
  activeDeployment: null,
  logFrames: [],
  setEnvs: (envs) => set({ envs }),
  setActiveDeployment: (activeDeployment) => set({ activeDeployment }),
  pushLogFrame: (frame) =>
    set((state) => ({
      logFrames: [
        { ...frame, timestamp: new Date().toISOString() },
        ...state.logFrames,
      ].slice(0, MAX_LOG_FRAMES),
    })),
  clearLogs: () => set({ logFrames: [] }),
}));
