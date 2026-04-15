"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Star } from "lucide-react";
import { useFontsCatalog } from "@/lib/fonts/use-fonts-catalog";
import { ensureFontLoaded } from "@/lib/fonts/use-dynamic-font";

const RECENTS_KEY = "signapps_fonts_recent";
const FAVORITES_KEY = "signapps_fonts_favorites";
const MAX_RECENTS = 10;

function readArray(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}

function pushRecent(familyId: string) {
  const list = readArray(RECENTS_KEY).filter((id) => id !== familyId);
  list.unshift(familyId);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, MAX_RECENTS)));
}

interface Props {
  value?: string;
  onChange: (familyId: string) => void;
  onOpenBrowser: () => void;
}

export function FontPickerDropdown({ value, onChange, onOpenBrowser }: Props) {
  const { data: catalog } = useFontsCatalog();
  const [recents, setRecents] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setRecents(readArray(RECENTS_KEY));
    setFavorites(readArray(FAVORITES_KEY));
  }, []);

  const select = (id: string) => {
    pushRecent(id);
    setRecents(readArray(RECENTS_KEY));
    onChange(id);
  };

  const currentFamily = catalog?.families.find((f) => f.id === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-w-[180px] justify-between"
        >
          <span style={{ fontFamily: currentFamily?.name ?? "inherit" }}>
            {currentFamily?.name ?? value ?? "Police par défaut"}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 max-h-96 overflow-y-auto">
        {catalog && favorites.length > 0 && (
          <>
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
              Favoris
            </div>
            {favorites.map((id) => {
              const fam = catalog.families.find((f) => f.id === id);
              if (!fam) return null;
              return (
                <DropdownMenuItem
                  key={`fav-${id}`}
                  onMouseEnter={() => ensureFontLoaded(id, catalog)}
                  onClick={() => select(id)}
                  style={{ fontFamily: fam.name }}
                >
                  <Star className="h-3 w-3 mr-2 fill-current" />
                  {fam.name}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
          </>
        )}

        {catalog && recents.length > 0 && (
          <>
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
              Récents
            </div>
            {recents.map((id) => {
              const fam = catalog.families.find((f) => f.id === id);
              if (!fam) return null;
              return (
                <DropdownMenuItem
                  key={`rec-${id}`}
                  onMouseEnter={() => ensureFontLoaded(id, catalog)}
                  onClick={() => select(id)}
                  style={{ fontFamily: fam.name }}
                >
                  {fam.name}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onClick={onOpenBrowser}>
          Toutes les polices...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
