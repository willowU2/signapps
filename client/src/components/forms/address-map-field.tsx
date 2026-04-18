"use client";

/**
 * Address field with OpenStreetMap Nominatim autocomplete + embedded map.
 * Zero external dependencies — uses iframe OSM + fetch Nominatim.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AddressValue {
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  /** Formatted full address (Nominatim `display_name`) */
  display?: string;
}

interface AddressMapFieldProps {
  value?: AddressValue;
  onChange: (v: AddressValue) => void;
  disabled?: boolean;
  showMap?: boolean;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
    road?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    country?: string;
  };
}

export function AddressMapField({
  value,
  onChange,
  disabled,
  showMap = true,
}: AddressMapFieldProps) {
  const [query, setQuery] = useState(value?.display || "");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Nominatim search (debounced)
  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (r.ok) {
        const data: NominatimResult[] = await r.json();
        setResults(data);
        setShowDropdown(true);
      }
    } catch {
      // silent
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  // Click outside to close dropdown
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const selectResult = (r: NominatimResult) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    const addr = r.address || {};
    const street = [addr.house_number, addr.road].filter(Boolean).join(" ");
    const city = addr.city || addr.town || addr.village || "";
    const next: AddressValue = {
      street: street || undefined,
      zip: addr.postcode,
      city: city || undefined,
      country: addr.country,
      lat,
      lng,
      display: r.display_name,
    };
    onChange(next);
    setQuery(r.display_name);
    setShowDropdown(false);
  };

  const updateField = (k: keyof AddressValue, v: string) => {
    onChange({ ...(value || {}), [k]: v });
  };

  const mapUrl =
    value?.lat !== undefined && value?.lng !== undefined
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${value.lng - 0.01}%2C${value.lat - 0.01}%2C${value.lng + 0.01}%2C${value.lat + 0.01}&layer=mapnik&marker=${value.lat}%2C${value.lng}`
      : null;

  return (
    <div className="space-y-2">
      {/* Autocomplete search */}
      <div ref={wrapRef} className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder="Rechercher une adresse..."
          disabled={disabled}
          className="pl-8 pr-8 h-9"
        />
        {searching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        {!searching && query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
              onChange({});
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {showDropdown && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-md border bg-popover shadow-lg">
            {results.map((r) => (
              <button
                key={r.place_id}
                type="button"
                onClick={() => selectResult(r)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-start gap-2 border-b last:border-b-0"
              >
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Manual fields */}
      <Input
        placeholder="Rue et numéro"
        value={value?.street || ""}
        onChange={(e) => updateField("street", e.target.value)}
        disabled={disabled}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          placeholder="Code postal"
          value={value?.zip || ""}
          onChange={(e) => updateField("zip", e.target.value)}
          disabled={disabled}
        />
        <Input
          placeholder="Ville"
          value={value?.city || ""}
          onChange={(e) => updateField("city", e.target.value)}
          disabled={disabled}
        />
      </div>
      <Input
        placeholder="Pays"
        value={value?.country || ""}
        onChange={(e) => updateField("country", e.target.value)}
        disabled={disabled}
      />

      {/* Map */}
      {showMap && (
        <div
          className={cn(
            "rounded-md overflow-hidden border transition-all",
            mapUrl ? "h-48" : "h-24 bg-muted/30 flex items-center justify-center",
          )}
        >
          {mapUrl ? (
            <iframe
              title="Carte"
              src={mapUrl}
              className="w-full h-full border-0"
              loading="lazy"
            />
          ) : (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Sélectionne une adresse pour afficher la carte
            </div>
          )}
        </div>
      )}
      {value?.lat !== undefined && value?.lng !== undefined && (
        <p className="text-[10px] text-muted-foreground text-right font-mono">
          {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
