"use client";

import { useEffect, useState } from "react";

import {
  applyVirtualBackground,
  type VirtualBackgroundOptions,
  type VirtualBackgroundHandle,
} from "./virtual-background";

/**
 * React hook wrapper around {@link applyVirtualBackground}.
 *
 * Rebuilds the pipeline when:
 *  - the source stream reference changes,
 *  - `opts.mode` changes,
 *  - or `opts.imageUrl` changes.
 *
 * Returns the processed MediaStream (or the raw `source` when
 * `mode === "none"`), and `null` while the source itself is null.
 */
export function useVirtualBackground(
  source: MediaStream | null,
  opts: VirtualBackgroundOptions,
): MediaStream | null {
  const [processed, setProcessed] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!source) {
      setProcessed(null);
      return;
    }

    let handle: VirtualBackgroundHandle | null = null;
    try {
      handle = applyVirtualBackground(source, opts);
      setProcessed(handle.output);
    } catch {
      setProcessed(source);
    }

    return () => {
      handle?.stop();
    };
    // `opts.onDegrade`/`opts.blurPx`/`opts.targetFps` changes are
    // intentionally NOT in the dep list — rebuilding the whole
    // pipeline every tick would kill performance. Consumers pass
    // stable callbacks where it matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, opts.mode, opts.imageUrl]);

  return processed;
}
