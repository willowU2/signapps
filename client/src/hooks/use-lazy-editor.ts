/**
 * useLazyEditor Hook
 *
 * Lazy loads editor components and extensions for better initial load performance.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createLazyLoader, preloadInIdle } from "@/lib/office/performance";

// ============================================================================
// Types
// ============================================================================

/** Common props accepted by all lazy-loaded editors */
interface EditorProps {
  content?: unknown;
  onChange?: (newContent: unknown) => void;
  readOnly?: boolean;
  documentId?: string;
  [key: string]: unknown;
}

interface EditorModule {
  default: React.ComponentType<EditorProps>;
}

interface LazyEditorState {
  isLoading: boolean;
  isVisible: boolean;
  error: Error | null;
  Editor: React.ComponentType<EditorProps> | null;
}

interface UseLazyEditorOptions {
  /** Preload when idle */
  preload?: boolean;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Threshold for intersection observer */
  threshold?: number;
  /** Fallback component while loading */
  fallback?: React.ReactNode;
}

interface UseLazyEditorReturn extends LazyEditorState {
  containerRef: React.RefObject<HTMLDivElement>;
  retry: () => void;
}

// ============================================================================
// Editor Loaders
// ============================================================================

// Dynamic imports - these modules may not exist yet, so we return placeholder components
const editorLoaders = {
  document: () =>
    import("@/components/docs/document-editor").catch(() => ({
      default: (() => null) as React.ComponentType<EditorProps>,
    })),
  spreadsheet: () =>
    import("@/components/sheets/sheet-editor").catch(() => ({
      default: (() => null) as React.ComponentType<EditorProps>,
    })),
  presentation: () =>
    import("@/components/slides/slide-editor").catch(() => ({
      default: (() => null) as React.ComponentType<EditorProps>,
    })),
} as const;

type EditorType = keyof typeof editorLoaders;

// ============================================================================
// Hook
// ============================================================================

export function useLazyEditor(
  type: EditorType,
  options: UseLazyEditorOptions = {},
): UseLazyEditorReturn {
  const { preload = true, rootMargin = "100px", threshold = 0.1 } = options;

  const [state, setState] = useState<LazyEditorState>({
    isLoading: false,
    isVisible: false,
    error: null,
    Editor: null,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadAttempted = useRef(false);

  // Load editor module
  const loadEditor = useCallback(async () => {
    if (state.Editor || state.isLoading) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const loader = editorLoaders[type];
      const module = (await loader()) as EditorModule;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        Editor: module.default,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error ? error : new Error("Failed to load editor"),
      }));
    }
  }, [type, state.Editor, state.isLoading]);

  // Retry loading
  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
    loadAttempted.current = false;
    loadEditor();
  }, [loadEditor]);

  // Set up intersection observer
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    observerRef.current = createLazyLoader(
      (entry) => {
        if (entry.isIntersecting && !loadAttempted.current) {
          loadAttempted.current = true;
          setState((prev) => ({ ...prev, isVisible: true }));
          loadEditor();

          // Stop observing once triggered
          if (observerRef.current) {
            observerRef.current.unobserve(element);
          }
        }
      },
      { rootMargin, threshold },
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadEditor, rootMargin, threshold]);

  // Preload in idle time
  useEffect(() => {
    if (preload && !state.Editor && !loadAttempted.current) {
      const editorPaths: Record<EditorType, string> = {
        document: "/chunks/document-editor.js",
        spreadsheet: "/chunks/sheet-editor.js",
        presentation: "/chunks/slide-editor.js",
      };
      preloadInIdle([editorPaths[type]]);
    }
  }, [preload, type, state.Editor]);

  return {
    ...state,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    retry,
  };
}

// ============================================================================
// Extension Lazy Loading
// ============================================================================

interface ExtensionModule {
  default: unknown;
}

const extensionCache = new Map<string, unknown>();

export async function loadExtension(name: string): Promise<unknown> {
  if (extensionCache.has(name)) {
    return extensionCache.get(name);
  }

  // Extension loaders - these modules may not exist yet, so we return placeholders
  const extensionLoaders: Record<string, () => Promise<ExtensionModule>> = {
    // Tiptap extensions
    comments: () =>
      import("@/lib/tiptap/extensions/comments").catch(() => ({
        default: null,
      })),
    trackChanges: () =>
      import("@/lib/tiptap/extensions/track-changes").catch(() => ({
        default: null,
      })),
    collaboration: () =>
      import("@/lib/tiptap/extensions/collaboration").catch(() => ({
        default: null,
      })),
    mentions: () =>
      import("@/lib/tiptap/extensions/mentions").catch(() => ({
        default: null,
      })),
    emoji: () =>
      import("@/lib/tiptap/extensions/emoji").catch(() => ({ default: null })),
    math: () =>
      import("@/lib/tiptap/extensions/math").catch(() => ({ default: null })),
    codeBlock: () =>
      import("@/lib/tiptap/extensions/code-block").catch(() => ({
        default: null,
      })),
    table: () =>
      import("@/lib/tiptap/extensions/table").catch(() => ({ default: null })),
  };

  const loader = extensionLoaders[name];
  if (!loader) {
    throw new Error(`Unknown extension: ${name}`);
  }

  const module = await loader();
  extensionCache.set(name, module.default);
  return module.default;
}

export async function loadExtensions(
  names: string[],
): Promise<Record<string, unknown>> {
  const results = await Promise.all(
    names.map(async (name) => {
      const extension = await loadExtension(name);
      return [name, extension] as const;
    }),
  );

  return Object.fromEntries(results);
}

// ============================================================================
// Preload Common Extensions
// ============================================================================

export function preloadCommonExtensions(): void {
  preloadInIdle([
    "/chunks/extension-comments.js",
    "/chunks/extension-track-changes.js",
    "/chunks/extension-collaboration.js",
  ]);
}
