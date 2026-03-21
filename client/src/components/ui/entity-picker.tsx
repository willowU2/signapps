import { SpinnerInfinity } from 'spinners-react';
/**
 * Entity Picker Component
 *
 * Permet la sélection facile d'entités liées avec recherche fuzzy,
 * support multi-select et affichage d'avatars.
 */

"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X, User, File, Calendar, FileText, CheckSquare } from 'lucide-react';

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export type EntityType = "user" | "file" | "task" | "event" | "document" | "group" | "role" | "custom";

export interface EntityOption {
  /** Unique entity ID */
  id: string;
  /** Display name */
  name: string;
  /** Optional description/subtitle */
  description?: string;
  /** Avatar URL (for users) */
  avatarUrl?: string;
  /** Icon name (for files, etc.) */
  icon?: string;
  /** Entity type */
  type?: EntityType;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Disabled state */
  disabled?: boolean;
}

export interface EntityPickerProps {
  /** Entity type for styling and icons */
  entityType: EntityType;
  /** Current selected value(s) */
  value: string | string[] | null;
  /** Change handler */
  onChange: (value: string | string[] | null) => void;
  /** Allow multiple selection */
  multiple?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Static options (for small lists) */
  options?: EntityOption[];
  /** Async search function */
  onSearch?: (query: string) => Promise<EntityOption[]>;
  /** Async load function for initial/selected values */
  onLoad?: (ids: string[]) => Promise<EntityOption[]>;
  /** Disabled state */
  disabled?: boolean;
  /** Max items to show in multi-select */
  maxDisplayItems?: number;
  /** Custom class name */
  className?: string;
  /** Error state */
  error?: boolean;
  /** Create new option callback */
  onCreate?: (name: string) => Promise<EntityOption | null>;
  /** Show create option */
  showCreate?: boolean;
}

// ============================================================================
// Entity Icons
// ============================================================================

const entityIcons: Record<EntityType, React.ReactNode> = {
  user: <User className="h-4 w-4" />,
  file: <File className="h-4 w-4" />,
  task: <CheckSquare className="h-4 w-4" />,
  event: <Calendar className="h-4 w-4" />,
  document: <FileText className="h-4 w-4" />,
  group: <User className="h-4 w-4" />,
  role: <User className="h-4 w-4" />,
  custom: null,
};

// ============================================================================
// Entity Chip
// ============================================================================

interface EntityChipProps {
  entity: EntityOption;
  entityType: EntityType;
  onRemove?: () => void;
  disabled?: boolean;
}

export function EntityChip({ entity, entityType, onRemove, disabled }: EntityChipProps) {
  return (
    <Badge variant="secondary" className="flex items-center gap-1.5 pr-1 max-w-[150px]">
      {entityType === "user" ? (
        <Avatar className="h-4 w-4">
          <AvatarImage src={entity.avatarUrl} alt={entity.name} />
          <AvatarFallback className="text-[8px]">
            {entity.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : (
        entityIcons[entityType]
      )}
      <span className="truncate text-xs">{entity.name}</span>
      {onRemove && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}

// ============================================================================
// Entity Option Item
// ============================================================================

interface EntityOptionItemProps {
  entity: EntityOption;
  entityType: EntityType;
  isSelected: boolean;
  onSelect: () => void;
}

function EntityOptionItem({ entity, entityType, isSelected, onSelect }: EntityOptionItemProps) {
  return (
    <CommandItem
      value={entity.id}
      onSelect={onSelect}
      disabled={entity.disabled}
      className="flex items-center gap-3 cursor-pointer"
    >
      <Check
        className={cn("h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
      />

      {entityType === "user" ? (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={entity.avatarUrl} alt={entity.name} />
          <AvatarFallback>
            {entity.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
          {entityIcons[entityType]}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{entity.name}</p>
        {entity.description && (
          <p className="text-xs text-muted-foreground truncate">{entity.description}</p>
        )}
      </div>
    </CommandItem>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function EntityPicker({
  entityType,
  value,
  onChange,
  multiple = false,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  options: staticOptions,
  onSearch,
  onLoad,
  disabled,
  maxDisplayItems = 3,
  className,
  error,
  onCreate,
  showCreate,
}: EntityPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<EntityOption[]>([]);
  const [selectedEntities, setSelectedEntities] = React.useState<EntityOption[]>([]);
  const [isCreating, setIsCreating] = React.useState(false);

  // Normalize value to array
  const selectedIds = React.useMemo(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  // Load selected entities on mount or value change
  React.useEffect(() => {
    const loadSelectedEntities = async () => {
      if (selectedIds.length === 0) {
        setSelectedEntities([]);
        return;
      }

      // Check if we already have all selected entities
      const existingIds = new Set(selectedEntities.map((e) => e.id));
      const missingIds = selectedIds.filter((id) => !existingIds.has(id));

      if (missingIds.length === 0) {
        // Filter out any entities that are no longer selected
        setSelectedEntities((prev) => prev.filter((e) => selectedIds.includes(e.id)));
        return;
      }

      // Try to find in static options first
      if (staticOptions) {
        const fromStatic = staticOptions.filter((o) => selectedIds.includes(o.id));
        if (fromStatic.length === selectedIds.length) {
          setSelectedEntities(fromStatic);
          return;
        }
      }

      // Load from backend
      if (onLoad) {
        try {
          const loaded = await onLoad(missingIds);
          setSelectedEntities((prev) => {
            const combined = [...prev.filter((e) => selectedIds.includes(e.id)), ...loaded];
            // Dedupe
            const seen = new Set<string>();
            return combined.filter((e) => {
              if (seen.has(e.id)) return false;
              seen.add(e.id);
              return true;
            });
          });
        } catch (error) {
          console.error("Failed to load selected entities:", error);
        }
      }
    };

    loadSelectedEntities();
  }, [selectedIds, staticOptions, onLoad]);

  // Search effect
  React.useEffect(() => {
    const search = async () => {
      if (!debouncedQuery && staticOptions) {
        setSearchResults(staticOptions);
        return;
      }

      if (!onSearch) {
        // Filter static options
        if (staticOptions) {
          const filtered = staticOptions.filter((o) =>
            o.name.toLowerCase().includes(debouncedQuery.toLowerCase())
          );
          setSearchResults(filtered);
        }
        return;
      }

      setIsSearching(true);
      try {
        const results = await onSearch(debouncedQuery);
        setSearchResults(results);
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    search();
  }, [debouncedQuery, staticOptions, onSearch]);

  // Initialize with static options
  React.useEffect(() => {
    if (staticOptions && searchResults.length === 0 && !debouncedQuery) {
      setSearchResults(staticOptions);
    }
  }, [staticOptions, searchResults.length, debouncedQuery]);

  // Handle selection
  const handleSelect = (entity: EntityOption) => {
    if (multiple) {
      const isSelected = selectedIds.includes(entity.id);
      if (isSelected) {
        const newIds = selectedIds.filter((id) => id !== entity.id);
        onChange(newIds.length > 0 ? newIds : null);
      } else {
        onChange([...selectedIds, entity.id]);
      }
    } else {
      onChange(entity.id);
      setOpen(false);
    }
  };

  // Handle remove
  const handleRemove = (entityId: string) => {
    if (multiple) {
      const newIds = selectedIds.filter((id) => id !== entityId);
      onChange(newIds.length > 0 ? newIds : null);
    } else {
      onChange(null);
    }
  };

  // Handle create
  const handleCreate = async () => {
    if (!onCreate || !searchQuery.trim()) return;

    setIsCreating(true);
    try {
      const newEntity = await onCreate(searchQuery.trim());
      if (newEntity) {
        handleSelect(newEntity);
        setSearchQuery("");
      }
    } catch (error) {
      console.error("Failed to create entity:", error);
    } finally {
      setIsCreating(false);
    }
  };

  // Get display text
  const getDisplayText = () => {
    if (selectedEntities.length === 0) {
      return placeholder ?? `Sélectionner ${entityType === "user" ? "un utilisateur" : "un élément"}...`;
    }

    if (!multiple) {
      return selectedEntities[0]?.name ?? "";
    }

    return null; // Will show chips instead
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal min-h-10",
            !selectedEntities.length && "text-muted-foreground",
            error && "border-destructive",
            className
          )}
        >
          {multiple && selectedEntities.length > 0 ? (
            <div className="flex flex-wrap gap-1 py-0.5">
              {selectedEntities.slice(0, maxDisplayItems).map((entity) => (
                <EntityChip
                  key={entity.id}
                  entity={entity}
                  entityType={entityType}
                  onRemove={() => handleRemove(entity.id)}
                  disabled={disabled}
                />
              ))}
              {selectedEntities.length > maxDisplayItems && (
                <Badge variant="secondary" className="text-xs">
                  +{selectedEntities.length - maxDisplayItems}
                </Badge>
              )}
            </div>
          ) : (
            <span className="truncate">{getDisplayText()}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder ?? "Rechercher..."}
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isSearching && (
              <div className="flex items-center justify-center py-6">
                <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="h-4 w-4 " />
              </div>
            )}

            {!isSearching && searchResults.length === 0 && (
              <CommandEmpty>
                <div className="py-6 text-center text-sm">
                  {emptyMessage ?? "Aucun résultat."}
                  {showCreate && onCreate && searchQuery && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-2"
                      onClick={handleCreate}
                      disabled={isCreating}
                    >
                      {isCreating ? (
                        <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-2 h-4 w-4 " />
                      ) : null}
                      Créer "{searchQuery}"
                    </Button>
                  )}
                </div>
              </CommandEmpty>
            )}

            {!isSearching && searchResults.length > 0 && (
              <CommandGroup>
                {searchResults.map((entity) => (
                  <EntityOptionItem
                    key={entity.id}
                    entity={entity}
                    entityType={entityType}
                    isSelected={selectedIds.includes(entity.id)}
                    onSelect={() => handleSelect(entity)}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Preset Pickers
// ============================================================================

export interface UserPickerProps extends Omit<EntityPickerProps, "entityType"> {}

export function UserPicker(props: UserPickerProps) {
  return (
    <EntityPicker
      {...props}
      entityType="user"
      placeholder={props.placeholder ?? "Sélectionner un utilisateur..."}
      searchPlaceholder={props.searchPlaceholder ?? "Rechercher un utilisateur..."}
    />
  );
}

export interface FilePickerProps extends Omit<EntityPickerProps, "entityType"> {}

export function FilePicker(props: FilePickerProps) {
  return (
    <EntityPicker
      {...props}
      entityType="file"
      placeholder={props.placeholder ?? "Sélectionner un fichier..."}
      searchPlaceholder={props.searchPlaceholder ?? "Rechercher un fichier..."}
    />
  );
}

export interface TaskPickerProps extends Omit<EntityPickerProps, "entityType"> {}

export function TaskPicker(props: TaskPickerProps) {
  return (
    <EntityPicker
      {...props}
      entityType="task"
      placeholder={props.placeholder ?? "Sélectionner une tâche..."}
      searchPlaceholder={props.searchPlaceholder ?? "Rechercher une tâche..."}
    />
  );
}
