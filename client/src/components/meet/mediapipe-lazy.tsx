"use client";

/**
 * Lazy wrapper around MediaPipe background segmentation and VAD.  These
 * are heavy wasm bundles and only needed on /meet/*.  Loaded on demand
 * behind these hooks to avoid bloating the initial bundle.
 */

import { useEffect, useState } from "react";

type SegmentationModule = typeof import("@mediapipe/selfie_segmentation");
type VadModule = typeof import("@ricky0123/vad-web");

export function useMediaPipeSegmentation(): SegmentationModule | null {
  const [mod, setMod] = useState<SegmentationModule | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("@mediapipe/selfie_segmentation").then((m) => {
      if (!cancelled) setMod(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return mod;
}

export function useVad(): VadModule | null {
  const [mod, setMod] = useState<VadModule | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("@ricky0123/vad-web").then((m) => {
      if (!cancelled) setMod(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return mod;
}
