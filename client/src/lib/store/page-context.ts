import { create } from "zustand";

export interface PageContextState {
  // The current active page or entity the user is looking at
  activeContext: string | null;
  // The proactive message the AI wants to show to the user
  proactiveMessage: string | null;
  // Severity of the proactive message (controls the glow color)
  severity: "info" | "warning" | "error" | null;

  // Actions
  setContext: (context: string | null) => void;
  setProactiveMessage: (
    message: string,
    severity?: "info" | "warning" | "error",
  ) => void;
  clearProactive: () => void;
}

export const usePageContext = create<PageContextState>((set) => ({
  activeContext: null,
  proactiveMessage: null,
  severity: null,

  setContext: (context) => set({ activeContext: context }),

  setProactiveMessage: (message, severity = "info") =>
    set({ proactiveMessage: message, severity }),

  clearProactive: () => set({ proactiveMessage: null, severity: null }),
}));
