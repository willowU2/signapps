"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Plus,
  Trash2,
  Rss,
  ChevronDown,
} from "lucide-react";

interface Episode {
  title: string;
  url: string;
  duration?: string;
  pub?: string;
}

interface Feed {
  id: string;
  name: string;
  url: string;
  episodes: Episode[];
}

export function PodcastPlayer() {
  const [feeds, setFeeds] = useState<Feed[]>([
    {
      id: "1",
      name: "Tech Podcast Demo",
      url: "https://example.com/rss",
      episodes: [
        {
          title: "Episode 1: Introduction to SignApps",
          url: "",
          duration: "28:42",
          pub: "2025-03-20",
        },
        {
          title: "Episode 2: Architecture Overview",
          url: "",
          duration: "35:18",
          pub: "2025-03-27",
        },
      ],
    },
  ]);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(80);
  const [expanded, setExpanded] = useState<string | null>("1");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    audio.volume = volume / 100;
    const updateProgress = () => {
      if (audio.duration)
        setProgress((audio.currentTime / audio.duration) * 100);
    };
    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("ended", () => setPlaying(false));
    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
    };
  }, [volume]);

  const playEpisode = (ep: Episode) => {
    if (!audioRef.current) return;
    setCurrentEpisode(ep);
    if (ep.url) {
      audioRef.current.src = ep.url;
      audioRef.current.play().catch(() => {});
      setPlaying(true);
    } else {
      setPlaying(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentEpisode?.url) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setPlaying(!playing);
  };

  const addFeed = () => {
    if (!newName) return;
    setFeeds((prev) => [
      ...prev,
      { id: Date.now().toString(), name: newName, url: newUrl, episodes: [] },
    ]);
    setNewName("");
    setNewUrl("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Rss className="h-5 w-5 text-primary" />
          Podcast Player
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current player */}
        {currentEpisode && (
          <div className="p-4 bg-muted/50 rounded-xl space-y-3">
            <div>
              <p className="text-sm font-semibold truncate">
                {currentEpisode.title}
              </p>
              {!currentEpisode.url && (
                <p className="text-xs text-muted-foreground">
                  No audio URL — demo mode
                </p>
              )}
            </div>
            <Slider
              value={[progress]}
              min={0}
              max={100}
              step={0.1}
              onValueChange={([v]) => {
                if (audioRef.current?.duration) {
                  audioRef.current.currentTime =
                    (v / 100) * audioRef.current.duration;
                }
                setProgress(v);
              }}
              className="cursor-pointer"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={togglePlay}
                  aria-label="Pause"
                >
                  {playing ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 w-28">
                <Volume2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Slider
                  value={[volume]}
                  min={0}
                  max={100}
                  onValueChange={([v]) => {
                    setVolume(v);
                    if (audioRef.current) audioRef.current.volume = v / 100;
                  }}
                  className="cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* Feed list */}
        <ScrollArea className="h-64">
          {feeds.map((feed) => (
            <div
              key={feed.id}
              className="mb-2 border rounded-lg overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                onClick={() =>
                  setExpanded(expanded === feed.id ? null : feed.id)
                }
              >
                <div className="flex items-center gap-2">
                  <Rss className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">{feed.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {feed.episodes.length}
                  </Badge>
                </div>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${expanded === feed.id ? "rotate-180" : ""}`}
                />
              </button>
              {expanded === feed.id && (
                <div className="border-t">
                  {feed.episodes.map((ep, i) => (
                    <button
                      key={i}
                      onClick={() => playEpisode(ep)}
                      className={`w-full flex items-center justify-between p-2.5 hover:bg-muted/30 text-left text-sm transition-colors ${
                        currentEpisode?.title === ep.title ? "bg-primary/5" : ""
                      }`}
                    >
                      <span className="truncate flex-1">{ep.title}</span>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {ep.duration && (
                          <span className="text-xs text-muted-foreground">
                            {ep.duration}
                          </span>
                        )}
                        {currentEpisode?.title === ep.title && playing && (
                          <div className="flex gap-0.5">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="w-0.5 h-3 bg-primary animate-pulse rounded"
                                style={{ animationDelay: `${i * 100}ms` }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </ScrollArea>

        {/* Add feed */}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" />
            Add RSS Feed
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Podcast name"
              className="h-8 text-xs"
            />
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="RSS URL"
              className="h-8 text-xs"
            />
            <Button size="sm" className="col-span-2" onClick={addFeed}>
              Subscribe
            </Button>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
