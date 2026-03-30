"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface KeyboardShortcut {
  keys: string;
  description: string;
  category: "global" | "navigation" | "module";
}

function isInputFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.isContentEditable
  );
}

function getModuleName(pathname: string): string | null {
  const segments: Record<string, string> = {
    "/mail": "Mail",
    "/docs": "Docs",
    "/sheets": "Sheets",
    "/slides": "Slides",
    "/tasks": "Tâches",
    "/calendar": "Calendrier",
    "/cal": "Calendrier",
    "/contacts": "Contacts",
    "/drive": "Drive",
    "/chat": "Chat",
  };
  for (const [prefix, name] of Object.entries(segments)) {
    if (pathname.startsWith(prefix)) return name;
  }
  return null;
}

export function getShortcutsList(pathname: string = "/"): KeyboardShortcut[] {
  const shortcuts: KeyboardShortcut[] = [
    { keys: "Ctrl+K", description: "Palette de commandes", category: "global" },
    { keys: "Ctrl+/", description: "Aide raccourcis", category: "global" },
    { keys: "?", description: "Aide raccourcis", category: "global" },
    { keys: "Ctrl+N", description: "Nouveau", category: "global" },
    { keys: "Ctrl+Shift+B", description: "Barre latérale", category: "global" },
    { keys: "Escape", description: "Fermer modale", category: "global" },
    { keys: "G → D", description: "Aller au Dashboard", category: "navigation" },
    { keys: "G → M", description: "Aller à Mail", category: "navigation" },
    { keys: "G → C", description: "Aller au Calendrier", category: "navigation" },
    { keys: "G → T", description: "Aller aux Tâches", category: "navigation" },
    { keys: "G → F", description: "Aller à Drive", category: "navigation" },
    { keys: "G → S", description: "Aller au Social", category: "navigation" },
    { keys: "G → B", description: "Aller à Billing", category: "navigation" },
    { keys: "G → A", description: "Aller aux Settings", category: "navigation" },
  ];

  if (pathname.startsWith("/mail")) {
    shortcuts.push(
      { keys: "C", description: "Nouveau mail", category: "module" },
      { keys: "R", description: "Répondre", category: "module" },
      { keys: "F", description: "Transférer", category: "module" },
    );
  } else if (pathname.startsWith("/docs") || pathname.startsWith("/sheets") || pathname.startsWith("/slides") || pathname.startsWith("/design")) {
    shortcuts.push(
      { keys: "Ctrl+S", description: "Sauvegarder", category: "module" },
    );
  } else if (pathname.startsWith("/tasks")) {
    shortcuts.push(
      { keys: "N", description: "Nouvelle tâche", category: "module" },
    );
  } else if (pathname.startsWith("/cal") || pathname.startsWith("/calendar")) {
    shortcuts.push(
      { keys: "N", description: "Nouvel événement", category: "module" },
    );
  }

  return shortcuts;
}

export function useKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const pendingGRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleOverlay = useCallback(() => {
    setOverlayOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const navMap: Record<string, string> = {
      d: "/dashboard",
      m: "/mail",
      c: "/cal",
      t: "/tasks",
      f: "/drive",
      s: "/social",
      b: "/billing",
      a: "/settings",
    };

    function handleKeyDown(e: KeyboardEvent) {
      // Handle G-sequence second key
      if (pendingGRef.current) {
        pendingGRef.current = false;
        if (gTimerRef.current) clearTimeout(gTimerRef.current);
        const dest = navMap[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          router.push(dest);
          return;
        }
      }

      // Ctrl/Meta combos work even in inputs
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "k") {
          e.preventDefault();
          document.dispatchEvent(new CustomEvent("toggle-command-palette"));
          return;
        }
        if (key === "/") {
          e.preventDefault();
          toggleOverlay();
          return;
        }
        if (key === "n") {
          e.preventDefault();
          document.dispatchEvent(new CustomEvent("create-new"));
          return;
        }
        if (key === "b" && e.shiftKey) {
          e.preventDefault();
          document.dispatchEvent(new CustomEvent("toggle-sidebar"));
          return;
        }
        if (key === "s" && !e.shiftKey) {
          // Let editor components handle their own save; dispatch global event as fallback
          if (
            pathname.startsWith("/docs") ||
            pathname.startsWith("/sheets") ||
            pathname.startsWith("/slides") ||
            pathname.startsWith("/design")
          ) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent("app:save-to-drive"));
            return;
          }
        }
      }

      // Skip non-ctrl shortcuts when typing in inputs
      if (isInputFocused()) return;

      const key = e.key.toLowerCase();

      // ? also opens help
      if (e.key === "?" || (e.key === "/" && !e.ctrlKey)) {
        if (e.key === "?") {
          e.preventDefault();
          toggleOverlay();
          return;
        }
      }

      // G-sequence start
      if (key === "g" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        pendingGRef.current = true;
        gTimerRef.current = setTimeout(() => {
          pendingGRef.current = false;
        }, 500);
        return;
      }

      // Module-specific shortcuts
      if (pathname.startsWith("/mail")) {
        if (key === "c") { document.dispatchEvent(new CustomEvent("mail:compose")); return; }
        if (key === "r") { document.dispatchEvent(new CustomEvent("mail:reply")); return; }
        if (key === "f") { document.dispatchEvent(new CustomEvent("mail:forward")); return; }
      }
      if (pathname.startsWith("/tasks")) {
        if (key === "n") { document.dispatchEvent(new CustomEvent("tasks:new")); return; }
      }
      if (pathname.startsWith("/cal") || pathname.startsWith("/calendar")) {
        if (key === "n") { document.dispatchEvent(new CustomEvent("calendar:new")); return; }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [router, pathname, toggleOverlay]);

  return { overlayOpen, setOverlayOpen, toggleOverlay, moduleName: getModuleName(pathname) };
}
