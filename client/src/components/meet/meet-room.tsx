"use client";

import { LIVEKIT_URL } from "@/lib/api/core";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast as sonnerToast } from "sonner";
import { meetApi } from "@/lib/api/meet";
import { useAuthStore } from "@/lib/store";
import { LiveKitRoom, RoomAudioRenderer } from "@/components/meet/livekit-lazy";
import {
  ParticipantTile,
  useTracks,
  useLocalParticipant,
  useConnectionState,
  useParticipants,
  useIsSpeaking,
  useParticipantInfo,
  useRoomContext,
  ParticipantContext,
  TrackRefContext,
  isTrackReference,
} from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import "@livekit/components-styles";
import {
  Track,
  ConnectionState,
  RoomEvent,
  LocalVideoTrack,
  type RemoteParticipant,
} from "livekit-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  MonitorUp,
  Hand,
  MoreVertical,
  ArrowLeft,
  Link2,
  Settings,
  Info,
  Sparkles,
  Radio,
  Captions,
  Circle,
  DoorOpen,
  Check,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { KnockEntry, RaisedHand } from "@/lib/api/meet";

import { MeetSidebar } from "./meet-sidebar";
import {
  LiveTranscriptionOverlay,
  TRANSCRIPTION_TOPIC,
} from "./live-transcription-overlay";
import type { TranscriptionChunk } from "@/lib/api/meet";
import { MEDIA_URL } from "@/lib/api/core";
import {
  applyVirtualBackground,
  type BackgroundMode,
  type VirtualBackgroundHandle,
} from "@/lib/video/virtual-background";
import {
  VIRTUAL_BG_PRESETS,
  VIRTUAL_BG_STORAGE_KEY,
} from "@/app/meet/[code]/lobby/page";

/**
 * LiveKit data channel topic used to broadcast raise-hand state changes
 * `{ type: 'raise' | 'lower', identity: string }`. Every participant
 * subscribes so the ✋ overlay shows up instantly, the DB row is the
 * source of truth for hydrate-on-join.
 */
export const HAND_TOPIC = "hand";

interface HandPayload {
  type: "raise" | "lower";
  identity: string;
}

/** React context exposing the set of currently-raised identities plus a
 * host-only lowerer. Consumed by `ParticipantTileInner` (for the ✋
 * overlay) and the sidebar participants tab. */
const RaisedHandsContext = createContext<{
  raisedSet: Set<string>;
  isHost: boolean;
  lowerOther: (identity: string) => Promise<void>;
}>({ raisedSet: new Set(), isHost: false, lowerOther: async () => {} });

export function useRaisedHandsContext() {
  return useContext(RaisedHandsContext);
}

interface MeetRoomProps {
  roomId: string;
  roomName?: string;
  token: string;
  serverUrl: string;
  onLeave: () => void;
}

export function MeetRoom({
  roomId,
  roomName,
  token,
  serverUrl,
  onLeave,
}: MeetRoomProps) {
  if (!token) return null;

  return (
    <LiveKitRoom
      video={false}
      audio={false}
      token={token}
      serverUrl={serverUrl}
      data-lk-theme="default"
      className="h-full w-full"
      onError={(err) => {
        console.warn("LiveKitRoom Error:", err);
        toast.error("Une erreur critique est survenue dans la salle.");
      }}
    >
      <RoomAudioRenderer />
      <MeetUiContent
        onLeave={onLeave}
        roomId={roomId}
        roomName={roomName ?? roomId}
      />
    </LiveKitRoom>
  );
}

function useIsMobile(breakpoint = 767) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

/**
 * Poll `/meet/rooms/by-code/:code/recording` every 5 seconds so every
 * participant (not just the host) can see the "recording on" badge.
 */
function useRecordingPolling(code: string) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await meetApi.recordings.getActiveByCode(code);
      setIsRecording(res.data.is_recording);
      setRecordingId(res.data.recording_id ?? null);
    } catch {
      // Silent — polling keeps retrying.
    }
  }, [code]);

  useEffect(() => {
    let active = true;
    refresh();
    const id = setInterval(() => {
      if (!active) return;
      refresh();
    }, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [refresh]);

  return { isRecording, recordingId, refresh };
}

/**
 * Poll pending knock requests for the given room code (host only).
 * No-op when `enabled=false` (non-host path).
 */
function usePendingKnocks(code: string, enabled: boolean) {
  const [entries, setEntries] = useState<KnockEntry[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setEntries([]);
      return;
    }
    try {
      const res = await meetApi.listKnocks(code);
      setEntries(res.data);
    } catch {
      // Non-host or transient error — keep the previous snapshot silently.
    }
  }, [code, enabled]);

  useEffect(() => {
    let active = true;
    refresh();
    const id = setInterval(() => {
      if (active) refresh();
    }, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [refresh]);

  return { entries, refresh };
}

// ─────────────────────────────────────────────────────────────────────────────
// Live transcription pipeline
// ─────────────────────────────────────────────────────────────────────────────

const TRANSCRIPTION_STORAGE_KEY = "meet:transcription:enabled";
/** 2-second chunks — matches the plan. */
const CHUNK_MS = 2000;

/**
 * Pick the first supported MIME type for {@link MediaRecorder}.
 * Opus in WebM is universally supported by signapps-media (via ffmpeg).
 */
function pickMimeType(): string | undefined {
  if (typeof window === "undefined" || !("MediaRecorder" in window)) {
    return undefined;
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      // older browsers throw — just skip.
    }
  }
  return undefined;
}

/**
 * Capture microphone, cut into 2-second chunks, POST each to
 * signapps-media STT, broadcast the text via LiveKit data channel, and
 * persist via the meet backend. Runs only when `enabled` is true.
 */
function useTranscriptionPipeline(enabled: boolean, roomCode: string) {
  const room = useRoomContext();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("microphone-unsupported");
      return;
    }
    const mimeType = pickMimeType();
    if (!mimeType) {
      setError("mediarecorder-unsupported");
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let cycleTimer: number | null = null;
    const encoder = new TextEncoder();
    const mediaLanguage =
      navigator.language?.toLowerCase().split("-")[0] ?? "fr";

    const processBlob = async (blob: Blob) => {
      if (cancelled || blob.size < 1_200) return;
      try {
        const fd = new FormData();
        fd.append("file", blob, `chunk-${Date.now()}.webm`);
        const mediaRes = await fetch(
          `${MEDIA_URL}/api/v1/stt/transcribe?language=${encodeURIComponent(
            mediaLanguage,
          )}`,
          {
            method: "POST",
            credentials: "include",
            body: fd,
          },
        );
        if (!mediaRes.ok) {
          throw new Error(`media ${mediaRes.status}`);
        }
        const json = (await mediaRes.json()) as {
          text?: string;
          language?: string;
        };
        const text = (json.text ?? "").trim();
        if (!text || cancelled) return;

        const identity = room?.localParticipant?.identity ?? "unknown";
        const chunk: TranscriptionChunk = {
          speaker_identity: identity,
          text,
          timestamp_ms: Date.now(),
          language: json.language ?? mediaLanguage,
        };

        // Persist (server-side authoritative copy).
        void meetApi.transcription.ingest(roomCode, chunk).catch(() => {
          // Keep the meeting going even if persistence hiccups.
        });

        // Broadcast to peers via LiveKit data channel.
        if (room?.localParticipant) {
          try {
            await room.localParticipant.publishData(
              encoder.encode(JSON.stringify(chunk)),
              { reliable: true, topic: TRANSCRIPTION_TOPIC },
            );
          } catch {
            // Broadcast failure is non-fatal — persistence still works.
          }
        }
      } catch (err) {
        if (cancelled) return;
        // One-shot warning, don't flood.
        console.warn("[meet] STT chunk failed", err);
      }
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        recorder = new MediaRecorder(stream, { mimeType });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          if (chunks.length === 0) return;
          const blob = new Blob(chunks.splice(0), { type: mimeType });
          void processBlob(blob);
        };
        recorder.start();
        cycleTimer = window.setInterval(() => {
          if (!recorder) return;
          if (recorder.state === "recording") {
            recorder.stop();
            // Give the blob a tick to be processed before starting the next.
            try {
              recorder.start();
            } catch {
              // state race — abandon this cycle gracefully.
            }
          }
        }, CHUNK_MS);
      } catch (err) {
        setError((err as Error)?.name || "capture-failed");
      }
    })();

    return () => {
      cancelled = true;
      if (cycleTimer !== null) window.clearInterval(cycleTimer);
      try {
        if (recorder && recorder.state !== "inactive") recorder.stop();
      } catch {
        /* noop */
      }
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [enabled, roomCode, room]);

  return { error };
}

// ─────────────────────────────────────────────────────────────────────────────
// Virtual background pipeline (in-meeting)
// ─────────────────────────────────────────────────────────────────────────────

interface VirtualBgPrefs {
  mode: BackgroundMode;
  imageId: string;
}

function readVirtualBgPrefs(): VirtualBgPrefs {
  if (typeof window === "undefined")
    return { mode: "none", imageId: VIRTUAL_BG_PRESETS[0].id };
  try {
    const raw = window.sessionStorage.getItem(VIRTUAL_BG_STORAGE_KEY);
    if (!raw) return { mode: "none", imageId: VIRTUAL_BG_PRESETS[0].id };
    const parsed = JSON.parse(raw) as Partial<VirtualBgPrefs>;
    const mode: BackgroundMode =
      parsed.mode === "blur" ||
      parsed.mode === "image" ||
      parsed.mode === "none"
        ? parsed.mode
        : "none";
    const imageId = parsed.imageId || VIRTUAL_BG_PRESETS[0].id;
    return { mode, imageId };
  } catch {
    return { mode: "none", imageId: VIRTUAL_BG_PRESETS[0].id };
  }
}

/**
 * Swap the currently published camera track with one processed by the
 * virtual background pipeline. When `mode === "none"` the original
 * track is restored via `restartTrack()`.
 */
function useLiveVirtualBackground(
  prefs: VirtualBgPrefs,
  enabled: boolean,
  onDegrade: (to: BackgroundMode) => void,
) {
  const room = useRoomContext();
  const handleRef = useRef<VirtualBackgroundHandle | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!room || !enabled) return;
    const lp = room.localParticipant;
    if (!lp) return;

    let cancelled = false;

    const apply = async () => {
      // Find the currently published camera publication.
      const pub = Array.from(lp.trackPublications.values()).find(
        (p) => p.source === Track.Source.Camera,
      );
      const track = pub?.track;
      if (!track || !(track instanceof LocalVideoTrack)) return;

      // Stop any previous pipeline.
      handleRef.current?.stop();
      handleRef.current = null;

      if (prefs.mode === "none") {
        // Restore to a fresh raw camera capture.
        try {
          await track.restartTrack();
        } catch {
          // Non-fatal — keep whatever is currently published.
        }
        return;
      }

      // Get a raw camera MediaStream we can feed into the pipeline.
      let rawStream = rawStreamRef.current;
      if (!rawStream) {
        try {
          rawStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          rawStreamRef.current = rawStream;
        } catch {
          return;
        }
      }
      if (cancelled) return;

      const preset = VIRTUAL_BG_PRESETS.find((p) => p.id === prefs.imageId);
      const handle = applyVirtualBackground(rawStream, {
        mode: prefs.mode,
        imageUrl: preset?.url || undefined,
        onDegrade: (_from, to) => onDegrade(to),
      });
      handleRef.current = handle;

      const processedTrack = handle.output.getVideoTracks()[0];
      if (!processedTrack) return;
      try {
        await track.replaceTrack(processedTrack);
      } catch {
        // Degrade silently to the raw track.
        handle.stop();
        handleRef.current = null;
      }
    };

    void apply();

    return () => {
      cancelled = true;
    };
    // Intentionally not depending on `onDegrade` (callers must pass stable refs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, enabled, prefs.mode, prefs.imageId]);

  // Final cleanup on unmount — release camera + canvas.
  useEffect(() => {
    return () => {
      handleRef.current?.stop();
      handleRef.current = null;
      rawStreamRef.current?.getTracks().forEach((t) => t.stop());
      rawStreamRef.current = null;
    };
  }, []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Raised hands
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Track raised hands for the given room.
 * - Hydrates once via `GET /hands` on mount.
 * - Subscribes to the `HAND_TOPIC` LiveKit data channel for instant updates.
 * - Polls `GET /hands` every 15s as a safety net.
 *
 * Returns a stable `Set<string>` of identities currently raised plus
 * helpers to raise/lower.
 */
function useRaisedHands(roomCode: string) {
  const room = useRoomContext();
  const [raisedSet, setRaisedSet] = useState<Set<string>>(() => new Set());

  const hydrate = useCallback(async () => {
    try {
      const res = await meetApi.hands.list(roomCode);
      setRaisedSet(new Set(res.data.map((h) => h.identity)));
    } catch {
      // Silent — data channel updates take over between polls.
    }
  }, [roomCode]);

  // Initial hydrate + 15s fallback polling.
  useEffect(() => {
    hydrate();
    const id = window.setInterval(hydrate, 15_000);
    return () => window.clearInterval(id);
  }, [hydrate]);

  // Live data-channel subscription.
  useEffect(() => {
    if (!room) return;
    const decoder = new TextDecoder();
    const onData = (
      payload: Uint8Array,
      _participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== HAND_TOPIC) return;
      try {
        const json = JSON.parse(decoder.decode(payload)) as HandPayload;
        if (!json.identity) return;
        setRaisedSet((prev) => {
          const next = new Set(prev);
          if (json.type === "raise") next.add(json.identity);
          else next.delete(json.identity);
          return next;
        });
      } catch {
        // Bad payload — ignore.
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  const broadcast = useCallback(
    async (payload: HandPayload) => {
      if (!room?.localParticipant) return;
      try {
        const encoder = new TextEncoder();
        await room.localParticipant.publishData(
          encoder.encode(JSON.stringify(payload)),
          { reliable: true, topic: HAND_TOPIC },
        );
      } catch {
        // Non-fatal.
      }
    },
    [room],
  );

  const raise = useCallback(async () => {
    const identity = room?.localParticipant?.identity ?? "";
    // Optimistic.
    setRaisedSet((prev) => {
      const next = new Set(prev);
      if (identity) next.add(identity);
      return next;
    });
    try {
      await meetApi.hands.raise(roomCode);
      await broadcast({ type: "raise", identity });
    } catch {
      // Revert on failure.
      setRaisedSet((prev) => {
        const next = new Set(prev);
        if (identity) next.delete(identity);
        return next;
      });
      throw new Error("raise-failed");
    }
  }, [broadcast, room, roomCode]);

  const lower = useCallback(async () => {
    const identity = room?.localParticipant?.identity ?? "";
    setRaisedSet((prev) => {
      const next = new Set(prev);
      if (identity) next.delete(identity);
      return next;
    });
    try {
      await meetApi.hands.lower(roomCode);
      await broadcast({ type: "lower", identity });
    } catch {
      throw new Error("lower-failed");
    }
  }, [broadcast, room, roomCode]);

  const lowerOther = useCallback(
    async (identity: string) => {
      setRaisedSet((prev) => {
        const next = new Set(prev);
        next.delete(identity);
        return next;
      });
      try {
        await meetApi.hands.lowerOther(roomCode, identity);
        await broadcast({ type: "lower", identity });
      } catch {
        await hydrate();
        throw new Error("lower-other-failed");
      }
    },
    [broadcast, hydrate, roomCode],
  );

  return { raisedSet, raise, lower, lowerOther, hydrate };
}

/**
 * Resolve whether the current user is the room's host by scanning
 * `listRooms()` (which only returns rooms the caller created).
 */
function useIsRoomHost(code: string): boolean {
  const { user } = useAuthStore();
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) {
      setIsHost(false);
      return;
    }
    meetApi
      .listRooms()
      .then((res) => {
        if (!active) return;
        setIsHost(res.data.some((r) => r.room_code === code));
      })
      .catch(() => {
        if (active) setIsHost(false);
      });
    return () => {
      active = false;
    };
  }, [code, user]);

  return isHost;
}

function MeetUiContent({
  onLeave,
  roomId,
  roomName,
}: {
  onLeave: () => void;
  roomId: string;
  roomName: string;
}) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isHost = useIsRoomHost(roomId);
  const { isRecording, refresh: refreshRecording } =
    useRecordingPolling(roomId);
  const { entries: pendingKnocks, refresh: refreshKnocks } = usePendingKnocks(
    roomId,
    isHost,
  );
  const [recordingBusy, setRecordingBusy] = useState(false);
  const {
    raisedSet,
    raise: raiseHand,
    lower: lowerHand,
    lowerOther: lowerOtherHand,
  } = useRaisedHands(roomId);
  const room = useRoomContext();
  const localIdentity = room?.localParticipant?.identity ?? "";
  const isLocalRaised = !!localIdentity && raisedSet.has(localIdentity);
  const toggleRaiseHand = async () => {
    try {
      if (isLocalRaised) {
        await lowerHand();
      } else {
        await raiseHand();
        sonnerToast.success("Main levée");
      }
    } catch {
      sonnerToast.error("Action impossible");
    }
  };

  // ── Virtual background state (hydrated from the lobby choice) ────────
  const [bgPrefs, setBgPrefs] = useState<VirtualBgPrefs>(() =>
    readVirtualBgPrefs(),
  );
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        VIRTUAL_BG_STORAGE_KEY,
        JSON.stringify(bgPrefs),
      );
    } catch {
      // storage unavailable — in-memory only.
    }
  }, [bgPrefs]);
  const onBgDegrade = useCallback((to: BackgroundMode) => {
    if (to === "none") {
      sonnerToast.warning("Flou désactivé — trop lent");
    } else {
      sonnerToast.warning("Arrière-plan simplifié — performance insuffisante");
    }
    setBgPrefs((prev) => ({ ...prev, mode: to }));
  }, []);
  useLiveVirtualBackground(bgPrefs, true, onBgDegrade);

  // ── Live transcription toggle ────────────────────────────────────────
  const [transcriptionEnabled, setTranscriptionEnabled] = useState<boolean>(
    () => {
      if (typeof window === "undefined") return false;
      return window.sessionStorage.getItem(TRANSCRIPTION_STORAGE_KEY) === "1";
    },
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      TRANSCRIPTION_STORAGE_KEY,
      transcriptionEnabled ? "1" : "0",
    );
  }, [transcriptionEnabled]);
  const { error: transcriptionError } = useTranscriptionPipeline(
    transcriptionEnabled,
    roomId,
  );
  useEffect(() => {
    if (transcriptionError && transcriptionEnabled) {
      sonnerToast.error("Transcription indisponible");
      setTranscriptionEnabled(false);
    }
  }, [transcriptionError, transcriptionEnabled]);
  const toggleTranscription = () => setTranscriptionEnabled((v) => !v);

  const handleAdmit = async (identity: string) => {
    try {
      await meetApi.admitKnock(roomId, identity);
      sonnerToast.success("Participant admis");
      await refreshKnocks();
    } catch {
      sonnerToast.error("Impossible d'admettre ce participant");
    }
  };

  const handleDeny = async (identity: string) => {
    try {
      await meetApi.denyKnock(roomId, identity);
      sonnerToast.message("Demande refusée");
      await refreshKnocks();
    } catch {
      sonnerToast.error("Impossible de refuser cette demande");
    }
  };

  const {
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    localParticipant,
  } = useLocalParticipant();
  const connectionState = useConnectionState();
  const isConnected = connectionState === ConnectionState.Connected;
  const participants = useParticipants();
  const participantCount = participants.length;

  const toggleMic = async () => {
    if (!isConnected) return;
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === "NotAllowedError") {
        toast.error("Accès au micro refusé.");
      } else {
        toast.error("Impossible d'activer le micro.");
      }
    }
  };

  const toggleCamera = async () => {
    if (!isConnected) return;
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === "NotAllowedError") {
        toast.error("Accès à la caméra refusé.");
      } else {
        toast.error("Impossible d'activer la caméra.");
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!isConnected) return;
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch {
      toast.error("Impossible de partager l'écran.");
    }
  };

  const handleLeave = () => {
    onLeave();
    router.back();
  };

  const copyLink = async () => {
    try {
      const url = `${window.location.origin}/meet/${encodeURIComponent(roomId)}/lobby`;
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié");
    } catch {
      toast.error("Impossible de copier le lien");
    }
  };

  const openSidebar = () => {
    setSidebarOpen((v) => !v);
  };

  const startRecording = async () => {
    setRecordingBusy(true);
    try {
      await meetApi.recordings.startByCode(roomId);
      sonnerToast.success("Enregistrement démarré");
      await refreshRecording();
    } catch {
      sonnerToast.error("Impossible de démarrer l'enregistrement");
    } finally {
      setRecordingBusy(false);
    }
  };

  const stopRecording = async () => {
    setRecordingBusy(true);
    try {
      await meetApi.recordings.stopByCode(roomId);
      sonnerToast.success("Enregistrement arrêté");
      await refreshRecording();
    } catch {
      sonnerToast.error("Impossible d'arrêter l'enregistrement");
    } finally {
      setRecordingBusy(false);
    }
  };

  return (
    <RaisedHandsContext.Provider
      value={{ raisedSet, isHost, lowerOther: lowerOtherHand }}
    >
      <div className="flex h-full w-full flex-col bg-background overflow-hidden">
        {/* ── Top bar ───────────────────────────────────────────────── */}
        <header className="h-12 px-3 md:px-4 flex items-center justify-between bg-card border-b border-border shrink-0">
          {/* Left */}
          <div className="flex items-center gap-1 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLeave}
              className="h-8 text-muted-foreground hover:text-foreground gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Quitter</span>
            </Button>
          </div>
          {/* Center */}
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="hidden sm:block text-sm font-semibold text-foreground truncate max-w-[40vw]">
              {roomName}
            </h1>
            <Badge
              variant="outline"
              className="border-border text-foreground gap-1"
            >
              <Circle className="h-2 w-2 fill-primary text-primary" />
              {participantCount}
            </Badge>
            {isRecording && (
              <Badge
                className="bg-destructive text-destructive-foreground gap-1 animate-pulse"
                aria-label="Enregistrement en cours"
              >
                <Circle className="h-2 w-2 fill-current" />
                <span className="hidden sm:inline">Enregistrement</span>
              </Badge>
            )}
          </div>
          {/* Right */}
          <div className="flex items-center gap-1">
            {isHost && pendingKnocks.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="relative h-8 text-muted-foreground hover:text-foreground gap-1.5"
                    aria-label={`${pendingKnocks.length} demandes d'entrée`}
                  >
                    <DoorOpen className="h-4 w-4" />
                    <Badge
                      className="h-5 min-w-[1.25rem] px-1.5 bg-primary text-primary-foreground"
                      aria-hidden
                    >
                      {pendingKnocks.length}
                    </Badge>
                    <span className="hidden md:inline">Demandes</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-80 bg-card border-border p-0"
                >
                  <div className="px-4 py-3 border-b border-border">
                    <div className="text-sm font-semibold text-foreground">
                      Demandes d&apos;entrée
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {pendingKnocks.length}{" "}
                      {pendingKnocks.length > 1 ? "personnes" : "personne"} en
                      attente
                    </div>
                  </div>
                  <ul className="flex flex-col divide-y divide-border max-h-80 overflow-y-auto">
                    {pendingKnocks.map((entry) => (
                      <li
                        key={entry.request_id}
                        className="flex items-center gap-2 px-3 py-2"
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-muted text-foreground text-xs font-semibold">
                            {initials(entry.display_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            {entry.display_name}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {entry.identity}
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleAdmit(entry.identity)}
                          className="h-8 w-8 text-primary hover:bg-primary/10"
                          aria-label="Admettre"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeny(entry.identity)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          aria-label="Refuser"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </PopoverContent>
              </Popover>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={openSidebar}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Participants et chat"
            >
              <Users className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="Plus d'options"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={copyLink} className="gap-2">
                  <Link2 className="h-4 w-4" />
                  Copier le lien
                </DropdownMenuItem>
                {isHost && (
                  <>
                    <DropdownMenuSeparator />
                    {isRecording ? (
                      <DropdownMenuItem
                        onClick={stopRecording}
                        disabled={recordingBusy}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Radio className="h-4 w-4" />
                        Arrêter l&apos;enregistrement
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={startRecording}
                        disabled={recordingBusy}
                        className="gap-2"
                      >
                        <Radio className="h-4 w-4" />
                        Démarrer l&apos;enregistrement
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={toggleTranscription}
                  className="gap-2"
                >
                  <Captions className="h-4 w-4" />
                  {transcriptionEnabled
                    ? "Arrêter la transcription"
                    : "Activer la transcription"}
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <Settings className="h-4 w-4" />
                  Paramètres
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2">
                  <Info className="h-4 w-4" />
                  Info salle
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* ── Body: grid + sidebar ───────────────────────────────── */}
        <div className="flex-1 flex min-h-0">
          <main className="relative flex-1 min-w-0 flex flex-col">
            <VideoGrid isMobile={isMobile} />
            <LiveTranscriptionOverlay
              roomCode={roomId}
              visible={transcriptionEnabled}
            />
          </main>

          {/* Desktop sidebar (fixed panel, md+) */}
          {sidebarOpen && !isMobile && (
            <div className="hidden md:flex animate-in slide-in-from-right duration-200">
              <MeetSidebar
                onClose={() => setSidebarOpen(false)}
                roomCode={roomId}
                isHost={isHost}
                raisedSet={raisedSet}
                onLowerOther={lowerOtherHand}
              />
            </div>
          )}

          {/* Mobile sidebar (Sheet drawer, < md) */}
          <Sheet
            open={sidebarOpen && isMobile}
            onOpenChange={(o) => setSidebarOpen(o)}
          >
            <SheetContent
              side="bottom"
              className="h-[80vh] p-0 bg-card border-border md:hidden"
            >
              <div className="h-full">
                <MeetSidebar
                  onClose={() => setSidebarOpen(false)}
                  roomCode={roomId}
                  isHost={isHost}
                  raisedSet={raisedSet}
                  onLowerOther={lowerOtherHand}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* ── Bottom controls ──────────────────────────────────── */}
        <BottomBar
          isConnected={isConnected}
          isMicrophoneEnabled={isMicrophoneEnabled}
          isCameraEnabled={isCameraEnabled}
          isScreenShareEnabled={isScreenShareEnabled}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onToggleScreenShare={toggleScreenShare}
          onLeave={handleLeave}
          transcriptionEnabled={transcriptionEnabled}
          onToggleTranscription={toggleTranscription}
          handRaised={isLocalRaised}
          onToggleRaiseHand={toggleRaiseHand}
          bgPrefs={bgPrefs}
          onChangeBgPrefs={setBgPrefs}
        />
      </div>
    </RaisedHandsContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom bar
// ─────────────────────────────────────────────────────────────────────────────

interface BottomBarProps {
  isConnected: boolean;
  isMicrophoneEnabled: boolean;
  isCameraEnabled: boolean;
  isScreenShareEnabled: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
  transcriptionEnabled: boolean;
  onToggleTranscription: () => void;
  handRaised: boolean;
  onToggleRaiseHand: () => void;
  bgPrefs: VirtualBgPrefs;
  onChangeBgPrefs: (
    updater: VirtualBgPrefs | ((prev: VirtualBgPrefs) => VirtualBgPrefs),
  ) => void;
}

function BottomBar({
  isConnected,
  isMicrophoneEnabled,
  isCameraEnabled,
  isScreenShareEnabled,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onLeave,
  transcriptionEnabled,
  onToggleTranscription,
  handRaised,
  onToggleRaiseHand,
  bgPrefs,
  onChangeBgPrefs,
}: BottomBarProps) {
  const round = "rounded-full h-10 w-10 md:h-11 md:w-11 transition-colors";

  return (
    <footer
      data-testid="meet-bottom-bar"
      className="h-14 md:h-16 px-2 md:px-4 flex items-center justify-center gap-1.5 md:gap-2 bg-card border-t border-border shrink-0"
    >
      {/* Mic */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleMic}
        disabled={!isConnected}
        className={`${round} ${
          isMicrophoneEnabled
            ? "bg-muted text-foreground hover:bg-muted/80"
            : "bg-destructive/10 text-destructive hover:bg-destructive/20"
        }`}
        aria-label={
          isMicrophoneEnabled ? "Couper le micro" : "Activer le micro"
        }
      >
        {isMicrophoneEnabled ? (
          <Mic className="h-4 w-4 md:h-5 md:w-5" />
        ) : (
          <MicOff className="h-4 w-4 md:h-5 md:w-5" />
        )}
      </Button>

      {/* Camera */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCamera}
        disabled={!isConnected}
        className={`${round} ${
          isCameraEnabled
            ? "bg-muted text-foreground hover:bg-muted/80"
            : "bg-destructive/10 text-destructive hover:bg-destructive/20"
        }`}
        aria-label={isCameraEnabled ? "Couper la caméra" : "Activer la caméra"}
      >
        {isCameraEnabled ? (
          <Video className="h-4 w-4 md:h-5 md:w-5" />
        ) : (
          <VideoOff className="h-4 w-4 md:h-5 md:w-5" />
        )}
      </Button>

      {/* Screen share */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleScreenShare}
        disabled={!isConnected}
        className={`${round} ${
          isScreenShareEnabled
            ? "bg-primary/15 text-primary hover:bg-primary/20"
            : "bg-muted text-foreground hover:bg-muted/80"
        }`}
        aria-label="Partager l'écran"
      >
        <MonitorUp className="h-4 w-4 md:h-5 md:w-5" />
      </Button>

      {/* Raise hand */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleRaiseHand}
        className={`${round} ${
          handRaised
            ? "bg-primary/15 text-primary hover:bg-primary/20"
            : "bg-muted text-foreground hover:bg-muted/80"
        }`}
        aria-label={handRaised ? "Baisser la main" : "Lever la main"}
        aria-pressed={handRaised}
      >
        <Hand className="h-4 w-4 md:h-5 md:w-5" />
      </Button>

      {/* More options */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`${round} bg-muted text-foreground hover:bg-muted/80`}
            aria-label="Plus d'options"
          >
            <MoreVertical className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top" className="w-56">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Arrière-plan
          </div>
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              onChangeBgPrefs((prev) => ({ ...prev, mode: "none" }));
            }}
            className="gap-2"
          >
            <span className="ml-5 flex-1">Aucun</span>
            {bgPrefs.mode === "none" && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              onChangeBgPrefs((prev) => ({ ...prev, mode: "blur" }));
            }}
            className="gap-2"
          >
            <span className="ml-5 flex-1">Flou</span>
            {bgPrefs.mode === "blur" && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              onChangeBgPrefs((prev) => ({ ...prev, mode: "image" }));
            }}
            className="gap-2"
          >
            <span className="ml-5 flex-1">Image</span>
            {bgPrefs.mode === "image" && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
          {bgPrefs.mode === "image" && (
            <div className="grid grid-cols-4 gap-1 p-2">
              {VIRTUAL_BG_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeBgPrefs((prev) => ({ ...prev, imageId: p.id }));
                  }}
                  aria-pressed={bgPrefs.imageId === p.id}
                  aria-label={p.label}
                  className={`aspect-video rounded-md border ${
                    bgPrefs.imageId === p.id
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border hover:border-primary/60"
                  }`}
                  style={{
                    background: p.url
                      ? `center/cover url(${p.url})`
                      : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                  }}
                />
              ))}
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onToggleTranscription} className="gap-2">
            <Captions className="h-4 w-4" />
            {transcriptionEnabled
              ? "Arrêter la transcription"
              : "Activer la transcription"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Separator */}
      <div className="w-px h-8 bg-border mx-1 md:mx-2" />

      {/* End call */}
      <Button
        onClick={onLeave}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full h-10 md:h-11 px-4 md:px-5 gap-2"
        aria-label="Quitter la réunion"
      >
        <PhoneOff className="h-4 w-4 md:h-5 md:w-5" />
        <span className="hidden sm:inline">Quitter</span>
      </Button>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Video grid
// ─────────────────────────────────────────────────────────────────────────────

function VideoGrid({ isMobile = false }: { isMobile?: boolean }) {
  const connectionState = useConnectionState();

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  if (connectionState === ConnectionState.Connecting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-background">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <span className="text-sm text-muted-foreground">
          Connexion au serveur...
        </span>
      </div>
    );
  }

  if (connectionState === ConnectionState.Disconnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-background p-6 text-center">
        <span className="text-base font-medium text-destructive">
          Impossible de se connecter au serveur
        </span>
        <span className="text-xs text-muted-foreground">
          Vérifie que LiveKit tourne sur {LIVEKIT_URL}
        </span>
      </div>
    );
  }

  // Determine grid columns based on participant count
  // Mobile (< md): capped at 1-2 cols, scrollable vertically for more tiles.
  // Desktop: 1 → 1 col, 2-4 → 2 cols, 5-9 → 3 cols, 10+ → 4 cols.
  const count = tracks.length;
  let colsClass = "grid-cols-1 place-items-center";
  if (count === 2) colsClass = "grid-cols-1 sm:grid-cols-2";
  else if (count >= 3 && count <= 4) colsClass = "grid-cols-1 sm:grid-cols-2";
  else if (count >= 5 && count <= 9) colsClass = "grid-cols-2 md:grid-cols-3";
  else if (count > 9) colsClass = "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  // On mobile with 2+ tiles, allow vertical scroll so tiles keep a readable aspect.
  const mobileScroll = isMobile && count >= 2 ? "overflow-y-auto" : "min-h-0";

  return (
    <div
      className={`flex-1 p-3 md:p-4 bg-background grid ${colsClass} auto-rows-fr gap-2 md:gap-3 ${mobileScroll}`}
    >
      {tracks.map((trackRef) => (
        <ParticipantTileCard key={tileKey(trackRef)} trackRef={trackRef} />
      ))}
    </div>
  );
}

function tileKey(t: TrackReferenceOrPlaceholder): string {
  const p = t.participant;
  if (isTrackReference(t)) {
    return `${p.identity}-${t.publication.trackSid}`;
  }
  return `${p.identity}-placeholder-${t.source}`;
}

function initials(name: string): string {
  const parts = (name || "?").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ParticipantTileCard({
  trackRef,
}: {
  trackRef: TrackReferenceOrPlaceholder;
}) {
  const participant = trackRef.participant;

  return (
    <ParticipantContext.Provider value={participant}>
      <TrackRefContext.Provider value={trackRef}>
        <ParticipantTileInner trackRef={trackRef} />
      </TrackRefContext.Provider>
    </ParticipantContext.Provider>
  );
}

function ParticipantTileInner({
  trackRef,
}: {
  trackRef: TrackReferenceOrPlaceholder;
}) {
  const participant = trackRef.participant;
  const isSpeaking = useIsSpeaking(participant);
  const { name, identity } = useParticipantInfo({ participant });
  const displayName = name || identity || "Anonyme";
  const isMuted = !participant.isMicrophoneEnabled;
  const hasVideo = isTrackReference(trackRef) && !trackRef.publication.isMuted;
  const { raisedSet } = useRaisedHandsContext();
  const handRaised = !!identity && raisedSet.has(identity);

  return (
    <div
      className={`relative bg-card border rounded-lg overflow-hidden aspect-video min-h-0 ${
        isSpeaking
          ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
          : "border-border"
      }`}
    >
      {hasVideo ? (
        <ParticipantTile
          trackRef={trackRef}
          disableSpeakingIndicator
          className="!bg-transparent h-full w-full"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
              {initials(displayName)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Raised hand overlay */}
      {handRaised && (
        <div
          data-testid="raised-hand-overlay"
          className="pointer-events-none absolute top-2 right-2 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-1 text-xs font-semibold text-primary-foreground shadow animate-pulse"
          aria-label={`${displayName} a levé la main`}
        >
          <Hand className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Main levée</span>
        </div>
      )}

      {/* Name + mute overlay */}
      <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-foreground">
        {isMuted && <MicOff className="h-3 w-3 text-destructive" />}
        <span className="truncate max-w-[180px]">{displayName}</span>
      </div>
    </div>
  );
}
