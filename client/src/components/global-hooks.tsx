"use client";

import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useRecentHistory } from "@/components/recent-history";

/**
 * Global hooks wrapper — mounts hooks that need to run app-wide.
 * Add this component inside Providers to activate all global behaviors.
 */
export function GlobalHooks() {
  useKeyboardShortcuts();
  useRecentHistory();
  return null;
}
