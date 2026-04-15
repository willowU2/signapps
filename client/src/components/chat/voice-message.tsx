"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, Trash2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VoiceMessageRecorderProps {
  onSend: (blob: Blob, durationSec: number) => void;
  onCancel: () => void;
}

/**
 * IDEA-135: Voice messages — record audio blob + playback before sending.
 */
export function VoiceMessageRecorder({
  onSend,
  onCancel,
}: VoiceMessageRecorderProps) {
  const [state, setState] = useState<"idle" | "recording" | "preview">("idle");
  const [durationSec, setDurationSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        blobRef.current = blob;
        audioRef.current = new Audio(URL.createObjectURL(blob));
        audioRef.current.onended = () => setIsPlaying(false);
        setState("preview");
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setState("recording");
      setDurationSec(0);
      timerRef.current = setInterval(() => setDurationSec((d) => d + 1), 1000);
    } catch {
      // Microphone permission denied or not available
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSend = () => {
    if (blobRef.current) onSend(blobRef.current, durationSec);
  };

  const handleDiscard = () => {
    audioRef.current?.pause();
    blobRef.current = null;
    audioRef.current = null;
    setState("idle");
    setDurationSec(0);
    onCancel();
  };

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2">
        {state === "idle" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={startRecording}
              >
                <Mic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Record voice message</TooltipContent>
          </Tooltip>
        )}

        {state === "recording" && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-destructive/10 border border-destructive/20">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-xs font-mono text-destructive">
              {fmtTime(durationSec)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:bg-destructive/10"
              onClick={stopRecording}
            >
              <Square className="h-3 w-3 fill-current" />
            </Button>
          </div>
        )}

        {state === "preview" && (
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-muted/50 border">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-primary"
              onClick={togglePlay}
            >
              {isPlaying ? (
                <Pause className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
            </Button>
            <div className="w-24 h-1.5 rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full bg-primary transition-all",
                  isPlaying ? "w-full" : "w-0",
                )}
                style={{
                  transition: isPlaying
                    ? `width ${durationSec}s linear`
                    : "none",
                }}
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {fmtTime(durationSec)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:bg-destructive/10"
              onClick={handleDiscard}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-primary hover:bg-primary/10"
              onClick={handleSend}
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Inline audio player for received voice messages
// ---------------------------------------------------------------------------

interface VoiceMessagePlayerProps {
  src: string;
  durationSec?: number;
}

export function VoiceMessagePlayer({
  src,
  durationSec = 0,
}: VoiceMessagePlayerProps) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border w-52 mt-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-primary shrink-0"
        onClick={toggle}
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>
      <div className="flex-1 h-1.5 rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full bg-primary",
            playing ? "w-full" : "w-0",
          )}
          style={{
            transition: playing ? `width ${durationSec}s linear` : "none",
          }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground shrink-0">
        {fmtTime(durationSec)}
      </span>
    </div>
  );
}
