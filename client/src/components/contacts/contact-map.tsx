"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, Search } from "lucide-react";

interface ContactWithLocation {
  id: string;
  name: string;
  email: string;
  company?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

interface ContactMapProps {
  contacts: ContactWithLocation[];
}

// Simplified map using CSS grid cells grouped by city (no external library needed)
function groupByCity(contacts: ContactWithLocation[]) {
  const map = new Map<string, ContactWithLocation[]>();
  for (const c of contacts) {
    const key = [c.city, c.country].filter(Boolean).join(", ") || "Localisation inconnue";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return Array.from(map.entries()).map(([city, members]) => ({ city, members }));
}

export function ContactMap({ contacts }: ContactMapProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() =>
    contacts.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.city?.toLowerCase().includes(search.toLowerCase()) ||
      c.country?.toLowerCase().includes(search.toLowerCase())
    ), [contacts, search]
  );

  const groups = useMemo(() => groupByCity(filtered), [filtered]);
  const withLocation = contacts.filter((c) => c.city || c.country);
  const withoutLocation = contacts.filter((c) => !c.city && !c.country);

  const selectedGroup = selected ? groups.find((g) => g.city === selected) : null;

  return (
    <div className="space-y-4">
      {/* Stats banner */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total contacts", value: contacts.length },
          { label: "Géolocalisés", value: withLocation.length },
          { label: "Villes", value: groups.filter((g) => g.city !== "Localisation inconnue").length },
        ].map((s) => (
          <div key={s.label} className="border rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          className="pl-9" placeholder="Rechercher par nom ou ville..."
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Map placeholder with city pins */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-blue-50 dark:bg-blue-950/20 relative min-h-[200px] p-4">
          {/* Decorative map background */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_50%,_#3b82f6_1px,_transparent_1px)] bg-[size:20px_20px]" />

          {/* Note about full map */}
          <div className="relative text-center py-8 text-muted-foreground">
            <MapPin className="size-8 mx-auto mb-2 text-blue-500" />
            <p className="text-sm font-medium">Vue cartographique</p>
            <p className="text-xs mt-1">Intégration Leaflet/Mapbox disponible avec clé API.</p>
            <p className="text-xs">Voici la distribution géographique de vos contacts:</p>
          </div>
        </div>

        {/* City grid */}
        <div className="p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Distribution par ville</p>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <button
                key={g.city}
                onClick={() => setSelected(selected === g.city ? null : g.city)}
                className={`flex items-center gap-1.5 text-sm rounded-full px-3 py-1 border transition-colors ${
                  selected === g.city ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted border-border"
                }`}
              >
                <MapPin className="size-3" />
                {g.city}
                <Badge variant={selected === g.city ? "outline" : "secondary"} className="text-xs ml-0.5">
                  {g.members.length}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selected city details */}
      {selectedGroup && (
        <div className="border rounded-lg p-4 space-y-2">
          <p className="font-medium text-sm flex items-center gap-2">
            <MapPin className="size-4 text-primary" /> {selectedGroup.city}
            <Badge variant="secondary">{selectedGroup.members.length} contact{selectedGroup.members.length > 1 ? "s" : ""}</Badge>
          </p>
          <div className="space-y-1">
            {selectedGroup.members.map((c) => (
              <div key={c.id} className="flex items-center gap-3 text-sm">
                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {c.name[0]}
                </div>
                <span className="flex-1 truncate">{c.name}</span>
                {c.company && <span className="text-muted-foreground text-xs truncate">{c.company}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {withoutLocation.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {withoutLocation.length} contact{withoutLocation.length > 1 ? "s" : ""} sans localisation.
          Ajoutez les champs "city" et "country" pour les afficher.
        </p>
      )}
    </div>
  );
}
