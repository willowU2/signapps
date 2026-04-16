"use client";

/**
 * Virtual background pipeline powered by MediaPipe Selfie Segmentation.
 *
 * Takes a source camera MediaStream and returns a processed MediaStream
 * where the background is either blurred or replaced by a static image.
 *
 * Runs purely in the browser — the segmentation WASM/tflite is loaded
 * from JSDelivr by default (the upstream Mediapipe loader). When the
 * platform is taken 100% offline later, mirror the assets under
 * `/public/mediapipe/` and set a local `locateFile` resolver.
 */

// The official types ship but are relatively loose; we keep the module
// import dynamic to avoid pulling the whole Mediapipe runtime when the
// user never opens a meeting.
type SelfieSegmentationResults = {
  segmentationMask: CanvasImageSource;
  image: CanvasImageSource;
};

interface SelfieSegmentationInstance {
  setOptions(options: { modelSelection?: 0 | 1; selfieMode?: boolean }): void;
  onResults(cb: (results: SelfieSegmentationResults) => void): void;
  send(input: { image: HTMLVideoElement | HTMLCanvasElement }): Promise<void>;
  close(): Promise<void>;
}

type SelfieSegmentationCtor = new (config: {
  locateFile?: (file: string) => string;
}) => SelfieSegmentationInstance;

export type BackgroundMode = "none" | "blur" | "image";

export interface VirtualBackgroundOptions {
  /** Background rendering mode. */
  mode: BackgroundMode;
  /** URL of the replacement image when `mode === "image"`. */
  imageUrl?: string;
  /** Gaussian blur radius in px (default 10). */
  blurPx?: number;
  /** Target frame rate, default 30. */
  targetFps?: number;
  /** Called if FPS stays below 20 for >2s — letting the UI fall back. */
  onDegrade?: (from: BackgroundMode, to: BackgroundMode) => void;
}

export interface VirtualBackgroundHandle {
  /** Processed MediaStream suitable for LiveKit publishing or a <video>. */
  output: MediaStream;
  /** Stops the pipeline and releases resources. */
  stop: () => void;
}

const CDN_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/";

/**
 * Build a processed MediaStream from a camera source.
 *
 * @param source The raw camera MediaStream (must contain at least one video track).
 * @param opts   Mode + styling options.
 * @returns A handle with the output stream and a stop() cleanup.
 *
 * When `mode === "none"` the source is forwarded without segmentation —
 * callers can still use the handle to keep a consistent lifecycle.
 */
export function applyVirtualBackground(
  source: MediaStream,
  opts: VirtualBackgroundOptions,
): VirtualBackgroundHandle {
  const mode = opts.mode;
  const blurPx = opts.blurPx ?? 10;
  const targetFps = opts.targetFps ?? 30;

  // ── Passthrough mode ─────────────────────────────────────────────
  if (mode === "none") {
    return {
      output: source,
      stop: () => {
        /* nothing to release — caller owns `source` */
      },
    };
  }

  // ── Source video element ─────────────────────────────────────────
  const videoEl = document.createElement("video");
  videoEl.srcObject = source;
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.autoplay = true;
  // Hide from the document but keep it rendered for decode.
  videoEl.style.position = "fixed";
  videoEl.style.left = "-9999px";
  videoEl.style.top = "-9999px";
  videoEl.style.width = "1px";
  videoEl.style.height = "1px";
  document.body.appendChild(videoEl);
  videoEl.play().catch(() => {
    /* autoplay might be blocked on first user-gesture-less calls; retried on visibilitychange */
  });

  // ── Working canvases ─────────────────────────────────────────────
  const width = 1280;
  const height = 720;
  const outCanvas = document.createElement("canvas");
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext("2d");

  if (!outCtx) {
    videoEl.remove();
    throw new Error("2D canvas unavailable");
  }

  // Background image (if mode === 'image').
  let bgImage: HTMLImageElement | null = null;
  if (mode === "image" && opts.imageUrl) {
    bgImage = new Image();
    bgImage.crossOrigin = "anonymous";
    bgImage.src = opts.imageUrl;
  }

  // ── Segmentation instance (async import) ─────────────────────────
  let segmentation: SelfieSegmentationInstance | null = null;
  let lastResults: SelfieSegmentationResults | null = null;
  let stopped = false;

  // Track FPS for the degrade callback.
  const frameTimestamps: number[] = [];
  let degradedMode: BackgroundMode = mode;
  let degradeTriggeredAt: number | null = null;

  const maybeDegrade = () => {
    // Sliding-window FPS over last 2 s.
    const now = performance.now();
    while (
      frameTimestamps.length > 0 &&
      now - frameTimestamps[0] > 2_000
    ) {
      frameTimestamps.shift();
    }
    const fps = frameTimestamps.length / 2;
    if (fps < 20 && frameTimestamps.length >= 10) {
      if (degradeTriggeredAt === null) {
        degradeTriggeredAt = now;
      }
      if (now - degradeTriggeredAt > 2_000) {
        const previous = degradedMode;
        let next: BackgroundMode;
        if (previous === "image") {
          next = "blur";
        } else if (previous === "blur") {
          next = "none";
        } else {
          next = previous;
        }
        if (next !== previous) {
          degradedMode = next;
          degradeTriggeredAt = null;
          opts.onDegrade?.(previous, next);
        }
      }
    } else {
      degradeTriggeredAt = null;
    }
  };

  const drawFrame = (results: SelfieSegmentationResults) => {
    if (stopped) return;
    outCtx.save();
    outCtx.clearRect(0, 0, width, height);

    if (degradedMode === "none") {
      outCtx.drawImage(results.image, 0, 0, width, height);
      outCtx.restore();
      return;
    }

    // 1) Draw the person mask.
    outCtx.drawImage(results.segmentationMask, 0, 0, width, height);

    // 2) Keep only the person pixels from the source video.
    outCtx.globalCompositeOperation = "source-in";
    outCtx.drawImage(results.image, 0, 0, width, height);

    // 3) Draw the background behind with the appropriate style.
    outCtx.globalCompositeOperation = "destination-over";
    if (degradedMode === "blur") {
      outCtx.filter = `blur(${blurPx}px)`;
      outCtx.drawImage(results.image, 0, 0, width, height);
      outCtx.filter = "none";
    } else if (degradedMode === "image" && bgImage && bgImage.complete) {
      outCtx.drawImage(bgImage, 0, 0, width, height);
    } else {
      // Fallback gradient while the image loads / when URL missing.
      const grad = outCtx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#0f172a");
      grad.addColorStop(1, "#1e293b");
      outCtx.fillStyle = grad;
      outCtx.fillRect(0, 0, width, height);
    }

    outCtx.restore();

    frameTimestamps.push(performance.now());
    maybeDegrade();
  };

  // ── RAF loop — pushes frames to the segmenter at targetFps ───────
  const interval = 1000 / targetFps;
  let lastSentAt = 0;
  let rafId = 0;
  const tick = async (ts: number) => {
    if (stopped) return;
    if (ts - lastSentAt >= interval) {
      lastSentAt = ts;
      if (
        segmentation &&
        videoEl.readyState >= 2 &&
        videoEl.videoWidth > 0
      ) {
        try {
          await segmentation.send({ image: videoEl });
        } catch {
          // Transient — keep looping.
        }
      } else if (lastResults) {
        // If segmenter not yet ready, keep the previous frame alive.
        drawFrame(lastResults);
      }
    }
    rafId = requestAnimationFrame(tick);
  };

  // Fire async loader.
  (async () => {
    try {
      const mod = (await import("@mediapipe/selfie_segmentation")) as unknown as {
        SelfieSegmentation: SelfieSegmentationCtor;
      };
      if (stopped) return;
      const SegmentationCtor = mod.SelfieSegmentation;
      segmentation = new SegmentationCtor({
        locateFile: (file) => `${CDN_BASE}${file}`,
      });
      segmentation.setOptions({ modelSelection: 1, selfieMode: false });
      segmentation.onResults((results) => {
        lastResults = results;
        drawFrame(results);
      });
      rafId = requestAnimationFrame(tick);
    } catch {
      // Loader failed — leave the canvas black; caller can watch output.
    }
  })();

  // ── Build the output MediaStream ─────────────────────────────────
  const canvasStream = outCanvas.captureStream(targetFps);
  // Mix original audio tracks into the output so consumers get AV in one handle.
  for (const audio of source.getAudioTracks()) {
    canvasStream.addTrack(audio);
  }

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    segmentation?.close().catch(() => undefined);
    canvasStream.getTracks().forEach((t) => {
      if (t.kind === "video") t.stop();
    });
    videoEl.srcObject = null;
    videoEl.remove();
  };

  return { output: canvasStream, stop };
}
