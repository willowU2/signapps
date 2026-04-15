"use client";

import { LIVEKIT_URL } from "@/lib/api/core";

import { useState } from "react";
import {
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  useLocalParticipant,
  useConnectionState,
  useParticipants,
  useIsSpeaking,
  useParticipantInfo,
  ParticipantContext,
  TrackRefContext,
  isTrackReference,
} from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import "@livekit/components-styles";
import { Track, ConnectionState } from "livekit-client";
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
} from "lucide-react";

import { MeetSidebar } from "./meet-sidebar";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

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
    // Mobile: open Sheet. Desktop: toggle fixed panel.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setMobileSheetOpen(true);
    } else {
      setSidebarOpen((v) => !v);
    }
  };

  return (
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
          <h1 className="text-sm font-semibold text-foreground truncate max-w-[40vw] hidden xs:block sm:block">
            {roomName}
          </h1>
          <Badge
            variant="outline"
            className="border-border text-foreground gap-1"
          >
            <Circle className="h-2 w-2 fill-primary text-primary" />
            {participantCount}
          </Badge>
        </div>
        {/* Right */}
        <div className="flex items-center gap-1">
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
        <main className="flex-1 min-w-0 flex flex-col">
          <VideoGrid />
        </main>

        {/* Desktop sidebar (fixed) */}
        {sidebarOpen && (
          <div className="hidden md:flex">
            <MeetSidebar onClose={() => setSidebarOpen(false)} />
          </div>
        )}

        {/* Mobile sidebar (Sheet) */}
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetContent
            side="bottom"
            className="h-[80vh] p-0 bg-card border-border"
          >
            <div className="h-full">
              <MeetSidebar onClose={() => setMobileSheetOpen(false)} />
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
      />
    </div>
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
}: BottomBarProps) {
  const [raised, setRaised] = useState(false);

  const round =
    "rounded-full h-10 w-10 md:h-11 md:w-11 transition-colors";

  return (
    <footer className="h-14 md:h-16 px-2 md:px-4 flex items-center justify-center gap-1.5 md:gap-2 bg-card border-t border-border shrink-0">
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
        aria-label={isMicrophoneEnabled ? "Couper le micro" : "Activer le micro"}
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
        onClick={() => setRaised((v) => !v)}
        className={`${round} ${
          raised
            ? "bg-primary/15 text-primary hover:bg-primary/20"
            : "bg-muted text-foreground hover:bg-muted/80"
        }`}
        aria-label="Lever la main"
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
          <DropdownMenuItem className="gap-2">
            <Sparkles className="h-4 w-4" />
            Flou arrière-plan
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2">
            <Radio className="h-4 w-4" />
            Enregistrer
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2">
            <Captions className="h-4 w-4" />
            Transcription
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

function VideoGrid() {
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
  // 1 → 1 col, 2 → 2 cols, 3-4 → 2 cols, 5-9 → 3 cols, 10+ → 4 cols
  const count = tracks.length;
  let colsClass = "grid-cols-1 place-items-center";
  if (count === 2) colsClass = "grid-cols-1 sm:grid-cols-2";
  else if (count >= 3 && count <= 4)
    colsClass = "grid-cols-1 sm:grid-cols-2";
  else if (count >= 5 && count <= 9)
    colsClass = "grid-cols-2 md:grid-cols-3";
  else if (count > 9)
    colsClass = "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <div
      className={`flex-1 p-3 md:p-4 bg-background grid ${colsClass} auto-rows-fr gap-2 md:gap-3 min-h-0`}
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

      {/* Name + mute overlay */}
      <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-foreground">
        {isMuted && <MicOff className="h-3 w-3 text-destructive" />}
        <span className="truncate max-w-[180px]">{displayName}</span>
      </div>
    </div>
  );
}
