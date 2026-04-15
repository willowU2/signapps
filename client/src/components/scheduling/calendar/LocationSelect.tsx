"use client";

/**
 * LocationSelect Component
 *
 * Enhanced location input with suggestions from resources and recent locations.
 */

import * as React from "react";
import { MapPin, Building, Video, ExternalLink, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type {
  EventLocation,
  Resource,
} from "@/lib/scheduling/types/scheduling";

// ============================================================================
// Types
// ============================================================================

interface LocationSelectProps {
  value?: EventLocation;
  onChange: (location: EventLocation | undefined) => void;
  resources?: Resource[];
  recentLocations?: string[];
  placeholder?: string;
  className?: string;
}

interface LocationSuggestion {
  type: "resource" | "recent" | "virtual";
  name: string;
  address?: string;
  resourceId?: string;
  meetingUrl?: string;
  icon: React.ElementType;
}

// ============================================================================
// Constants
// ============================================================================

const VIRTUAL_MEETING_OPTIONS: LocationSuggestion[] = [
  {
    type: "virtual",
    name: "Visioconférence",
    meetingUrl: "",
    icon: Video,
  },
];

const RECENT_LOCATIONS_KEY = "scheduling_recent_locations";

// ============================================================================
// Helpers
// ============================================================================

function getStoredRecentLocations(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(RECENT_LOCATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveRecentLocation(location: string): void {
  if (typeof window === "undefined" || !location.trim()) return;
  try {
    const recent = getStoredRecentLocations();
    const filtered = recent.filter((l) => l !== location);
    const updated = [location, ...filtered].slice(0, 10);
    localStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Component
// ============================================================================

export function LocationSelect({
  value,
  onChange,
  resources = [],
  recentLocations: propRecentLocations,
  placeholder = "Ajouter un lieu ou un lien de visio",
  className,
}: LocationSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value?.name || "");
  const [showMeetingUrlInput, setShowMeetingUrlInput] = React.useState(
    !!value?.meetingUrl,
  );

  // Get recent locations
  const recentLocations = React.useMemo(() => {
    if (propRecentLocations) return propRecentLocations;
    return getStoredRecentLocations();
  }, [propRecentLocations]);

  // Build suggestions
  const suggestions = React.useMemo(() => {
    const result: LocationSuggestion[] = [];

    // Add room resources
    const rooms = resources.filter((r) => r.type === "room");
    rooms.forEach((room) => {
      result.push({
        type: "resource",
        name: room.name,
        address: room.location,
        resourceId: room.id,
        icon: Building,
      });
    });

    // Add recent locations
    recentLocations
      .filter((loc) => !rooms.some((r) => r.name === loc))
      .slice(0, 5)
      .forEach((loc) => {
        result.push({
          type: "recent",
          name: loc,
          icon: MapPin,
        });
      });

    // Add virtual option
    result.push(...VIRTUAL_MEETING_OPTIONS);

    return result;
  }, [resources, recentLocations]);

  // Filter suggestions based on input
  const filteredSuggestions = React.useMemo(() => {
    if (!inputValue.trim()) return suggestions;
    const search = inputValue.toLowerCase();
    return suggestions.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        s.address?.toLowerCase().includes(search),
    );
  }, [suggestions, inputValue]);

  // Handle selection
  const handleSelect = (suggestion: LocationSuggestion) => {
    if (suggestion.type === "virtual") {
      setShowMeetingUrlInput(true);
      onChange({
        name: "Visioconférence",
        meetingUrl: "",
      });
    } else {
      const location: EventLocation = {
        name: suggestion.name,
        address: suggestion.address,
        resourceId: suggestion.resourceId,
      };
      onChange(location);
      saveRecentLocation(suggestion.name);
    }
    setInputValue(suggestion.name);
    setOpen(false);
  };

  // Handle manual input
  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    if (newValue.trim()) {
      onChange({
        name: newValue,
        meetingUrl: value?.meetingUrl,
      });
    } else {
      onChange(undefined);
    }
  };

  // Handle meeting URL
  const handleMeetingUrlChange = (url: string) => {
    onChange({
      ...value,
      name: value?.name || "Visioconférence",
      meetingUrl: url,
    });
  };

  // Handle clear
  const handleClear = () => {
    setInputValue("");
    setShowMeetingUrlInput(false);
    onChange(undefined);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              className="pl-9 pr-9"
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Rechercher un lieu..."
              value={inputValue}
              onValueChange={handleInputChange}
            />
            <CommandList>
              <CommandEmpty>
                <div className="py-6 text-center text-sm">
                  <p className="text-muted-foreground">Aucun lieu trouvé</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Appuyez sur Entrée pour utiliser "{inputValue}"
                  </p>
                </div>
              </CommandEmpty>

              {/* Rooms */}
              {filteredSuggestions.filter((s) => s.type === "resource").length >
                0 && (
                <CommandGroup heading="Salles">
                  {filteredSuggestions
                    .filter((s) => s.type === "resource")
                    .map((suggestion) => (
                      <CommandItem
                        key={suggestion.resourceId}
                        onSelect={() => handleSelect(suggestion)}
                        className="flex items-center gap-2"
                      >
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1">
                          <span>{suggestion.name}</span>
                          {suggestion.address && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {suggestion.address}
                            </span>
                          )}
                        </div>
                        {value?.resourceId === suggestion.resourceId && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </CommandItem>
                    ))}
                </CommandGroup>
              )}

              {/* Recent */}
              {filteredSuggestions.filter((s) => s.type === "recent").length >
                0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Récents">
                    {filteredSuggestions
                      .filter((s) => s.type === "recent")
                      .map((suggestion) => (
                        <CommandItem
                          key={suggestion.name}
                          onSelect={() => handleSelect(suggestion)}
                          className="flex items-center gap-2"
                        >
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1">{suggestion.name}</span>
                          {value?.name === suggestion.name && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </>
              )}

              {/* Virtual */}
              <CommandSeparator />
              <CommandGroup heading="Virtuel">
                {filteredSuggestions
                  .filter((s) => s.type === "virtual")
                  .map((suggestion) => (
                    <CommandItem
                      key={suggestion.name}
                      onSelect={() => handleSelect(suggestion)}
                      className="flex items-center gap-2"
                    >
                      <Video className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">{suggestion.name}</span>
                      <Badge variant="outline" className="text-xs">
                        Lien
                      </Badge>
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Meeting URL input */}
      {showMeetingUrlInput && (
        <div className="relative">
          <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="url"
            value={value?.meetingUrl || ""}
            onChange={(e) => handleMeetingUrlChange(e.target.value)}
            placeholder="https://meet.example.com/..."
            className="pl-9"
          />
        </div>
      )}

      {/* Selected resource badge */}
      {value?.resourceId && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Building className="h-3 w-3" />
            Salle réservée
          </Badge>
        </div>
      )}
    </div>
  );
}

export default LocationSelect;
