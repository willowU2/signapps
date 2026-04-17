"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, X } from "lucide-react";
import { storageApi } from "@/lib/api";
import type { FileItem } from "./types";

interface InlineAudioPlayerProps {
  file: FileItem;
  bucket: string;
  currentPath: string[];
  onClose: () => void;
}

export function InlineAudioPlayer({
  file,
  bucket,
  currentPath,
  onClose,
}: InlineAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let url: string | null = null;
    (async () => {
      try {
        const key =
          currentPath.length > 0
            ? `${currentPath.join("/")}/${file.name}`
            : file.name;
        const res = await storageApi.download(bucket, key);
        const blob = new Blob([res.data], {
          type: file.contentType || "audio/mpeg",
        });
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch {
        /* silent */
      }
    })();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, bucket, currentPath]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted/80 backdrop-blur border rounded-lg text-sm">
      {blobUrl && (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- Captions not available
        <audio
          ref={audioRef}
          src={blobUrl}
          onTimeUpdate={() => setProgress(audioRef.current?.currentTime ?? 0)}
          onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)}
          onEnded={() => setPlaying(false)}
        />
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={togglePlay}
        disabled={!blobUrl}
        aria-label="Pause"
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </Button>

      <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="truncate text-xs font-medium">{file.name}</span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={progress}
          onChange={(e) => {
            if (!audioRef.current) return;
            audioRef.current.currentTime = Number(e.target.value);
            setProgress(Number(e.target.value));
          }}
          className="flex-1 h-1 accent-primary"
        />
        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
          {fmt(progress)} / {duration ? fmt(duration) : "--:--"}
        </span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onClose}
        aria-label="Fermer"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
