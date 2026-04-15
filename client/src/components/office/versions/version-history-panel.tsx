"use client";

import { SpinnerInfinity } from "spinners-react";

/**
 * VersionHistoryPanel
 *
 * Panel for viewing and managing document version history.
 */

import React, { useEffect, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  History,
  Star,
  Clock,
  User,
  MoreHorizontal,
  RotateCcw,
  Trash2,
  Edit2,
  Eye,
  GitCompare,
  Download,
  ChevronDown,
  Check,
  Filter,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useVersionsStore } from "@/stores/versions-store";
import type { DocumentVersion, VersionType } from "@/lib/office/versions/types";
import {
  VERSION_TYPE_LABELS,
  VERSION_TYPE_COLORS,
} from "@/lib/office/versions/types";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// Version Item Component
// ============================================================================

interface VersionItemProps {
  version: DocumentVersion;
  isSelected: boolean;
  onSelect: () => void;
  onStar: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onPreview: () => void;
  onEdit: () => void;
}

function VersionItem({
  version,
  isSelected,
  onSelect,
  onStar,
  onRestore,
  onDelete,
  onPreview,
  onEdit,
}: VersionItemProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg border transition-all",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-transparent hover:bg-muted/50",
        version.isCurrent && "ring-1 ring-green-500/30",
      )}
    >
      {/* Selection checkbox */}
      <Checkbox
        checked={isSelected}
        onCheckedChange={onSelect}
        className="mt-1"
      />

      {/* Version info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">v{version.versionNumber}</span>
          <Badge
            variant="secondary"
            className={cn("text-xs", VERSION_TYPE_COLORS[version.type])}
          >
            {VERSION_TYPE_LABELS[version.type]}
          </Badge>
          {version.isCurrent && (
            <Badge
              variant="secondary"
              className="bg-green-100 text-green-800 text-xs"
            >
              <Check className="mr-1 h-3 w-3" />
              Actuelle
            </Badge>
          )}
          {version.isStarred && (
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          )}
        </div>

        {/* Label */}
        {version.label && (
          <div className="text-sm font-medium mt-1">{version.label}</div>
        )}

        {/* Description */}
        {version.description && (
          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
            {version.description}
          </p>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Avatar className="h-4 w-4">
              <AvatarImage src={version.authorAvatar} />
              <AvatarFallback className="text-[8px]">
                {version.authorName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span>{version.authorName}</span>
          </div>
          <span>·</span>
          <span>
            {formatDistanceToNow(new Date(version.createdAt), {
              addSuffix: true,
              locale: fr,
            })}
          </span>
          {version.wordCount && (
            <>
              <span>·</span>
              <span>{version.wordCount} mots</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onStar}
        >
          <Star
            className={cn(
              "h-4 w-4",
              version.isStarred && "fill-amber-400 text-amber-400",
            )}
          />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onPreview}>
              <Eye className="mr-2 h-4 w-4" />
              Aperçu
            </DropdownMenuItem>
            {!version.isCurrent && (
              <DropdownMenuItem onClick={onRestore}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Restaurer cette version
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              Modifier les infos
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Panel Component
// ============================================================================

interface VersionHistoryPanelProps {
  documentId: string;
  onRestore?: (version: DocumentVersion) => void;
  onCompare?: () => void;
  className?: string;
}

export function VersionHistoryPanel({
  documentId,
  onRestore,
  onCompare,
  className,
}: VersionHistoryPanelProps) {
  const {
    versions,
    selectedVersions,
    isLoading,
    isLoadingMore,
    isCreating,
    isRestoring,
    hasMore,
    typeFilter,
    starredOnly,
    error,
    setDocumentId,
    fetchMoreVersions,
    createVersion,
    restoreVersion,
    deleteVersion,
    starVersion,
    unstarVersion,
    toggleVersionSelection,
    clearSelection,
    compareSelectedVersions,
    updateVersionMetadata,
    setTypeFilter,
    setStarredOnly,
    loadVersionPreview,
  } = useVersionsStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLabel, setCreateLabel] = useState("");
  const [showRestoreDialog, setShowRestoreDialog] = useState<string | null>(
    null,
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState<DocumentVersion | null>(
    null,
  );
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Initialize
  useEffect(() => {
    setDocumentId(documentId);
  }, [documentId, setDocumentId]);

  const handleCreateVersion = async () => {
    await createVersion(createLabel || undefined);
    setCreateLabel("");
    setShowCreateDialog(false);
  };

  const handleRestore = async () => {
    if (!showRestoreDialog) return;
    const success = await restoreVersion(showRestoreDialog, true);
    if (success) {
      const version = versions.find((v) => v.id === showRestoreDialog);
      if (version && onRestore) {
        onRestore(version);
      }
    }
    setShowRestoreDialog(null);
  };

  const handleDelete = async () => {
    if (!showDeleteDialog) return;
    await deleteVersion(showDeleteDialog);
    setShowDeleteDialog(null);
  };

  const handleEditVersion = async () => {
    if (!showEditDialog) return;
    setIsUpdating(true);
    await updateVersionMetadata(showEditDialog.id, {
      label: editLabel || undefined,
      description: editDescription || undefined,
    });
    setIsUpdating(false);
    setShowEditDialog(null);
  };

  const handleCompare = () => {
    compareSelectedVersions();
    if (onCompare) {
      onCompare();
    }
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5" />
          <h2 className="font-semibold">Historique</h2>
          <Badge variant="secondary">{versions.length}</Badge>
        </div>
        <Button
          size="sm"
          onClick={() => setShowCreateDialog(true)}
          disabled={isCreating}
        >
          {isCreating ? (
            <SpinnerInfinity
              size={24}
              secondaryColor="rgba(128,128,128,0.2)"
              color="currentColor"
              speed={120}
              className="mr-2 h-4 w-4 "
            />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Créer une version
        </Button>
      </div>

      {/* Selection actions */}
      {selectedVersions.length > 0 && (
        <div className="flex items-center justify-between bg-muted/50 px-4 py-2 border-b">
          <span className="text-sm">
            {selectedVersions.length} version
            {selectedVersions.length > 1 ? "s" : ""} sélectionnée
            {selectedVersions.length > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            {selectedVersions.length === 2 && (
              <Button size="sm" variant="outline" onClick={handleCompare}>
                <GitCompare className="mr-2 h-4 w-4" />
                Comparer
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 p-3 border-b">
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as VersionType | "all")}
        >
          <SelectTrigger className="h-8 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="manual">Manuelles</SelectItem>
            <SelectItem value="auto">Automatiques</SelectItem>
            <SelectItem value="restore">Restaurations</SelectItem>
            <SelectItem value="publish">Publications</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={starredOnly ? "secondary" : "ghost"}
          size="sm"
          className="h-8"
          onClick={() => setStarredOnly(!starredOnly)}
        >
          <Star
            className={cn(
              "h-4 w-4 mr-1",
              starredOnly && "fill-amber-400 text-amber-400",
            )}
          />
          Favorites
        </Button>
      </div>

      {/* Versions List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <SpinnerInfinity
                size={24}
                secondaryColor="rgba(128,128,128,0.2)"
                color="currentColor"
                speed={120}
                className="h-8 w-8  text-muted-foreground"
              />
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Aucune version</p>
            </div>
          ) : (
            <>
              <AnimatePresence mode="popLayout">
                {versions.map((version) => (
                  <VersionItem
                    key={version.id}
                    version={version}
                    isSelected={selectedVersions.includes(version.id)}
                    onSelect={() => toggleVersionSelection(version.id)}
                    onStar={() =>
                      version.isStarred
                        ? unstarVersion(version.id)
                        : starVersion(version.id)
                    }
                    onRestore={() => setShowRestoreDialog(version.id)}
                    onDelete={() => setShowDeleteDialog(version.id)}
                    onPreview={() => loadVersionPreview(version.id)}
                    onEdit={() => {
                      setEditLabel(version.label || "");
                      setEditDescription(version.description || "");
                      setShowEditDialog(version);
                    }}
                  />
                ))}
              </AnimatePresence>

              {hasMore && (
                <div className="flex justify-center pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchMoreVersions}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <SpinnerInfinity
                        size={24}
                        secondaryColor="rgba(128,128,128,0.2)"
                        color="currentColor"
                        speed={120}
                        className="h-4 w-4  mr-2"
                      />
                    ) : (
                      <ChevronDown className="h-4 w-4 mr-2" />
                    )}
                    Charger plus
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Create Version Dialog */}
      <AlertDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Créer une version</AlertDialogTitle>
            <AlertDialogDescription>
              Créez une version nommée pour marquer un état important du
              document.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nom de la version (optionnel)"
              value={createLabel}
              onChange={(e) => setCreateLabel(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateVersion}>
              Créer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog
        open={!!showRestoreDialog}
        onOpenChange={() => setShowRestoreDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurer cette version ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le document sera restauré à cette version. Une copie de sauvegarde
              de la version actuelle sera créée automatiquement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={isRestoring}>
              {isRestoring ? (
                <SpinnerInfinity
                  size={24}
                  secondaryColor="rgba(128,128,128,0.2)"
                  color="currentColor"
                  speed={120}
                  className="h-4 w-4  mr-2"
                />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Restaurer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!showDeleteDialog}
        onOpenChange={() => setShowDeleteDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette version ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La version sera définitivement
              supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Version Dialog */}
      <AlertDialog
        open={!!showEditDialog}
        onOpenChange={(open) => !open && setShowEditDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modifier les informations</AlertDialogTitle>
            <AlertDialogDescription>
              Modifiez le nom ou la description de cette version.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom de la version</label>
              <Input
                placeholder="Ex: Version finale"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                placeholder="Description optionnelle"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEditVersion}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <SpinnerInfinity
                  size={24}
                  secondaryColor="rgba(128,128,128,0.2)"
                  color="currentColor"
                  speed={120}
                  className="h-4 w-4  mr-2"
                />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Enregistrer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default VersionHistoryPanel;
