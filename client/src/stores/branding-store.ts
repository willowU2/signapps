import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BrandingState {
  logoUrl: string | null; // null = use default
  appName: string;
  setLogoUrl: (url: string | null) => void;
  setAppName: (name: string) => void;
}

export const useBrandingStore = create<BrandingState>()(
  persist(
    (set) => ({
      logoUrl: null,
      appName: "SignApps",
      setLogoUrl: (url) => set({ logoUrl: url }),
      setAppName: (name) => set({ appName: name }),
    }),
    { name: "signapps-branding" },
  ),
);
