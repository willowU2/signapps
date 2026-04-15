"use client";

// IDEA-117: Custom notification sounds — select different sounds per notification type

import { useState, useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Volume2, VolumeX, Play } from "lucide-react";

// Sound definitions — all data URIs to avoid server dependency
// Simple beep tones generated via AudioContext at runtime

export type SoundId = "default" | "chime" | "pop" | "ding" | "none";

export const SOUNDS: { id: SoundId; label: string }[] = [
  { id: "none", label: "Silencieux" },
  { id: "default", label: "Défaut (bip)" },
  { id: "chime", label: "Carillon" },
  { id: "pop", label: "Pop" },
  { id: "ding", label: "Ding" },
];

// AudioContext-based tone generator — no external files needed
function playTone(soundId: SoundId) {
  if (soundId === "none") return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const configs: Record<
      SoundId,
      { freq: number[]; duration: number; type: OscillatorType }
    > = {
      default: { freq: [440], duration: 0.2, type: "sine" },
      chime: { freq: [523, 659, 784], duration: 0.15, type: "sine" },
      pop: { freq: [800, 400], duration: 0.1, type: "square" },
      ding: { freq: [880], duration: 0.4, type: "triangle" },
      none: { freq: [], duration: 0, type: "sine" },
    };

    const cfg = configs[soundId];
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + cfg.duration,
    );

    let offset = 0;
    cfg.freq.forEach((f) => {
      osc.frequency.setValueAtTime(f, ctx.currentTime + offset);
      offset += cfg.duration / cfg.freq.length;
    });

    osc.type = cfg.type;
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + cfg.duration);
    setTimeout(() => ctx.close(), (cfg.duration + 0.1) * 1000);
  } catch {
    // AudioContext may be blocked
  }
}

const NOTIFICATION_TYPES = [
  { key: "mail", label: "Mail" },
  { key: "calendar", label: "Calendrier" },
  { key: "tasks", label: "Tâches" },
  { key: "alert", label: "Alertes système" },
  { key: "mention", label: "Mentions" },
];

const STORAGE_KEY = "notification_sounds";

type SoundMap = Record<string, SoundId>;

function loadSoundMap(): SoundMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function playNotificationSound(type: string) {
  try {
    const map = loadSoundMap();
    const soundId: SoundId = (map[type] as SoundId) ?? "default";
    playTone(soundId);
  } catch {
    // Silently fail
  }
}

export function NotificationSounds() {
  const [soundMap, setSoundMap] = useState<SoundMap>({});

  useEffect(() => {
    setSoundMap(loadSoundMap());
  }, []);

  const updateSound = (type: string, soundId: SoundId) => {
    const next = { ...soundMap, [type]: soundId };
    setSoundMap(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5" />
          Sons de notification
        </CardTitle>
        <CardDescription>
          Choisissez un son distinct pour chaque type de notification.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {NOTIFICATION_TYPES.map(({ key, label }) => {
          const current: SoundId = (soundMap[key] as SoundId) ?? "default";
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-32 flex-shrink-0">
                {label}
              </span>
              <Select
                value={current}
                onValueChange={(v) => updateSound(key, v as SoundId)}
              >
                <SelectTrigger className="flex-1 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOUNDS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.id === "none" ? (
                        <span className="flex items-center gap-2">
                          <VolumeX className="h-3.5 w-3.5" />
                          {s.label}
                        </span>
                      ) : (
                        s.label
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => playTone(current)}
                disabled={current === "none"}
                title="Prévisualiser"
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
