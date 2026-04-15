"use client";

import { useQuery } from "@tanstack/react-query";
import { getServiceUrl, ServiceName } from "@/lib/api/factory";
import type { FontsManifest } from "./types";

export function useFontsCatalog() {
  return useQuery({
    queryKey: ["fonts", "manifest"],
    queryFn: async (): Promise<FontsManifest> => {
      const url = `${getServiceUrl(ServiceName.DOCS)}/fonts/manifest`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Fonts manifest unavailable (${res.status})`);
      }
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false, // 503 expected when not synced — don't spam retries
  });
}
