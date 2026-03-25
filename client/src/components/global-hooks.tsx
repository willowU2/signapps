"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useRecentHistory } from "@/components/recent-history";
import { useTabSync } from "@/hooks/use-tab-sync";

/**
 * Global hooks wrapper — mounts hooks that need to run app-wide.
 * Add this component inside Providers to activate all global behaviors.
 */
export function GlobalHooks() {
  useKeyboardShortcuts();
  useRecentHistory();

  const router = useRouter();
  useTabSync(
    useCallback((msg) => {
      if (msg.type === 'logout') {
        router.push('/login');
      } else if (msg.type === 'auth-change') {
        router.refresh();
      }
    }, [router])
  );

  return null;
}
