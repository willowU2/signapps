"use client";

/**
 * Lazy wrapper around the Tiptap editor. Consumers should import
 * `TiptapEditor` from here instead of `@/components/docs/editor` directly,
 * so the heavy Tiptap bundle is split into a route-local chunk.
 */

import dynamic from "next/dynamic";
import { EditorSkeleton } from "@/components/common/lazy-skeleton";

export const TiptapEditor = dynamic(
  () => import("@/components/docs/editor").then((m) => m.default),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  },
);
