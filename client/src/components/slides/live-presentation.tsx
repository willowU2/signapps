"use client";

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Timer,
  MonitorPlay,
  QrCode,
  Copy,
  Check,
  ThumbsUp,
  Heart,
  HelpCircle,
  Pointer,
} from "lucide-react";
import {
  type SlideTransition,
  type SlideTransitionType,
  getSlideTransitionVariants,
} from "./slide-animations";

// --- Reactions ---
export type ReactionType = "thumbsUp" | "clap" | "heart" | "question";

export const REACTION_ICONS: Record<
  ReactionType,
  { emoji: string; label: string }
> = {
  thumbsUp: { emoji: "👍", label: "J'aime" },
  clap: { emoji: "👏", label: "Bravo" },
  heart: { emoji: "❤️", label: "Coeur" },
  question: { emoji: "❓", label: "Question" },
};

// --- BroadcastChannel Sync ---
const CHANNEL_NAME = "signapps-live-presentation";

export interface LiveSyncMessage {
  type: "slide-change" | "reaction" | "laser" | "end-presentation";
  slideIndex?: number;
  reaction?: ReactionType;
  laserPosition?: { x: number; y: number };
  presentationId?: string;
}

function createSyncChannel() {
  if (typeof window === "undefined") return null;
  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
}

// --- Timer Hook ---
function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const formatted = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  return {
    seconds,
    formatted,
    isRunning,
    toggle: () => setIsRunning((r) => !r),
    reset: () => setSeconds(0),
  };
}

// --- Presenter View ---

interface LivePresenterViewProps {
  slides: ReactNode[];
  slideNotes: string[];
  transitions: SlideTransition[];
  onExit: () => void;
  presentationId: string;
}

export function LivePresenterView({
  slides,
  slideNotes,
  transitions,
  onExit,
  presentationId,
}: LivePresenterViewProps) {
  const [current, setCurrent] = useState(0);
  const [reactions, setReactions] = useState<Record<ReactionType, number>>({
    thumbsUp: 0,
    clap: 0,
    heart: 0,
    question: 0,
  });
  const [laserActive, setLaserActive] = useState(false);
  const [laserPos, setLaserPos] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const timer = useTimer();

  // Setup BroadcastChannel
  useEffect(() => {
    channelRef.current = createSyncChannel();
    const channel = channelRef.current;

    if (channel) {
      channel.onmessage = (event: MessageEvent<LiveSyncMessage>) => {
        const msg = event.data;
        if (msg.presentationId !== presentationId) return;

        if (msg.type === "reaction" && msg.reaction) {
          setReactions((prev) => ({
            ...prev,
            [msg.reaction!]: prev[msg.reaction!] + 1,
          }));
        }
      };
    }

    return () => {
      channel?.close();
    };
  }, [presentationId]);

  // Broadcast slide changes
  useEffect(() => {
    channelRef.current?.postMessage({
      type: "slide-change",
      slideIndex: current,
      presentationId,
    } as LiveSyncMessage);
  }, [current, presentationId]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onExit();
      if (e.key === "ArrowRight" || e.key === " ")
        setCurrent((c) => Math.min(c + 1, slides.length - 1));
      if (e.key === "ArrowLeft") setCurrent((c) => Math.max(c - 1, 0));
      if (e.key === "Home") setCurrent(0);
      if (e.key === "End") setCurrent(slides.length - 1);
      if (e.key === "l" || e.key === "L") setLaserActive((a) => !a);
    }
    document.addEventListener("keydown", handleKey);
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (document.fullscreenElement)
        document.exitFullscreen?.().catch(() => {});
    };
  }, [slides.length, onExit]);

  const handleEnd = () => {
    channelRef.current?.postMessage({
      type: "end-presentation",
      presentationId,
    } as LiveSyncMessage);
    onExit();
  };

  // Laser pointer
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!laserActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setLaserPos({ x, y });
    channelRef.current?.postMessage({
      type: "laser",
      laserPosition: { x, y },
      presentationId,
    } as LiveSyncMessage);
  };

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/slides/live?id=${presentationId}`
      : "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const transition = transitions[current] || {
    type: "none" as SlideTransitionType,
    duration: 500,
  };
  const variants = getSlideTransitionVariants(transition.type);

  const nextSlideIndex = Math.min(current + 1, slides.length - 1);

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-900 flex flex-col">
      {/* Top bar with share info */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 text-white shrink-0">
        <div className="flex items-center gap-3">
          <MonitorPlay className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium">Mode Presentateur</span>
          <Badge variant="secondary" className="text-xs">
            {current + 1} / {slides.length}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {/* Timer */}
          <button
            onClick={timer.toggle}
            className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
          >
            <Timer className="w-4 h-4" />
            {timer.formatted}
          </button>

          {/* Share Link */}
          <div className="flex items-center gap-1.5 bg-gray-700 rounded px-2 py-1">
            <QrCode className="w-3 h-3 text-white/60" />
            <span className="text-xs text-white/60 max-w-[180px] truncate">
              {shareUrl}
            </span>
            <button
              onClick={handleCopyLink}
              className="text-white/60 hover:text-white"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Laser toggle */}
          <button
            onClick={() => setLaserActive((a) => !a)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
              laserActive
                ? "bg-red-500/30 text-red-400"
                : "bg-gray-700 text-white/60 hover:text-white",
            )}
          >
            <Pointer className="w-3 h-3" />
            Laser
          </button>

          {/* Reactions Display */}
          <div className="flex items-center gap-2 text-sm">
            {(Object.keys(REACTION_ICONS) as ReactionType[]).map((key) => (
              <span
                key={key}
                className="flex items-center gap-0.5"
                title={REACTION_ICONS[key].label}
              >
                <span>{REACTION_ICONS[key].emoji}</span>
                <span className="text-xs text-white/50">{reactions[key]}</span>
              </span>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleEnd}
            className="text-white/60 hover:text-white h-7"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main content: slide + notes */}
      <div className="flex-1 flex min-h-0">
        {/* Current slide (large) */}
        <div
          className="flex-1 flex items-center justify-center p-6 relative overflow-hidden"
          onMouseMove={handleMouseMove}
          style={{ cursor: laserActive ? "none" : "default" }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{
                duration: transition.duration / 1000,
                ease: "easeInOut",
              }}
              className="w-full h-full flex items-center justify-center"
            >
              {slides[current]}
            </motion.div>
          </AnimatePresence>

          {/* Laser dot */}
          {laserActive && (
            <div
              className="absolute w-3 h-3 bg-red-500 rounded-full pointer-events-none shadow-[0_0_12px_4px_rgba(239,68,68,0.6)]"
              style={{
                left: `${laserPos.x}%`,
                top: `${laserPos.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          )}
        </div>

        {/* Side panel: notes + next slide */}
        <div className="w-80 bg-gray-800 flex flex-col border-l border-gray-700 shrink-0">
          {/* Next slide preview */}
          <div className="p-3 border-b border-gray-700">
            <span className="text-xs text-white/50 font-medium mb-2 block">
              Diapositive suivante
            </span>
            <div className="aspect-[16/10] bg-gray-900 rounded overflow-hidden flex items-center justify-center">
              {current < slides.length - 1 ? (
                <div className="w-full h-full transform scale-50 origin-center pointer-events-none">
                  {slides[nextSlideIndex]}
                </div>
              ) : (
                <span className="text-xs text-white/30">
                  Fin de la presentation
                </span>
              )}
            </div>
          </div>

          {/* Speaker notes */}
          <div className="flex-1 p-3 overflow-auto">
            <span className="text-xs text-white/50 font-medium mb-2 block">
              Notes
            </span>
            <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
              {slideNotes[current] || "Aucune note pour cette diapositive."}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between p-3 border-t border-gray-700">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrent((c) => Math.max(c - 1, 0))}
              disabled={current === 0}
              className="text-white/60 hover:text-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <span className="text-sm text-white/50 font-medium">
              {current + 1} / {slides.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setCurrent((c) => Math.min(c + 1, slides.length - 1))
              }
              disabled={current === slides.length - 1}
              className="text-white/60 hover:text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Audience View ---

interface LiveAudienceViewProps {
  slides: ReactNode[];
  transitions: SlideTransition[];
  presentationId: string;
  onEnd?: () => void;
}

export function LiveAudienceView({
  slides,
  transitions,
  presentationId,
  onEnd,
}: LiveAudienceViewProps) {
  const [current, setCurrent] = useState(0);
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [ended, setEnded] = useState(false);
  const [myReactions, setMyReactions] = useState<Record<ReactionType, number>>({
    thumbsUp: 0,
    clap: 0,
    heart: 0,
    question: 0,
  });
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    channelRef.current = createSyncChannel();
    const channel = channelRef.current;

    if (channel) {
      channel.onmessage = (event: MessageEvent<LiveSyncMessage>) => {
        const msg = event.data;
        if (msg.presentationId !== presentationId) return;

        if (msg.type === "slide-change" && msg.slideIndex !== undefined) {
          setCurrent(msg.slideIndex);
        }
        if (msg.type === "laser" && msg.laserPosition) {
          setLaserPos(msg.laserPosition);
        }
        if (msg.type === "end-presentation") {
          setEnded(true);
          onEnd?.();
        }
      };
    }

    return () => {
      channel?.close();
    };
  }, [presentationId, onEnd]);

  // Clear laser after inactivity
  useEffect(() => {
    if (!laserPos) return;
    const timeout = setTimeout(() => setLaserPos(null), 3000);
    return () => clearTimeout(timeout);
  }, [laserPos]);

  const sendReaction = (type: ReactionType) => {
    setMyReactions((prev) => ({ ...prev, [type]: prev[type] + 1 }));
    channelRef.current?.postMessage({
      type: "reaction",
      reaction: type,
      presentationId,
    } as LiveSyncMessage);
  };

  if (ended) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">
            Presentation terminee
          </h2>
          <p className="text-white/60">Merci d'avoir participe !</p>
          <Button onClick={onEnd} variant="secondary">
            Fermer
          </Button>
        </div>
      </div>
    );
  }

  const transition = transitions[current] || {
    type: "none" as SlideTransitionType,
    duration: 500,
  };
  const variants = getSlideTransitionVariants(transition.type);

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* Slide */}
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{
              duration: transition.duration / 1000,
              ease: "easeInOut",
            }}
            className="w-full h-full flex items-center justify-center"
          >
            {slides[current]}
          </motion.div>
        </AnimatePresence>

        {/* Laser dot from presenter */}
        {laserPos && (
          <div
            className="absolute w-3 h-3 bg-red-500 rounded-full pointer-events-none shadow-[0_0_12px_4px_rgba(239,68,68,0.6)] transition-all duration-75"
            style={{
              left: `${laserPos.x}%`,
              top: `${laserPos.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </div>

      {/* Bottom bar with reactions */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 shrink-0">
        <div className="flex items-center gap-2 text-white/50 text-sm">
          <MonitorPlay className="w-4 h-4" />
          <span>
            {current + 1} / {slides.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {(Object.keys(REACTION_ICONS) as ReactionType[]).map((key) => (
            <button
              key={key}
              onClick={() => sendReaction(key)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-card/10 hover:bg-card/20 transition-colors text-lg"
              title={REACTION_ICONS[key].label}
            >
              <span>{REACTION_ICONS[key].emoji}</span>
              {myReactions[key] > 0 && (
                <span className="text-xs text-white/60">
                  {myReactions[key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Generate Presentation ID ---
export function generatePresentationId(): string {
  return `pres-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
}
