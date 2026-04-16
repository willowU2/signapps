"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Loader2,
  ShieldAlert,
  Sparkles,
  ArrowLeft,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { meetApi } from "@/lib/api/meet";
import { useAuthStore } from "@/lib/store";
import { usePageTitle } from "@/hooks/use-page-title";
import { useVirtualBackground } from "@/lib/video/use-virtual-background";
import type { BackgroundMode } from "@/lib/video/virtual-background";

/** sessionStorage key — lobby → in-meeting carries the chosen background. */
export const VIRTUAL_BG_STORAGE_KEY = "signapps.meet.virtualBg";

/** Presets exposed in the lobby + ⋯ menu. Empty = gradient fallback. */
export const VIRTUAL_BG_PRESETS: { id: string; label: string; url: string }[] =
  [
    { id: "gradient", label: "Dégradé", url: "" },
    { id: "office", label: "Bureau", url: "/meet-backgrounds/office.jpg" },
    { id: "library", label: "Bibliothèque", url: "/meet-backgrounds/library.jpg" },
    { id: "outdoor", label: "Extérieur", url: "/meet-backgrounds/outdoor.jpg" },
  ];

interface DeviceOption {
  deviceId: string;
  label: string;
}

export default function MeetLobbyPage() {
  usePageTitle("Pré-réunion");
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = decodeURIComponent(params.code);
  const { user } = useAuthStore();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [microphones, setMicrophones] = useState<DeviceOption[]>([]);
  const [speakers, setSpeakers] = useState<DeviceOption[]>([]);

  const [selectedCamera, setSelectedCamera] = useState<string | undefined>();
  const [selectedMic, setSelectedMic] = useState<string | undefined>();
  const [selectedSpeaker, setSelectedSpeaker] = useState<string | undefined>();

  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  // ── Virtual background state ──────────────────────────────────────
  // Persisted across lobby → in-meeting via sessionStorage.
  const [bgMode, setBgMode] = useState<BackgroundMode>("none");
  const [bgImageId, setBgImageId] = useState<string>(
    VIRTUAL_BG_PRESETS[0].id,
  );
  // Restore saved selection (if any) on mount.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(VIRTUAL_BG_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        mode?: BackgroundMode;
        imageId?: string;
      };
      if (saved.mode === "none" || saved.mode === "blur" || saved.mode === "image") {
        setBgMode(saved.mode);
      }
      if (saved.imageId) setBgImageId(saved.imageId);
    } catch {
      // Invalid or absent — keep defaults.
    }
  }, []);
  // Persist selection any time it changes.
  useEffect(() => {
    try {
      sessionStorage.setItem(
        VIRTUAL_BG_STORAGE_KEY,
        JSON.stringify({ mode: bgMode, imageId: bgImageId }),
      );
    } catch {
      // Quota / private-mode — ignore.
    }
  }, [bgMode, bgImageId]);
  const bgImageUrl = useMemo(() => {
    const preset = VIRTUAL_BG_PRESETS.find((p) => p.id === bgImageId);
    return preset?.url || undefined;
  }, [bgImageId]);

  // Raw camera stream (state so the virtual-bg hook can react to it).
  const [rawStream, setRawStream] = useState<MediaStream | null>(null);
  const degradeToastOnce = useRef(false);
  const virtualBgOpts = useMemo(
    () => ({
      mode: bgMode,
      imageUrl: bgImageUrl,
      onDegrade: (_from: BackgroundMode, to: BackgroundMode) => {
        if (degradeToastOnce.current) return;
        degradeToastOnce.current = true;
        if (to === "none") {
          toast.warning("Arrière-plan désactivé — trop lent");
        } else {
          toast.warning("Arrière-plan simplifié — performance insuffisante");
        }
        setBgMode(to);
      },
    }),
    [bgMode, bgImageUrl],
  );
  const processedStream = useVirtualBackground(rawStream, virtualBgOpts);

  // Whichever stream is available feeds the preview element.
  useEffect(() => {
    if (!videoRef.current) return;
    const out = processedStream ?? rawStream;
    videoRef.current.srcObject = out;
  }, [processedStream, rawStream]);

  const [displayName, setDisplayName] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [joining, setJoining] = useState(false);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [requiresKnock, setRequiresKnock] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [knockState, setKnockState] = useState<
    "idle" | "waiting" | "admitted" | "denied"
  >("idle");
  const [knockIdentity, setKnockIdentity] = useState<string | null>(null);

  // Pre-fill display name from auth store
  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || user.username || "");
    }
  }, [user]);

  // Load lobby info
  useEffect(() => {
    meetApi
      .getLobby(code)
      .then((res) => {
        setRoomName(res.data.room_name);
        setRequiresKnock(res.data.requires_knock === true);
      })
      .catch(() => setRoomName(null));
  }, [code]);

  // Detect whether the authenticated user is the host — list_rooms only
  // returns rooms they own. Gates the knock flow.
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

  // Poll knock status once we've knocked.
  useEffect(() => {
    if (knockState !== "waiting" || !knockIdentity) return;
    let active = true;
    const tick = () => {
      meetApi
        .getKnockStatus(code, knockIdentity)
        .then((res) => {
          if (!active) return;
          if (res.data.status === "admitted") {
            setKnockState("admitted");
          } else if (res.data.status === "denied") {
            setKnockState("denied");
          }
        })
        .catch(() => {
          // Keep polling; the server might be restarting.
        });
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [code, knockState, knockIdentity]);

  // Request media and enumerate devices
  const startStream = useCallback(
    async (cameraId?: string, micId?: string) => {
      // Stop previous tracks first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: cameraOn
            ? cameraId
              ? { deviceId: { exact: cameraId } }
              : true
            : false,
          audio: micId ? { deviceId: { exact: micId } } : true,
        };

        // getUserMedia requires at least one of video/audio true
        if (!constraints.video && !constraints.audio) {
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        setRawStream(stream);
        setPermissionError(null);

        // Apply mic enabled state
        stream.getAudioTracks().forEach((t) => {
          t.enabled = micOn;
        });

        // The preview element is fed by the effect that swaps between
        // the raw and processed streams — no direct assignment here.

        // Setup analyser for audio level meter
        if (stream.getAudioTracks().length > 0) {
          const AudioCtxCtor =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          const ctx = new AudioCtxCtor();
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          audioCtxRef.current = ctx;
          analyserRef.current = analyser;

          const buf = new Float32Array(analyser.fftSize);
          const tick = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getFloatTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i += 1) {
              sum += buf[i] * buf[i];
            }
            const rms = Math.sqrt(sum / buf.length);
            // Non-linear scaling for a more perceivable indicator
            const level = Math.min(1, rms * 3);
            setMicLevel(level);
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        }

        // After permission, enumerate devices to get labels
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameras(
          devices
            .filter((d) => d.kind === "videoinput")
            .map((d) => ({
              deviceId: d.deviceId,
              label: d.label || "Caméra",
            })),
        );
        setMicrophones(
          devices
            .filter((d) => d.kind === "audioinput")
            .map((d) => ({
              deviceId: d.deviceId,
              label: d.label || "Micro",
            })),
        );
        setSpeakers(
          devices
            .filter((d) => d.kind === "audiooutput")
            .map((d) => ({
              deviceId: d.deviceId,
              label: d.label || "Haut-parleur",
            })),
        );

        // Initialize selection from active tracks if not already set
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        if (videoTrack && !selectedCamera) {
          const s = videoTrack.getSettings();
          if (s.deviceId) setSelectedCamera(s.deviceId);
        }
        if (audioTrack && !selectedMic) {
          const s = audioTrack.getSettings();
          if (s.deviceId) setSelectedMic(s.deviceId);
        }
      } catch (err) {
        const e = err as { name?: string; message?: string };
        if (
          e.name === "NotAllowedError" ||
          e.name === "PermissionDeniedError"
        ) {
          setPermissionError(
            "Autorise l'accès caméra/micro dans ton navigateur pour rejoindre.",
          );
        } else if (e.name === "NotFoundError") {
          setPermissionError(
            "Aucune caméra ou micro détecté sur cet appareil.",
          );
        } else {
          setPermissionError(
            `Erreur d'accès aux périphériques : ${e.message ?? e.name ?? "inconnu"}`,
          );
        }
      }
    },
    [cameraOn, micOn, selectedCamera, selectedMic],
  );

  // Initial mount — ask permission & start stream
  useEffect(() => {
    startStream();
    return () => {
      // Cleanup
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => undefined);
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to device selection changes
  useEffect(() => {
    if (!selectedCamera && !selectedMic) return;
    startStream(selectedCamera, selectedMic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCamera, selectedMic]);

  // React to camera on/off
  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = cameraOn;
    });
    // If turning camera on after it was off at init, re-start the stream to get a new video track
    if (cameraOn && streamRef.current.getVideoTracks().length === 0) {
      startStream(selectedCamera, selectedMic);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn]);

  // React to mic on/off
  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = micOn;
    });
  }, [micOn]);

  const performJoin = useCallback(async () => {
    const res = await meetApi.joinByCode(code, displayName || undefined);
    try {
      sessionStorage.setItem(
        `meet:prefs:${code}`,
        JSON.stringify({
          cameraOn,
          micOn,
          selectedCamera,
          selectedMic,
          selectedSpeaker,
          displayName,
          token: res.data.token,
          livekitUrl: res.data.livekit_url,
          roomName: res.data.room_name,
        }),
      );
    } catch {
      // ignore storage errors
    }
    router.push(`/meet/${encodeURIComponent(code)}`);
  }, [
    code,
    cameraOn,
    micOn,
    selectedCamera,
    selectedMic,
    selectedSpeaker,
    displayName,
    router,
  ]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      // Host bypasses the knock flow — they are trusted joiners.
      if (requiresKnock && !isHost) {
        const res = await meetApi.knock(code, {
          display_name: displayName || "Invité",
        });
        setKnockIdentity(res.data.identity);
        setKnockState("waiting");
      } else {
        await performJoin();
      }
    } catch {
      toast.error(
        "Impossible de rejoindre la salle. Vérifie le code ou réessaie.",
      );
    } finally {
      setJoining(false);
    }
  };

  // When the host admits us we transition automatically.
  useEffect(() => {
    if (knockState === "admitted") {
      performJoin().catch(() => {
        toast.error("Impossible de rejoindre après admission.");
        setKnockState("idle");
      });
    } else if (knockState === "denied") {
      toast.error("L'hôte a refusé ta demande d'entrée.");
      const t = setTimeout(() => router.push("/meet"), 1500);
      return () => clearTimeout(t);
    }
  }, [knockState, performJoin, router]);

  const levelBars = useMemo(() => {
    const count = 12;
    const active = Math.round(micLevel * count);
    return Array.from({ length: count }, (_, i) => i < active);
  }, [micLevel]);

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-8 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/meet")}
            className="text-muted-foreground hover:text-foreground gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <div className="text-sm text-muted-foreground">
            {roomName ? `Salle : ${roomName}` : `Code : ${code}`}
          </div>
        </div>

        {/* 2-column layout — stack on mobile (< md), side-by-side on md+ */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Preview */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="relative w-full overflow-hidden rounded-lg border border-border bg-card">
              <div className="aspect-video w-full bg-muted">
                {cameraOn ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ transform: "scale(-1, 1)" }}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted-foreground/10 text-muted-foreground">
                      <UserRound className="h-12 w-12" />
                    </div>
                  </div>
                )}
              </div>

              {/* Overlay controls on preview */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className={`h-10 w-10 rounded-full ${
                    micOn
                      ? "bg-background/80 text-foreground backdrop-blur-sm"
                      : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  }`}
                  onClick={() => setMicOn((v) => !v)}
                  aria-label={micOn ? "Couper le micro" : "Activer le micro"}
                >
                  {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className={`h-10 w-10 rounded-full ${
                    cameraOn
                      ? "bg-background/80 text-foreground backdrop-blur-sm"
                      : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  }`}
                  onClick={() => setCameraOn((v) => !v)}
                  aria-label={cameraOn ? "Couper la caméra" : "Activer la caméra"}
                >
                  {cameraOn ? (
                    <Camera className="h-4 w-4" />
                  ) : (
                    <CameraOff className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Mic level meter */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
              <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex flex-1 items-center gap-1">
                {levelBars.map((active, i) => (
                  <div
                    key={i}
                    className={`h-3 flex-1 rounded-sm transition-colors ${
                      active ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground w-16 text-right">
                Niveau micro
              </span>
            </div>

            {/* Permission error banner */}
            {permissionError && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium">Accès refusé</div>
                  <div className="mt-1 text-destructive/80">
                    {permissionError}
                  </div>
                  <a
                    href="https://support.google.com/chrome/answer/2693767"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs underline hover:no-underline"
                  >
                    Instructions (Chrome, Firefox, Safari, Edge)
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Settings panel */}
          <aside className="w-full md:w-[340px] lg:w-[360px] shrink-0">
            <div className="flex flex-col gap-5 rounded-lg border border-border bg-card p-4 md:p-6">
              {/* Device pickers */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Caméra
                </Label>
                <Select
                  value={selectedCamera}
                  onValueChange={setSelectedCamera}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Sélectionner une caméra" />
                  </SelectTrigger>
                  <SelectContent>
                    {cameras.map((d) => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </SelectItem>
                    ))}
                    {cameras.length === 0 && (
                      <SelectItem value="__none" disabled>
                        Aucune caméra détectée
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Micro
                </Label>
                <Select value={selectedMic} onValueChange={setSelectedMic}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Sélectionner un micro" />
                  </SelectTrigger>
                  <SelectContent>
                    {microphones.map((d) => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </SelectItem>
                    ))}
                    {microphones.length === 0 && (
                      <SelectItem value="__none" disabled>
                        Aucun micro détecté
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Haut-parleur
                </Label>
                <Select
                  value={selectedSpeaker}
                  onValueChange={setSelectedSpeaker}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Sélectionner un haut-parleur" />
                  </SelectTrigger>
                  <SelectContent>
                    {speakers.map((d) => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </SelectItem>
                    ))}
                    {speakers.length === 0 && (
                      <SelectItem value="__none" disabled>
                        Haut-parleur par défaut
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="camera-toggle"
                    className="text-sm text-foreground"
                  >
                    Caméra
                  </Label>
                  <Switch
                    id="camera-toggle"
                    checked={cameraOn}
                    onCheckedChange={setCameraOn}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="mic-toggle"
                    className="text-sm text-foreground"
                  >
                    Micro
                  </Label>
                  <Switch
                    id="mic-toggle"
                    checked={micOn}
                    onCheckedChange={setMicOn}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="bg-mode"
                    className="text-sm text-foreground flex items-center gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Arrière-plan
                  </Label>
                  <Select
                    value={bgMode}
                    onValueChange={(v) => {
                      degradeToastOnce.current = false;
                      setBgMode(v as BackgroundMode);
                    }}
                  >
                    <SelectTrigger id="bg-mode" className="w-32 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      <SelectItem value="blur">Flou</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {bgMode === "image" && (
                  <div
                    className="grid grid-cols-4 gap-2"
                    aria-label="Sélection de l'arrière-plan"
                  >
                    {VIRTUAL_BG_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setBgImageId(p.id)}
                        aria-pressed={bgImageId === p.id}
                        aria-label={p.label}
                        className={`relative aspect-video overflow-hidden rounded-md border transition-colors ${
                          bgImageId === p.id
                            ? "border-primary ring-2 ring-primary/40"
                            : "border-border hover:border-primary/60"
                        }`}
                        style={{
                          backgroundImage: p.url ? `url(${p.url})` : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          backgroundColor: p.url
                            ? undefined
                            : "linear-gradient(135deg, #0f172a, #1e293b)",
                          background: p.url
                            ? `center/cover url(${p.url})`
                            : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                        }}
                      >
                        <span className="sr-only">{p.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Display name */}
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <Label
                  htmlFor="display-name"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Nom affiché
                </Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ton nom"
                  className="bg-background"
                />
              </div>

              {/* Join button */}
              <Button
                onClick={handleJoin}
                disabled={joining || knockState === "waiting"}
                className="h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              >
                {joining || knockState === "waiting" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : null}
                {knockState === "waiting"
                  ? "En attente de l'hôte..."
                  : joining
                    ? "Connexion..."
                    : requiresKnock && !isHost
                      ? "Demander l'accès"
                      : "Rejoindre maintenant"}
              </Button>
              {knockState === "waiting" && (
                <p className="text-xs text-muted-foreground text-center">
                  L&apos;hôte reçoit ta demande. Patiente — tu entreras
                  automatiquement dès qu&apos;elle est acceptée.
                </p>
              )}
              {knockState === "denied" && (
                <p className="text-xs text-destructive text-center">
                  L&apos;hôte a refusé ta demande. Redirection...
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
