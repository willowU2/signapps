"use client";

/**
 * Lazy wrapper around `@monaco-editor/react`. Monaco ships a heavy
 * bundle (worker + VS Code features) that is only needed on routes with
 * code cells or formula-by-formula editing.
 *
 * The `@monaco-editor/react` package is not yet installed in the
 * dependency tree. This wrapper is already wired so that the moment a
 * consumer adds it to `package.json`, the editor can be imported lazily
 * without touching call sites.
 */

import dynamic from "next/dynamic";
import { MonacoSkeleton } from "@/components/common/lazy-skeleton";

export const MonacoEditor = dynamic(
  () =>
    // @ts-expect-error -- optional peer: installed on demand
    import("@monaco-editor/react").then((m) => m.default),
  { ssr: false, loading: () => <MonacoSkeleton /> },
);

export const DiffEditor = dynamic(
  () =>
    // @ts-expect-error -- optional peer: installed on demand
    import("@monaco-editor/react").then((m) => m.DiffEditor),
  { ssr: false, loading: () => <MonacoSkeleton /> },
);
