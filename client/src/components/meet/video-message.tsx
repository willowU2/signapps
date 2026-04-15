"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  Play,
  Trash2,
  Loader2,
  Clock,
  Send,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

const meetClient = getClient(ServiceName.MEET);

interface VideoMessage {
  id: string;
  sender: string;
  date: string;
  duration: number; // seconds
  thumbnailUrl?: string;
  videoUrl?: string;
  isNew: boolean;
}

export function VideoMessage() {
  const [messages, setMessages] = useState<VideoMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load messages — API first, localStorage fallback
  useEffect(() => {
    const load = async () => {
      try {
        const res = await meetClient.get<any[]>("/meet/video-messages");
        const loaded: VideoMessage[] = (res.data ?? []).map((m: any) => ({
          id: m.id ?? crypto.randomUUID(),
          sender: m.sender_name ?? m.sender ?? "Unknown",
          date: m.sent_at ?? m.created_at ?? new Date().toISOString(),
          duration: m.duration_seconds ?? m.duration ?? 0,
          thumbnailUrl: m.thumbnail_url ?? undefined,
          videoUrl: m.video_url ?? undefined,
          isNew: m.is_new ?? m.unread ?? false,
        }));
        setMessages(loaded);
        try {
          const toStore = loaded.map((m) => ({
            ...m,
            videoUrl: undefined,
            thumbnailUrl: undefined,
          }));
          localStorage.setItem(
            "signapps_video_messages",
            JSON.stringify(toStore),
          );
        } catch {
          /* quota */
        }
      } catch {
        try {
          const raw = localStorage.getItem("signapps_video_messages");
          setMessages(raw ? JSON.parse(raw) : []);
        } catch {
          setMessages([]);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsRecording(true);
        setRecordingTime(0);
        timerIntervalRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      };

      mediaRecorder.start();
      toast.success("Enregistrement vidéo démarré");
    } catch (error) {
      const err = error as Error;
      toast.error(`Erreur webcam: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      toast.success("Enregistrement arrêté");
    }
  };

  const sendVideoMessage = () => {
    if (chunksRef.current.length === 0 || recordingTime === 0) {
      toast.error("Aucun enregistrement disponible");
      return;
    }

    const videoBlob = new Blob(chunksRef.current, { type: "video/webm" });
    const newMessage: VideoMessage = {
      id: `msg-${Date.now()}`,
      sender: "You",
      date: new Date().toLocaleString(),
      duration: recordingTime,
      videoUrl: URL.createObjectURL(videoBlob),
      isNew: true,
    };

    const updated = [newMessage, ...messages];
    setMessages(updated);
    try {
      const toStore = updated.map((m) => ({
        ...m,
        videoUrl: undefined,
        thumbnailUrl: undefined,
      }));
      localStorage.setItem("signapps_video_messages", JSON.stringify(toStore));
    } catch {
      /* quota */
    }
    // Upload video blob to API
    const formData = new FormData();
    formData.append("video", videoBlob, "recording.webm");
    formData.append("duration_seconds", String(recordingTime));
    meetClient.post("/meet/video-messages", formData).catch(() => {});
    chunksRef.current = [];
    setRecordingTime(0);
    toast.success("Message vidéo envoyé");
  };

  const handleDelete = (id: string) => {
    const updated = messages.filter((m) => m.id !== id);
    setMessages(updated);
    try {
      localStorage.setItem("signapps_video_messages", JSON.stringify(updated));
    } catch {
      /* ignore */
    }
    meetClient.delete(`/meet/video-messages/${id}`).catch(() => {});
  };

  const togglePlayback = (id: string) => {
    setPlayingId(playingId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Recording Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Nouvelle vidéo
          </CardTitle>
          <CardDescription>
            Enregistrez un message vidéo asynchrone
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Video Preview */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video w-full">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
            />
            {isRecording && (
              <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1 bg-red-600 rounded-full">
                <div className="w-2 h-2 bg-card rounded-full animate-pulse" />
                <span className="text-white text-xs font-semibold">
                  {formatDuration(recordingTime)}
                </span>
              </div>
            )}
          </div>

          {/* Recording Controls */}
          <div className="flex gap-2">
            {!isRecording ? (
              <Button onClick={startRecording} className="flex-1 gap-2">
                <Video className="w-4 h-4" />
                Démarrer l'enregistrement
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                variant="destructive"
                className="flex-1 gap-2"
              >
                <Square className="w-4 h-4" />
                Arrêter
              </Button>
            )}
          </div>

          {/* Send Button */}
          {recordingTime > 0 && !isRecording && (
            <Button
              onClick={sendVideoMessage}
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
            >
              <Send className="w-4 h-4" />
              Envoyer ({formatDuration(recordingTime)})
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Messages List Section */}
      <Card>
        <CardHeader>
          <CardTitle>Messages reçus</CardTitle>
          <CardDescription>Vos messages vidéo asynchrones</CardDescription>
        </CardHeader>
      </Card>

      {messages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Aucun message vidéo</h3>
            <p className="text-muted-foreground text-center mt-2">
              Commencez à enregistrer des messages
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <Card
              key={message.id}
              className={message.isNew ? "border-blue-200 bg-blue-50/30" : ""}
            >
              <CardContent className="pt-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{message.sender}</h4>
                      {message.isNew && (
                        <Badge className="bg-blue-600">Nouveau</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground font-medium">
                      {message.date}
                    </p>
                    <div className="flex items-center gap-1 mt-1 justify-end text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatDuration(message.duration)}</span>
                    </div>
                  </div>
                </div>

                {/* Playback Controls */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => togglePlayback(message.id)}
                    className="flex-1"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Regarder
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(message.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Video Player */}
                {playingId === message.id && message.videoUrl && (
                  <div className="mt-4 bg-black rounded-lg overflow-hidden aspect-video w-full">
                    <video
                      key={message.id}
                      src={message.videoUrl}
                      controls
                      className="w-full h-full object-contain"
                      autoPlay
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
