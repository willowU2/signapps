"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Play, Pause, Trash2, FileAudio } from "lucide-react";
import { toast } from "sonner";

interface VoiceNote {
  id: string;
  transcript: string;
  duration: number;
  createdAt: Date;
  playing: boolean;
  blob?: Blob;
}

export function VoiceNotes() {
  const [recording, setRecording] = useState(false);
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentTranscriptRef = useRef("");

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      currentTranscriptRef.current = "";
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        setNotes((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            transcript: currentTranscriptRef.current || "(no transcript)",
            duration: duration,
            createdAt: new Date(),
            playing: false,
            blob,
          },
        ]);
        if (timerRef.current) clearInterval(timerRef.current);
        setDuration(0);
      };
      mr.start(100);
      mediaRecorderRef.current = mr;

      // Speech recognition for transcription
      const SpeechRec =
        window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (SpeechRec) {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = "fr-FR";
        rec.onresult = (e: any) => {
          currentTranscriptRef.current +=
            " " + e.results[e.results.length - 1][0].transcript;
        };
        rec.start();
        recognitionRef.current = rec;
      }

      setRecording(true);
      let secs = 0;
      timerRef.current = setInterval(() => {
        secs++;
        setDuration(secs);
      }, 1000);
    } catch (e) {
      toast.error("Microphone access denied");
    }
  }, [duration]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  const playNote = (note: VoiceNote) => {
    if (!note.blob) return;
    const url = URL.createObjectURL(note.blob);
    const audio = new Audio(url);
    setNotes((prev) => prev.map((n) => ({ ...n, playing: n.id === note.id })));
    audio.play();
    audio.onended = () => {
      setNotes((prev) => prev.map((n) => ({ ...n, playing: false })));
      URL.revokeObjectURL(url);
    };
  };

  const remove = (id: string) =>
    setNotes((prev) => prev.filter((n) => n.id !== id));

  const fmt = (secs: number) =>
    `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileAudio className="h-5 w-5 text-primary" />
          Voice Notes + Transcription
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant={recording ? "destructive" : "default"}
            onClick={recording ? stopRecording : startRecording}
            className="gap-2"
          >
            {recording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
            {recording ? "Stop" : "Record Note"}
          </Button>
          {recording && (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-mono text-red-500">
                {fmt(duration)}
              </span>
            </div>
          )}
        </div>

        <ScrollArea className="h-72">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No voice notes yet. Record one to get started.
            </p>
          ) : (
            <div className="space-y-2 pr-2">
              {notes.map((note) => (
                <div key={note.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => playNote(note)}
                        disabled={!note.blob}
                      >
                        {note.playing ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <span className="text-xs text-muted-foreground font-mono">
                        {fmt(note.duration)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {note.createdAt.toLocaleString()}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => remove(note.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    {note.transcript}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
