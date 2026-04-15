"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Camera,
  X,
  Upload,
  QrCode,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { driveApi } from "@/lib/api/drive";
import { cn } from "@/lib/utils";

type ScanResult =
  | { type: "qr"; value: string }
  | { type: "photo"; nodeId: string; name: string };
type ScannerState =
  | "idle"
  | "streaming"
  | "captured"
  | "uploading"
  | "done"
  | "error";

interface CameraScannerProps {
  /** Called after a successful capture / QR scan */
  onResult?: (result: ScanResult) => void;
  /** Drive folder to upload photos into (null = root) */
  parentId?: string | null;
  /** Compact trigger button */
  compact?: boolean;
}

/**
 * CameraScanner — opens the device camera for:
 * 1. Photo capture → uploads to Drive via driveApi.uploadFile()
 * 2. QR code scanning → returns the decoded URL/text for further action
 *
 * QR detection uses a simple canvas-based approach with jsQR (loaded lazily
 * to avoid SSR issues). Falls back gracefully when jsQR is not available.
 */
export function CameraScanner({
  onResult,
  parentId = null,
  compact = false,
}: CameraScannerProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ScannerState>("idle");
  const [mode, setMode] = useState<"photo" | "qr">("photo");
  const [qrResult, setQrResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [uploadedName, setUploadedName] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  // Start the camera stream
  const startStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setState("streaming");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera access denied";
      setErrorMsg(msg);
      setState("error");
    }
  }, []);

  // Stop the camera stream
  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setState("idle");
  }, []);

  // Capture a photo frame from the video
  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    stopStream();
    setState("uploading");

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setState("error");
          setErrorMsg("Failed to capture image");
          return;
        }
        const fileName = `photo-${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: "image/jpeg" });
        try {
          const node = await driveApi.uploadFile(file, parentId);
          setUploadedName(node.name);
          setState("done");
          onResult?.({ type: "photo", nodeId: node.id, name: node.name });
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : "Upload failed");
          setState("error");
        }
      },
      "image/jpeg",
      0.9,
    );
  }, [stopStream, parentId, onResult]);

  // QR scan loop using jsQR (loaded lazily)
  const startQrLoop = useCallback(async () => {
    let jsQR:
      | ((
          data: Uint8ClampedArray,
          w: number,
          h: number,
        ) => { data: string } | null)
      | null = null;
    try {
      const mod = await import(
        /* webpackIgnore: true */ "jsqr" as string
      ).catch(() => null);
      jsQR = mod?.default ?? null;
    } catch {
      jsQR = null;
    }

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      if (jsQR) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          setQrResult(code.data);
          stopStream();
          setState("done");
          onResult?.({ type: "qr", value: code.data });
          return;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopStream, onResult]);

  useEffect(() => {
    if (open) {
      startStream().then(() => {
        if (mode === "qr") startQrLoop();
      });
    } else {
      stopStream();
      setState("idle");
      setQrResult(null);
      setErrorMsg("");
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (state === "streaming" && mode === "qr") startQrLoop();
  }, [mode, state, startQrLoop]);

  return (
    <>
      <Button
        variant={compact ? "ghost" : "outline"}
        size={compact ? "icon" : "default"}
        onClick={() => setOpen(true)}
        title="Open camera"
        aria-label="Open camera"
      >
        <Camera className="h-4 w-4" />
        {!compact && <span className="ml-2">Camera</span>}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) stopStream();
          setOpen(v);
        }}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              {mode === "photo" ? (
                <Camera className="h-4 w-4" />
              ) : (
                <QrCode className="h-4 w-4" />
              )}
              {mode === "photo" ? "Take Photo" : "Scan QR Code"}
            </DialogTitle>
          </DialogHeader>

          {/* Mode toggle */}
          <div className="flex gap-2 px-4 pb-2">
            {(["photo", "qr"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 py-1.5 text-sm rounded-md font-medium transition-colors",
                  mode === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "photo" ? "Photo" : "QR Code"}
              </button>
            ))}
          </div>

          {/* Video preview */}
          <div className="relative bg-black aspect-video">
            {(state === "streaming" || state === "idle") && (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
                autoPlay
              />
            )}

            {/* QR viewfinder overlay */}
            {mode === "qr" && state === "streaming" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white/70 rounded-lg">
                  <span className="sr-only">QR code target area</span>
                </div>
              </div>
            )}

            {/* Canvas (hidden — used for capture/QR decode) */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Uploading spinner */}
            {state === "uploading" && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-white text-center space-y-2">
                  <Upload className="h-8 w-8 mx-auto animate-bounce" />
                  <p className="text-sm">Uploading to Drive…</p>
                </div>
              </div>
            )}

            {/* Success */}
            {state === "done" && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-white text-center space-y-2 px-4">
                  <CheckCircle className="h-8 w-8 mx-auto text-green-400" />
                  {mode === "photo" && (
                    <p className="text-sm">
                      Saved as <strong>{uploadedName}</strong>
                    </p>
                  )}
                  {mode === "qr" && qrResult && (
                    <>
                      <p className="text-sm font-medium">QR detected</p>
                      <p className="text-xs text-white/70 break-all max-w-xs">
                        {qrResult}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Error */}
            {state === "error" && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-white text-center space-y-2 px-4">
                  <AlertCircle className="h-8 w-8 mx-auto text-red-400" />
                  <p className="text-sm">{errorMsg}</p>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 px-4 py-3">
            {state === "streaming" && mode === "photo" && (
              <Button className="flex-1" onClick={capturePhoto}>
                <Camera className="h-4 w-4 mr-2" />
                Capture
              </Button>
            )}
            {state === "streaming" && mode === "qr" && (
              <p className="flex-1 text-sm text-muted-foreground text-center py-1">
                Point the camera at a QR code…
              </p>
            )}
            {(state === "done" || state === "error") && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setState("idle");
                  startStream().then(() => {
                    if (mode === "qr") startQrLoop();
                  });
                }}
              >
                Try again
              </Button>
            )}
            {state === "done" && mode === "qr" && qrResult && (
              <Button
                className="flex-1"
                onClick={() => {
                  if (qrResult.startsWith("http"))
                    window.open(qrResult, "_blank", "noopener");
                  else navigator.clipboard.writeText(qrResult);
                  setOpen(false);
                }}
              >
                {qrResult.startsWith("http") ? "Open URL" : "Copy text"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
