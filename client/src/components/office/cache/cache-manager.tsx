"use client";

import { SpinnerInfinity } from "spinners-react";

/**
 * CacheManager
 *
 * Component for managing and monitoring office cache.
 */

import React, { useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Database,
  Trash2,
  RefreshCw,
  Flame,
  Filter,
  MoreHorizontal,
  ChevronRight,
  HardDrive,
  Cloud,
  MemoryStick,
  FileText,
  Image,
  FileType,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useCacheStore } from "@/stores/cache-store";
import type {
  CacheEntry,
  CacheType,
  CacheLocation,
} from "@/lib/office/cache/types";
import {
  CACHE_TYPE_LABELS,
  CACHE_TYPE_COLORS,
  CACHE_LOCATION_LABELS,
} from "@/lib/office/cache/types";

// ============================================================================
// Helpers
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getLocationIcon(location: CacheLocation) {
  switch (location) {
    case "memory":
      return <MemoryStick className="h-4 w-4" />;
    case "disk":
      return <HardDrive className="h-4 w-4" />;
    case "cdn":
      return <Cloud className="h-4 w-4" />;
  }
}

function getTypeIcon(type: CacheType) {
  switch (type) {
    case "document_content":
    case "document_preview":
      return <FileText className="h-4 w-4" />;
    case "thumbnail":
    case "image":
      return <Image className="h-4 w-4" />;
    default:
      return <FileType className="h-4 w-4" />;
  }
}

// ============================================================================
// Cache Entry Item
// ============================================================================

interface CacheEntryItemProps {
  entry: CacheEntry;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function CacheEntryItem({
  entry,
  isSelected,
  onSelect,
  onDelete,
}: CacheEntryItemProps) {
  const isExpired = entry.expiresAt && new Date(entry.expiresAt) < new Date();

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-transparent hover:bg-muted/50",
        isExpired && "opacity-60",
      )}
      onClick={onSelect}
    >
      {/* Type Icon */}
      <div className="flex-shrink-0 text-muted-foreground">
        {getTypeIcon(entry.type)}
      </div>

      {/* Entry Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate text-sm">
            {entry.documentName || entry.key}
          </span>
          {isExpired && (
            <Badge variant="outline" className="text-xs text-orange-600">
              Expiré
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <Badge
            variant="secondary"
            className={cn("text-xs", CACHE_TYPE_COLORS[entry.type])}
          >
            {CACHE_TYPE_LABELS[entry.type]}
          </Badge>
          <span>·</span>
          <span className="flex items-center gap-1">
            {getLocationIcon(entry.location)}
            {CACHE_LOCATION_LABELS[entry.location]}
          </span>
          <span>·</span>
          <span>{formatBytes(entry.size)}</span>
        </div>
      </div>

      {/* Hit Count */}
      <div className="text-right">
        <p className="text-sm font-medium">{entry.hitCount}</p>
        <p className="text-xs text-muted-foreground">hits</p>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Plus d'actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface CacheManagerProps {
  className?: string;
}

export function CacheManager({ className }: CacheManagerProps) {
  const {
    entries,
    selectedEntry,
    totalEntries,
    hasMoreEntries,
    stats,
    isLoading,
    isInvalidating,
    isPrewarming,
    typeFilter,
    locationFilter,
    loadEntries,
    loadMoreEntries,
    refreshEntries,
    selectEntry,
    deleteEntry,
    invalidateCache,
    clearCache,
    prewarmCache,
    triggerCleanup,
    loadStats,
    setTypeFilter,
    setLocationFilter,
  } = useCacheStore();

  useEffect(() => {
    loadEntries();
    loadStats();
  }, [loadEntries, loadStats]);

  const typeOptions: Array<{ value: CacheType | "all"; label: string }> = [
    { value: "all", label: "Tous les types" },
    { value: "document_content", label: "Contenu document" },
    { value: "document_preview", label: "Aperçu" },
    { value: "export_result", label: "Export" },
    { value: "conversion_result", label: "Conversion" },
    { value: "thumbnail", label: "Miniature" },
    { value: "template", label: "Template" },
    { value: "font", label: "Police" },
    { value: "image", label: "Image" },
  ];

  const locationOptions: Array<{
    value: CacheLocation | "all";
    label: string;
  }> = [
    { value: "all", label: "Tous les emplacements" },
    { value: "memory", label: "Mémoire" },
    { value: "disk", label: "Disque" },
    { value: "cdn", label: "CDN" },
  ];

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          <div>
            <h2 className="font-semibold">Gestionnaire de cache</h2>
            <p className="text-xs text-muted-foreground">
              {totalEntries} entrée{totalEntries !== 1 ? "s" : ""}
              {stats &&
                ` · ${formatBytes(stats.totalSize)} / ${formatBytes(stats.maxSize)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => prewarmCache()}
            disabled={isPrewarming}
          >
            {isPrewarming ? (
              <SpinnerInfinity
                size={24}
                secondaryColor="rgba(128,128,128,0.2)"
                color="currentColor"
                speed={120}
                className="h-4 w-4  mr-2"
              />
            ) : (
              <Flame className="h-4 w-4 mr-2" />
            )}
            Préchauffer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={triggerCleanup}
            disabled={isInvalidating}
          >
            {isInvalidating ? (
              <SpinnerInfinity
                size={24}
                secondaryColor="rgba(128,128,128,0.2)"
                color="currentColor"
                speed={120}
                className="h-4 w-4  mr-2"
              />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Nettoyer
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Vider
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Vider le cache ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action supprimera toutes les entrées du cache. Les
                  documents devront être rechargés ou régénérés.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => clearCache()}>
                  Vider le cache
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center gap-4 mb-2">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-1">
                <span>Utilisation</span>
                <span className="font-medium">
                  {stats.usedPercentage.toFixed(1)}%
                </span>
              </div>
              <Progress
                value={stats.usedPercentage}
                className={cn(
                  "h-2",
                  stats.usedPercentage > 90 && "bg-red-100 [&>div]:bg-red-500",
                )}
              />
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="text-center">
              <p className="text-lg font-semibold">
                {stats.hitRate.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">Hit rate</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{stats.hitCount}</p>
              <p className="text-xs text-muted-foreground">Hits</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{stats.missCount}</p>
              <p className="text-xs text-muted-foreground">Miss</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 p-3 border-b">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          value={typeFilter ?? "all"}
          onValueChange={(value) =>
            setTypeFilter(value === "all" ? null : (value as CacheType))
          }
        >
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={locationFilter ?? "all"}
          onValueChange={(value) =>
            setLocationFilter(value === "all" ? null : (value as CacheLocation))
          }
        >
          <SelectTrigger className="w-[160px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locationOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={refreshEntries}
          disabled={isLoading}
          aria-label="Actualiser"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Entries List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {isLoading && entries.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <SpinnerInfinity
                size={24}
                secondaryColor="rgba(128,128,128,0.2)"
                color="currentColor"
                speed={120}
                className="h-8 w-8  text-muted-foreground"
              />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Database className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Cache vide</p>
            </div>
          ) : (
            <>
              {entries.map((entry) => (
                <CacheEntryItem
                  key={entry.key}
                  entry={entry}
                  isSelected={selectedEntry?.key === entry.key}
                  onSelect={() =>
                    selectEntry(selectedEntry?.key === entry.key ? null : entry)
                  }
                  onDelete={() => deleteEntry(entry.key)}
                />
              ))}

              {hasMoreEntries && (
                <div className="flex justify-center pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMoreEntries}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <SpinnerInfinity
                        size={24}
                        secondaryColor="rgba(128,128,128,0.2)"
                        color="currentColor"
                        speed={120}
                        className="h-4 w-4  mr-2"
                      />
                    ) : null}
                    Charger plus
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {stats && (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          <span>
            Dernier nettoyage:{" "}
            {formatDistanceToNow(new Date(stats.lastCleanup), {
              addSuffix: true,
              locale: fr,
            })}
          </span>
          <span>
            Temps d'accès moyen: {stats.averageAccessTime.toFixed(1)}ms
          </span>
        </div>
      )}
    </div>
  );
}

export default CacheManager;
