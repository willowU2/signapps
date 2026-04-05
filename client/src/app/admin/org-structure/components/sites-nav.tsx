"use client";

import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Globe, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Site } from "@/types/org";

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

export interface SitesNavProps {
  sites: Site[];
  loading: boolean;
  selectedSiteId: string | null;
  onSelectSite: (site: Site) => void;
}

export function SitesNav({
  sites,
  loading,
  selectedSiteId,
  onSelectSite,
}: SitesNavProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery) return sites;
    const q = searchQuery.toLowerCase();
    return sites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.country?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q),
    );
  }, [sites, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, Site[]>();
    for (const site of filtered) {
      const country = site.country ?? "Autre";
      if (!map.has(country)) map.set(country, []);
      map.get(country)!.push(site);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Chargement des sites...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un site..."
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {grouped.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Aucun site</p>
          </div>
        ) : (
          grouped.map(([country, countrySites]) => {
            const flag = COUNTRY_FLAGS[country] ?? "";
            return (
              <div key={country}>
                <div className="flex items-center gap-2 px-3 py-1">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {flag ? `${flag} ` : ""}
                    {country}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1 py-0 ml-auto"
                  >
                    {countrySites.length}
                  </Badge>
                </div>
                <div className="space-y-0.5 ml-2">
                  {countrySites.map((site) => (
                    <div
                      key={site.id}
                      onClick={() => onSelectSite(site)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all",
                        selectedSiteId === site.id
                          ? "bg-primary/10 ring-1 ring-primary/30"
                          : "hover:bg-muted/60",
                      )}
                    >
                      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {site.name}
                        </p>
                        {site.city && (
                          <p className="text-xs text-muted-foreground truncate">
                            {site.city}
                            {site.address ? ` — ${site.address}` : ""}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 shrink-0 capitalize"
                      >
                        {site.site_type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
