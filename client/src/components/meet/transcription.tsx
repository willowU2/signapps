"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Mic,
  MicOff,
  Square,
  Download,
  Copy,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { aiApi } from "@/lib/api";
import { getClient, ServiceName } from "@/lib/api/factory";

interface TranscriptSegment {
  id: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

interface TranscriptionProps {
  /** Auto-start transcription when mounted */
  autoStart?: boolean;
  /** Callback when transcript updates */
  onTranscriptUpdate?: (fullText: string) => void;
  /**
   * AQ-AITR: Use whisper-rs backend for server-side transcription.
   * When true, records audio in chunks and sends to /api/v1/transcribe.
   * Falls back to Web Speech API when false (default).
   */
  useWhisperBackend?: boolean;
}

// Web Speech API — local interface definitions (webkit prefix not in TS DOM lib)
type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLocal) => void) | null;
  onerror: ((event: { error: string; message: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};
type SpeechRecognitionEventLocal = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

export function Transcription({
  autoStart = false,
  onTranscriptUpdate,
  useWhisperBackend = false,
}: TranscriptionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimText, setInterimText] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [copied, setCopied] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [segments, interimText, scrollToBottom]);

  useEffect(() => {
    // Check browser support
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    if (autoStart) {
      startRecording();
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getFullTranscript = useCallback(() => {
    return segments
      .filter((s) => s.isFinal)
      .map((s) => s.text)
      .join(" ");
  }, [segments]);

  useEffect(() => {
    if (onTranscriptUpdate) {
      onTranscriptUpdate(getFullTranscript());
    }
  }, [segments, onTranscriptUpdate, getFullTranscript]);

  // AQ-AITR: Whisper backend recording — sends audio chunks to signapps-ai /transcribe
  const startWhisperRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone access not supported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      let segmentStart = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioChunksRef.current = [];
        if (blob.size < 1000) return; // skip silent/empty chunks

        const formData = new FormData();
        formData.append("audio", blob, "audio.webm");
        formData.append("language", navigator.language?.split("-")[0] ?? "fr");

        try {
          const aiClient = getClient(ServiceName.AI);
          const res = await aiClient.post<{ text: string }>(
            "/transcribe",
            formData,
            {
              headers: { "Content-Type": "multipart/form-data" },
            },
          );
          const text = res.data?.text?.trim();
          if (text) {
            const seg: TranscriptSegment = {
              id: `seg_whisper_${Date.now()}`,
              text,
              timestamp: segmentStart - (startTime || segmentStart),
              isFinal: true,
            };
            setSegments((prev) => [...prev, seg]);
            segmentStart = Date.now();
          }
        } catch {
          // Silently skip failed chunk
        }
      };

      recorder.start();
      // Flush a chunk every 8 seconds
      const interval = setInterval(() => {
        if (recorder.state === "recording") {
          recorder.stop();
          recorder.start();
        } else {
          clearInterval(interval);
        }
      }, 8000);

      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      if (!startTime) setStartTime(Date.now());
    } catch {
      toast.error("Failed to access microphone");
    }
  };

  const stopWhisperRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  };

  const startRecording = () => {
    if (useWhisperBackend) {
      startWhisperRecording();
      return;
    }
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }

    const recognition =
      new SpeechRecognitionAPI() as unknown as SpeechRecognitionInstance;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      setIsPaused(false);
      if (!startTime) {
        setStartTime(Date.now());
      }
    };

    recognition.onresult = (event: SpeechRecognitionEventLocal) => {
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          const segment: TranscriptSegment = {
            id: `seg_${Date.now()}_${i}`,
            text: transcript.trim(),
            timestamp: Date.now() - (startTime || Date.now()),
            isFinal: true,
          };
          setSegments((prev) => [...prev, segment]);
          setInterimText("");
        } else {
          interim += transcript;
        }
      }

      if (interim) {
        setInterimText(interim);
      }
    };

    recognition.onerror = (event: { error: string; message: string }) => {
      if (event.error === "no-speech") {
        // Silence is fine, just continue
        return;
      }
      if (event.error === "aborted") {
        return;
      }
      toast.error(`Speech recognition error: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      // Auto-restart if still recording (browser may stop after silence)
      if (isRecording && !isPaused) {
        try {
          recognition.start();
        } catch {
          setIsRecording(false);
        }
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      toast.error("Failed to start speech recognition");
    }
  };

  const stopRecording = () => {
    if (useWhisperBackend) {
      stopWhisperRecording();
      return;
    }
    if (recognitionRef.current) {
      setIsRecording(false);
      setIsPaused(false);
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setInterimText("");
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSummarize = async () => {
    const transcript = getFullTranscript();
    if (!transcript.trim()) {
      toast.error("No transcript to summarize");
      return;
    }

    setIsSummarizing(true);

    try {
      const response = await aiApi.chat(
        `Please clean up and summarize this meeting transcript. Fix any speech recognition errors, organize the content, and provide:
1. A brief summary (2-3 sentences)
2. Key discussion points
3. Action items (if any)
4. Decisions made (if any)

Transcript:
${transcript}`,
        {
          systemPrompt:
            "You are a professional meeting assistant. Clean up and summarize transcripts clearly and concisely.",
        },
      );

      setSummary(response.data.answer);
      toast.success("Transcript summarized");
    } catch {
      toast.error("Failed to summarize transcript");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleCopy = async () => {
    const text = summary || getFullTranscript();
    if (!text.trim()) {
      toast.error("Nothing to copy");
      return;
    }

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copié dans le presse-papiers");
  };

  const handleExport = () => {
    const transcript = getFullTranscript();
    const exportText = summary
      ? `Meeting Transcript\n${"=".repeat(50)}\n\n${transcript}\n\n\nAI Summary\n${"=".repeat(50)}\n\n${summary}`
      : `Meeting Transcript\n${"=".repeat(50)}\n\n${transcript}`;

    const blob = new Blob([exportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transcript exported");
  };

  const formatTimestamp = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!isSupported) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium">
                Speech Recognition Not Supported
              </p>
              <p className="text-xs">
                Please use Chrome, Edge, or Safari for live transcription.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isRecording ? (
                <Mic className="h-5 w-5 text-red-500 animate-pulse" />
              ) : (
                <MicOff className="h-5 w-5 text-muted-foreground" />
              )}
              Live Transcription
            </div>
            <div className="flex items-center gap-2">
              {isRecording && (
                <span className="flex items-center gap-1.5 text-xs text-red-500">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Recording
                </span>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recording controls */}
          <div className="flex items-center gap-2">
            <Button
              onClick={toggleRecording}
              variant={isRecording ? "destructive" : "default"}
              className="gap-2"
            >
              {isRecording ? (
                <>
                  <Square className="h-4 w-4" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Start Recording
                </>
              )}
            </Button>

            <Button
              onClick={handleSummarize}
              variant="outline"
              disabled={isSummarizing || segments.length === 0}
              className="gap-2"
            >
              {isSummarizing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Summarizing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  AI Summary
                </>
              )}
            </Button>

            <Button
              onClick={handleCopy}
              variant="outline"
              size="icon"
              disabled={segments.length === 0}
              title="Copy transcript"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>

            <Button
              onClick={handleExport}
              variant="outline"
              size="icon"
              disabled={segments.length === 0}
              title="Export as text"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>

          {/* Live transcript */}
          <div className="border rounded-lg p-3 min-h-[200px] max-h-[400px] overflow-y-auto bg-muted/30">
            {segments.length === 0 && !interimText ? (
              <div className="flex items-center justify-center h-[160px] text-muted-foreground">
                <div className="text-center">
                  <Mic className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {isRecording
                      ? "Listening... Start speaking"
                      : 'Click "Start Recording" to begin'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {segments.map((segment) => (
                  <div key={segment.id} className="flex gap-2">
                    <span className="text-xs text-muted-foreground font-mono shrink-0 pt-0.5">
                      {formatTimestamp(segment.timestamp)}
                    </span>
                    <span className="text-sm">{segment.text}</span>
                  </div>
                ))}
                {interimText && (
                  <div className="flex gap-2">
                    <span className="text-xs text-muted-foreground font-mono shrink-0 pt-0.5">
                      ...
                    </span>
                    <span className="text-sm text-muted-foreground italic">
                      {interimText}
                    </span>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </div>

          {segments.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {segments.length} segment{segments.length !== 1 ? "s" : ""}{" "}
              transcribed
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI Summary */}
      {summary && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap text-sm">
              {summary}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
