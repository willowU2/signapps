// Feature 28: Notification sound → different per module

import { useState, useCallback, useRef } from "react";

export type NotifModule = "projects" | "hr" | "tasks" | "calendar" | "system" | "chat";

export interface ModuleSoundConfig {
  module: NotifModule;
  label: string;
  soundId: ModuleSoundId;
  enabled: boolean;
}

export type ModuleSoundId = "none" | "default" | "chime" | "pop" | "ding" | "beep" | "ping";

const SOUND_PARAMS: Record<ModuleSoundId, { freqs: number[]; duration: number; type: OscillatorType } | null> = {
  none: null,
  default: { freqs: [440], duration: 0.2, type: "sine" },
  chime: { freqs: [523, 659, 784], duration: 0.15, type: "sine" },
  pop: { freqs: [800, 400], duration: 0.1, type: "square" },
  ding: { freqs: [880], duration: 0.4, type: "triangle" },
  beep: { freqs: [660], duration: 0.15, type: "square" },
  ping: { freqs: [1200, 900], duration: 0.12, type: "sine" },
};

function playModuleSound(soundId: ModuleSoundId) {
  const params = SOUND_PARAMS[soundId];
  if (!params) return;
  try {
    const ctx = new AudioContext();
    const { freqs, duration, type } = params;
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * duration);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * duration);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * duration + duration);
      osc.start(ctx.currentTime + i * duration);
      osc.stop(ctx.currentTime + i * duration + duration);
    });
    setTimeout(() => ctx.close(), (freqs.length * duration + 0.5) * 1000);
  } catch {
    // AudioContext not available (SSR or restricted)
  }
}

const DEFAULT_CONFIGS: ModuleSoundConfig[] = [
  { module: "projects", label: "Projets", soundId: "chime", enabled: true },
  { module: "hr", label: "RH", soundId: "ding", enabled: true },
  { module: "tasks", label: "Tâches", soundId: "pop", enabled: true },
  { module: "calendar", label: "Calendrier", soundId: "ping", enabled: true },
  { module: "system", label: "Système", soundId: "beep", enabled: true },
  { module: "chat", label: "Chat", soundId: "default", enabled: true },
];

export function useNotificationModuleSounds() {
  const [configs, setConfigs] = useState<ModuleSoundConfig[]>(DEFAULT_CONFIGS);
  const lastPlayed = useRef<Map<NotifModule, number>>(new Map());

  const playForModule = useCallback((module: NotifModule) => {
    const config = configs.find((c) => c.module === module);
    if (!config?.enabled) return;

    // Debounce: don't play same module more than once per second
    const now = Date.now();
    const last = lastPlayed.current.get(module) ?? 0;
    if (now - last < 1000) return;
    lastPlayed.current.set(module, now);

    playModuleSound(config.soundId);
  }, [configs]);

  const setSoundForModule = useCallback((module: NotifModule, soundId: ModuleSoundId) => {
    setConfigs((prev) => prev.map((c) => c.module === module ? { ...c, soundId } : c));
  }, []);

  const toggleModule = useCallback((module: NotifModule, enabled: boolean) => {
    setConfigs((prev) => prev.map((c) => c.module === module ? { ...c, enabled } : c));
  }, []);

  const previewSound = useCallback((soundId: ModuleSoundId) => {
    playModuleSound(soundId);
  }, []);

  const ALL_SOUND_IDS: ModuleSoundId[] = ["none", "default", "chime", "pop", "ding", "beep", "ping"];

  return { configs, playForModule, setSoundForModule, toggleModule, previewSound, ALL_SOUND_IDS };
}
