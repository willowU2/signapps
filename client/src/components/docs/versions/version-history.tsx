"use client";

import { useEffect } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  History,
  Star,
  StarOff,
  RotateCcw,
  Trash2,
  GitCompare,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useVersionsStore } from "@/stores/versions-store";
import {
  VERSION_TYPE_LABELS,
  VERSION_TYPE_COLORS,
  type DocumentVersion,
  type VersionType,
} from "@/lib/office/versions/types";

// ============================================================================
// Types
// ============================================================================

export interface VersionHistoryProps {
  documentId: string;
  onVersionSelect?: (version: DocumentVersion) => void;
  onCompare?: (sourceId: string, targetId: string) => void;
  onRestore?: (versionId: string) => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function VersionHistory({
  documentId,
  onVersionSelect,
  onCompare,
  onRestore,
  className,
}: VersionHistoryProps) {
  const {
    versions,
    totalVersions,
    isLoading,
    isLoadingMore,
    isRestoring,
    hasMore,
    typeFilter,
    starredOnly,
    selectedVersions,
    error,
    setDocumentId,
    fetchVersions,
    fetchMoreVersions,
    restoreVersion,
    deleteVersion,
    starVersion,
    unstarVersion,
    toggleVersionSelection,
    clearSelection,
    compareSelectedVersions,
    setTypeFilter,
    setStarredOnly,
  } = useVersionsStore();

  useEffect(() => {
    setDocumentId(documentId);
  }, [documentId, setDocumentId]);

  const handleRestore = async (versionId: string) => {
    const success = await restoreVersion(versionId);
    if (success) {
      onRestore?.(versionId);
    }
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      compareSelectedVersions();
      onCompare?.(selectedVersions[0], selectedVersions[1]);
    }
  };

  return (
    <div
      className={cn("flex flex-col h-full bg-background border-l", className)}
    >
      {/* Header */}
      <div className="p-4 border-b space-y-3 shrink-0">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5" />
          <span className="font-semibold">Historique des versions</span>
          <Badge variant="secondary">{totalVersions}</Badge>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as VersionType | "all")}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="manual">Manuelles</SelectItem>
              <SelectItem value="restore">Restaurations</SelectItem>
              <SelectItem value="publish">Publications</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={starredOnly ? "default" : "outline"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setStarredOnly(!starredOnly)}
          >
            <Star className="h-3 w-3" />
          </Button>
        </div>

        {/* Compare action */}
        {selectedVersions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {selectedVersions.length}/2 selectionnees
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              disabled={selectedVersions.length !== 2}
              onClick={handleCompare}
            >
              <GitCompare className="h-3 w-3" />
              Comparer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={clearSelection}
            >
              Annuler
            </Button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 mx-4 mt-2 bg-destructive/10 text-destructive text-sm rounded-md">
          {error}
        </div>
      )}

      {/* Versions List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading && versions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Aucune version</p>
            </div>
          ) : (
            <>
              {versions.map((version) => (
                <VersionItem
                  key={version.id}
                  version={version}
                  isSelected={selectedVersions.includes(version.id)}
                  isRestoring={isRestoring}
                  onSelect={() => onVersionSelect?.(version)}
                  onToggleSelection={() => toggleVersionSelection(version.id)}
                  onRestore={() => handleRestore(version.id)}
                  onDelete={() => deleteVersion(version.id)}
                  onStar={() => starVersion(version.id)}
                  onUnstar={() => unstarVersion(version.id)}
                />
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="pt-2 pb-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs gap-1"
                    onClick={fetchMoreVersions}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    Charger plus
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// VersionItem sub-component
// ============================================================================

interface VersionItemProps {
  version: DocumentVersion;
  isSelected: boolean;
  isRestoring: boolean;
  onSelect: () => void;
  onToggleSelection: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onStar: () => void;
  onUnstar: () => void;
}

function VersionItem({
  version,
  isSelected,
  isRestoring,
  onSelect,
  onToggleSelection,
  onRestore,
  onDelete,
  onStar,
  onUnstar,
}: VersionItemProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 cursor-pointer transition-all hover:bg-muted/50",
        isSelected && "ring-2 ring-primary bg-primary/5",
        version.isCurrent && "border-primary/50",
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-2">
        {/* Selection checkbox */}
        <input
          type="checkbox"
          className="mt-1 shrink-0"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelection();
          }}
          onClick={(e) => e.stopPropagation()}
        />

        <Avatar className="h-7 w-7 shrink-0">
          <AvatarImage src={version.authorAvatar} />
          <AvatarFallback className="text-[10px]">
            {version.authorName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">
              {version.label || `v${version.versionNumber}`}
            </span>
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] h-5",
                VERSION_TYPE_COLORS[version.type],
              )}
            >
              {VERSION_TYPE_LABELS[version.type]}
            </Badge>
            {version.isCurrent && (
              <Badge variant="default" className="text-[10px] h-5">
                Actuelle
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">
              {version.authorName}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(version.createdAt), {
                addSuffix: true,
                locale: fr,
              })}
            </span>
          </div>

          {version.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {version.description}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
            {version.wordCount !== undefined && (
              <span>{version.wordCount} mots</span>
            )}
            <span>
              {format(new Date(version.createdAt), "dd/MM/yyyy HH:mm", {
                locale: fr,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-2 ml-9">
        {!version.isCurrent && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
            }}
            disabled={isRestoring}
          >
            {isRestoring ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            Restaurer
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            version.isStarred ? onUnstar() : onStar();
          }}
        >
          {version.isStarred ? (
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          ) : (
            <StarOff className="h-3 w-3" />
          )}
        </Button>

        {!version.isCurrent && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default VersionHistory;
