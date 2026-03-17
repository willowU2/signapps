/**
 * Universal Blocks System - Linking
 *
 * Composants pour gérer les liaisons entre blocs.
 */

"use client";

import * as React from "react";
import { Link2, Plus, X, ExternalLink, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { UniversalBlock, LinkedBlock, LinkType, BlockType } from "./types";
import { BlockInline, BlockRow } from "./renderers";
import { getBlockTypeInfo } from "./registry";
import { EntityPicker } from "@/components/ui/entity-picker";

// ============================================================================
// Link Type Labels
// ============================================================================

const linkTypeLabels: Record<LinkType, string> = {
  reference: "Référence",
  parent: "Parent",
  child: "Enfant",
  assignee: "Assigné à",
  owner: "Propriétaire",
  attachment: "Pièce jointe",
  mention: "Mention",
  related: "Lié à",
};

// ============================================================================
// Linked Blocks List
// ============================================================================

export interface LinkedBlocksListProps {
  /** Current block */
  block: UniversalBlock;
  /** Function to resolve linked blocks */
  resolveBlock: (id: string, type: BlockType) => Promise<UniversalBlock | null>;
  /** Click handler for linked blocks */
  onBlockClick?: (block: UniversalBlock) => void;
  /** Add link handler */
  onAddLink?: (linkType: LinkType, targetId: string, targetType: BlockType) => Promise<void>;
  /** Remove link handler */
  onRemoveLink?: (linkId: string) => Promise<void>;
  /** Show add button */
  showAddButton?: boolean;
  /** Allow editing */
  editable?: boolean;
  /** Custom class name */
  className?: string;
}

export function LinkedBlocksList({
  block,
  resolveBlock,
  onBlockClick,
  onAddLink,
  onRemoveLink,
  showAddButton = true,
  editable = true,
  className,
}: LinkedBlocksListProps) {
  const [resolvedBlocks, setResolvedBlocks] = React.useState<Map<string, UniversalBlock>>(
    new Map()
  );
  const [loading, setLoading] = React.useState(true);
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);

  // Resolve linked blocks
  React.useEffect(() => {
    const resolveAll = async () => {
      if (!block.linkedBlocks || block.linkedBlocks.length === 0) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const resolved = new Map<string, UniversalBlock>();

      await Promise.all(
        block.linkedBlocks.map(async (link) => {
          try {
            const resolvedBlock = await resolveBlock(link.blockId, link.blockType);
            if (resolvedBlock) {
              resolved.set(link.blockId, resolvedBlock);
            }
          } catch (error) {
            console.error(`Failed to resolve block ${link.blockId}:`, error);
          }
        })
      );

      setResolvedBlocks(resolved);
      setLoading(false);
    };

    resolveAll();
  }, [block.linkedBlocks, resolveBlock]);

  // Group links by type
  const groupedLinks = React.useMemo(() => {
    if (!block.linkedBlocks) return new Map<LinkType, LinkedBlock[]>();

    const groups = new Map<LinkType, LinkedBlock[]>();
    block.linkedBlocks.forEach((link) => {
      const existing = groups.get(link.linkType) || [];
      groups.set(link.linkType, [...existing, link]);
    });
    return groups;
  }, [block.linkedBlocks]);

  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-8 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!block.linkedBlocks || block.linkedBlocks.length === 0) {
    return (
      <div className={cn("text-center py-6", className)}>
        <Link2 className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">Aucun lien</p>
        {showAddButton && editable && onAddLink && (
          <AddLinkDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            onAddLink={onAddLink}
            excludeIds={[block.id]}
          >
            <Button variant="outline" size="sm" className="mt-3">
              <Plus className="h-4 w-4 mr-1" />
              Ajouter un lien
            </Button>
          </AddLinkDialog>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {Array.from(groupedLinks.entries()).map(([linkType, links]) => (
        <div key={linkType} className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <ChevronRight className="h-4 w-4" />
            {linkTypeLabels[linkType]}
            <Badge variant="secondary" className="text-xs">
              {links.length}
            </Badge>
          </h4>
          <div className="space-y-1 pl-6">
            {links.map((link) => {
              const linkedBlock = resolvedBlocks.get(link.blockId);
              if (!linkedBlock) return null;

              return (
                <div
                  key={link.blockId}
                  className="group flex items-center gap-2"
                >
                  <BlockRow
                    block={linkedBlock}
                    onClick={onBlockClick}
                    showActions={false}
                    compact
                    className="flex-1"
                  />
                  {editable && onRemoveLink && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer le lien ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action supprimera le lien vers "{linkedBlock.title}".
                            L'élément lui-même ne sera pas supprimé.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onRemoveLink(link.blockId)}
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {showAddButton && editable && onAddLink && (
        <AddLinkDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onAddLink={onAddLink}
          excludeIds={[block.id, ...(block.linkedBlocks?.map((l) => l.blockId) || [])]}
        >
          <Button variant="outline" size="sm" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un lien
          </Button>
        </AddLinkDialog>
      )}
    </div>
  );
}

// ============================================================================
// Add Link Dialog
// ============================================================================

interface AddLinkDialogProps {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddLink: (linkType: LinkType, targetId: string, targetType: BlockType) => Promise<void>;
  excludeIds?: string[];
}

function AddLinkDialog({
  children,
  open,
  onOpenChange,
  onAddLink,
  excludeIds = [],
}: AddLinkDialogProps) {
  const [linkType, setLinkType] = React.useState<LinkType>("related");
  const [targetType, setTargetType] = React.useState<BlockType>("file");
  const [targetId, setTargetId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    if (!targetId) return;

    setIsSubmitting(true);
    try {
      await onAddLink(linkType, targetId, targetType);
      onOpenChange(false);
      // Reset form
      setLinkType("related");
      setTargetId(null);
    } catch (error) {
      console.error("Failed to add link:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const entityTypeMap: Record<BlockType, "user" | "file" | "task" | "event" | "document"> = {
    user: "user",
    file: "file",
    folder: "file",
    task: "task",
    event: "event",
    document: "document",
    group: "user",
    role: "user",
    container: "file",
    custom: "file",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un lien</DialogTitle>
          <DialogDescription>
            Créez un lien vers un autre élément de la plateforme.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Type de lien</label>
            <Select
              value={linkType}
              onValueChange={(v) => setLinkType(v as LinkType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(linkTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type d'élément</label>
            <Select
              value={targetType}
              onValueChange={(v) => {
                setTargetType(v as BlockType);
                setTargetId(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Utilisateur</SelectItem>
                <SelectItem value="file">Fichier</SelectItem>
                <SelectItem value="task">Tâche</SelectItem>
                <SelectItem value="event">Événement</SelectItem>
                <SelectItem value="document">Document</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Élément</label>
            <EntityPicker
              entityType={entityTypeMap[targetType] || "file"}
              value={targetId}
              onChange={(v) => setTargetId(v as string | null)}
              placeholder="Rechercher..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!targetId || isSubmitting}
          >
            {isSubmitting ? "Ajout..." : "Ajouter"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Inline Link Inserter (for editors)
// ============================================================================

export interface InlineLinkInserterProps {
  onInsert: (block: UniversalBlock) => void;
  trigger?: React.ReactNode;
  className?: string;
}

export function InlineLinkInserter({
  onInsert,
  trigger,
  className,
}: InlineLinkInserterProps) {
  const [open, setOpen] = React.useState(false);
  const [targetType, setTargetType] = React.useState<BlockType>("file");
  const [targetId, setTargetId] = React.useState<string | null>(null);

  // This would need a resolveBlock function to work properly
  // For now, just a placeholder
  const handleSelect = () => {
    // Would resolve and insert the block
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className={className}>
            <Link2 className="h-4 w-4 mr-1" />
            Insérer un lien
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Insérer une référence</DialogTitle>
          <DialogDescription>
            Recherchez un élément pour l'insérer comme référence inline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            {(["user", "file", "task", "document"] as const).map((type) => {
              const info = getBlockTypeInfo(type);
              return (
                <Button
                  key={type}
                  variant={targetType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTargetType(type)}
                >
                  {info.displayName}
                </Button>
              );
            })}
          </div>

          <EntityPicker
            entityType={targetType === "document" ? "document" : targetType}
            value={targetId}
            onChange={(v) => setTargetId(v as string | null)}
            placeholder="Rechercher..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button onClick={handleSelect} disabled={!targetId}>
            Insérer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Link Badge (compact link display)
// ============================================================================

export interface LinkBadgeProps {
  link: LinkedBlock;
  block?: UniversalBlock;
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
}

export function LinkBadge({
  link,
  block,
  onClick,
  onRemove,
  className,
}: LinkBadgeProps) {
  const typeInfo = getBlockTypeInfo(link.blockType);

  return (
    <Badge
      variant="secondary"
      className={cn(
        "flex items-center gap-1.5 pr-1 cursor-pointer hover:bg-muted",
        className
      )}
      onClick={onClick}
    >
      <span className="text-xs text-muted-foreground">
        {linkTypeLabels[link.linkType]}:
      </span>
      <span className="font-medium truncate max-w-[100px]">
        {block?.title || link.blockId}
      </span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 p-0.5 rounded-full hover:bg-muted-foreground/20"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}
