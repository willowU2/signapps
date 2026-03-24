"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const shortcuts = [
      { key: "k", ctrl: true, action: () => document.dispatchEvent(new CustomEvent("toggle-command-palette")) },
      { key: "/", ctrl: true, action: () => document.dispatchEvent(new CustomEvent("toggle-help")) },
      { key: "n", ctrl: true, action: () => document.dispatchEvent(new CustomEvent("create-new")) },
      { key: "b", ctrl: true, shift: true, action: () => document.dispatchEvent(new CustomEvent("toggle-sidebar")) },
      { key: "1", ctrl: true, action: () => router.push("/dashboard") },
      { key: "2", ctrl: true, action: () => router.push("/mail") },
      { key: "3", ctrl: true, action: () => router.push("/calendar") },
      { key: "4", ctrl: true, action: () => router.push("/contacts") },
      { key: "5", ctrl: true, action: () => router.push("/drive") },
    ];

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      for (const s of shortcuts) {
        const ctrlMatch = s.ctrl ? (e.ctrlKey || e.metaKey) : true;
        const shiftMatch = (s as { shift?: boolean }).shift ? e.shiftKey : !e.shiftKey;
        if (e.key.toLowerCase() === s.key.toLowerCase() && ctrlMatch && shiftMatch) {
          e.preventDefault();
          s.action();
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);
}

export function getShortcutsList() {
  return [
    { keys: "Ctrl+K", description: "Palette de commandes" },
    { keys: "Ctrl+/", description: "Aide raccourcis" },
    { keys: "Ctrl+N", description: "Nouveau" },
    { keys: "Ctrl+Shift+B", description: "Barre laterale" },
    { keys: "Ctrl+1-5", description: "Navigation rapide" },
  ];
}
