"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

export function LiveTranscription() {
  const [meetingName, setMeetingName] = useState("Team Standup - 2026-03-22");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([
    {
      id: "1",
      speaker: "Sarah Johnson",
      text: "Good morning everyone. Let me start with the project updates.",
      timestamp: "00:00:15",
    },
    {
      id: "2",
      speaker: "Mike Chen",
      text: "We completed the API integration yesterday.",
      timestamp: "00:00:45",
    },
    {
      id: "3",
      speaker: "Sarah Johnson",
      text: "Great work team. What about the database migrations?",
      timestamp: "00:01:20",
    },
  ]);
  const [isLive, setIsLive] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLive && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcript, isLive]);

  const handleAddTranscriptLine = () => {
    const newLine: TranscriptLine = {
      id: Date.now().toString(),
      speaker: "John Doe",
      text: "New transcribed text from live meeting...",
      timestamp: `00:0${Math.floor(Math.random() * 10)}:${Math.floor(
        Math.random() * 60,
      )
        .toString()
        .padStart(2, "0")}`,
    };
    setTranscript((prev) => [...prev, newLine]);
  };

  const handleExport = () => {
    const content = `Meeting: ${meetingName}\n\n${transcript
      .map((line) => `[${line.timestamp}] ${line.speaker}: ${line.text}`)
      .join("\n")}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcription-${meetingName.replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-card border border-input rounded-lg shadow-sm space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">
          Live Transcription
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={meetingName}
            onChange={(e) => setMeetingName(e.target.value)}
            className={cn(
              "flex-1 px-3 py-2 border border-input rounded-md bg-background text-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary text-sm",
            )}
            placeholder="Meeting name"
            aria-label="Meeting name"
          />
          <div className="flex items-center gap-1">
            <Circle
              className={cn(
                "h-3 w-3 animate-pulse",
                isLive
                  ? "fill-red-500 text-red-500"
                  : "fill-gray-400 text-gray-400",
              )}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {isLive ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      {/* Transcript Container */}
      <div className="max-h-96 overflow-y-auto bg-muted/30 border border-input rounded-md p-4 space-y-3">
        {transcript.map((line) => (
          <div key={line.id} className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                {line.timestamp}
              </span>
              <span className="font-semibold text-sm text-foreground">
                {line.speaker}
              </span>
            </div>
            <p className="text-sm text-foreground ml-16">{line.text}</p>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleAddTranscriptLine}
          variant="outline"
          size="sm"
          aria-label="Add transcript line"
        >
          Add Line
        </Button>
        <Button
          onClick={handleExport}
          variant="outline"
          size="sm"
          aria-label="Export transcription"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>
    </div>
  );
}
