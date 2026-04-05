"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import type { Site } from "@/types/org";

// =============================================================================
// Local constants
// =============================================================================

const COUNTRY_FLAGS: Record<string, string> = {
  France: "FR",
  Belgique: "BE",
  Suisse: "CH",
  Canada: "CA",
  Luxembourg: "LU",
  Allemagne: "DE",
  "Royaume-Uni": "GB",
  "Etats-Unis": "US",
  Espagne: "ES",
  Italie: "IT",
};

// =============================================================================
// SitesTab
// =============================================================================

export interface SitesTabProps {
  sites: Site[];
}

export function SitesTab({ sites }: SitesTabProps) {
  return (
    <div className="p-4 space-y-2">
      <p className="text-sm text-muted-foreground mb-2">
        {sites.length} site(s)
      </p>
      {sites.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucun site</p>
        </div>
      ) : (
        <div className="space-y-1">
          {sites.map((s) => {
            const flag = COUNTRY_FLAGS[s.country ?? ""] ?? "";
            return (
              <div
                key={s.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30"
              >
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  {s.city && (
                    <p className="text-xs text-muted-foreground">
                      {flag ? `${flag} ` : ""}
                      {s.city}
                      {s.country ? `, ${s.country}` : ""}
                    </p>
                  )}
                </div>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 shrink-0 capitalize"
                >
                  {s.site_type}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
