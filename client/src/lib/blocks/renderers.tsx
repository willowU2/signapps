/**
 * Universal Blocks System - Renderers
 *
 * Composants de rendu pour les différents modes d'affichage des blocs:
 * - Inline: référence compacte dans le texte
 * - Card: carte pour grilles et dashboards
 * - Row: ligne pour listes compactes
 * - Preview: aperçu avec plus de détails
 */

"use client";

import * as React from "react";
import {
  User,
  File,
  Folder,
  CheckSquare,
  Calendar,
  FileText,
  Box,
  MoreHorizontal,
  ExternalLink,
  Pencil,
  Trash2,
  Link,
  Share2,
  Eye,
  Clock,
  MapPin,
  Tag,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

import type {
  UniversalBlock,
  BlockDisplayMode,
  BlockRendererProps,
  BlockAction,
  BlockType,
} from "./types";
import { getBlockTypeInfo } from "./registry";

// ============================================================================
// Icon Mapping
// ============================================================================

type IconProps = { className?: string; style?: React.CSSProperties };

const iconMap: Record<string, React.ComponentType<IconProps>> = {
  User,
  File,
  Folder,
  CheckSquare,
  Calendar,
  FileText,
  Box,
  // Add more as needed
};

function getIcon(iconName?: string): React.ComponentType<IconProps> {
  if (!iconName) return Box;
  return iconMap[iconName] || Box;
}

// ============================================================================
// Format Helpers
// ============================================================================

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelativeDate(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
  return formatDate(dateStr);
}

function getInitials(title: string): string {
  return title
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ============================================================================
// Block Inline Renderer
// ============================================================================

export interface BlockInlineProps {
  block: UniversalBlock;
  onClick?: (block: UniversalBlock) => void;
  showPreview?: boolean;
  className?: string;
}

export function BlockInline({
  block,
  onClick,
  showPreview = true,
  className,
}: BlockInlineProps) {
  const Icon = getIcon(block.icon);
  const typeInfo = getBlockTypeInfo(block.type);

  const content = (
    <Badge
      variant="secondary"
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 cursor-pointer",
        "hover:bg-muted/80 transition-colors",
        className,
      )}
      style={{ borderLeftColor: block.color, borderLeftWidth: 2 }}
      onClick={() => onClick?.(block)}
    >
      {block.type === "user" && block.avatarUrl ? (
        <Avatar className="h-4 w-4">
          <AvatarImage src={block.avatarUrl} alt={block.title} />
          <AvatarFallback className="text-[8px]">
            {getInitials(block.title)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <Icon className="h-3.5 w-3.5" style={{ color: block.color }} />
      )}
      <span className="text-sm font-medium truncate max-w-[150px]">
        {block.title}
      </span>
    </Badge>
  );

  if (!showPreview) return content;

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>{content}</HoverCardTrigger>
      <HoverCardContent className="w-72" side="top" align="start">
        <BlockPreviewContent block={block} />
      </HoverCardContent>
    </HoverCard>
  );
}

// ============================================================================
// Block Preview Content (for hover cards)
// ============================================================================

function BlockPreviewContent({ block }: { block: UniversalBlock }) {
  const Icon = getIcon(block.icon);
  const typeInfo = getBlockTypeInfo(block.type);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        {block.type === "user" ? (
          <Avatar className="h-10 w-10">
            <AvatarImage src={block.avatarUrl} alt={block.title} />
            <AvatarFallback>{getInitials(block.title)}</AvatarFallback>
          </Avatar>
        ) : block.thumbnailUrl ? (
          <div className="h-10 w-10 rounded bg-muted overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={block.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div
            className="h-10 w-10 rounded flex items-center justify-center"
            style={{ backgroundColor: `${block.color}20` }}
          >
            <Icon className="h-5 w-5" style={{ color: block.color }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{block.title}</p>
          {block.subtitle && (
            <p className="text-sm text-muted-foreground truncate">
              {block.subtitle}
            </p>
          )}
        </div>
      </div>

      {block.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {block.description}
        </p>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs">
          {typeInfo.displayName}
        </Badge>
        {block.metadata.updatedAt && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeDate(block.metadata.updatedAt)}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Block Card Renderer
// ============================================================================

export interface BlockCardProps {
  block: UniversalBlock;
  onClick?: (block: UniversalBlock) => void;
  onDoubleClick?: (block: UniversalBlock) => void;
  selected?: boolean;
  onSelect?: (block: UniversalBlock, selected: boolean) => void;
  showActions?: boolean;
  actions?: BlockAction[];
  className?: string;
}

export function BlockCard({
  block,
  onClick,
  onDoubleClick,
  selected,
  onSelect,
  showActions = true,
  actions,
  className,
}: BlockCardProps) {
  const Icon = getIcon(block.icon);
  const typeInfo = getBlockTypeInfo(block.type);

  const defaultActions: BlockAction[] = [
    {
      id: "open",
      label: "Ouvrir",
      icon: "ExternalLink",
      onClick: (b) => onClick?.(b),
    },
    ...(block.permissions.canEdit
      ? [
          {
            id: "edit",
            label: "Modifier",
            icon: "Pencil",
            onClick: () => {},
            requiredPermission: "canEdit" as const,
          },
        ]
      : []),
    ...(block.permissions.canShare
      ? [
          {
            id: "share",
            label: "Partager",
            icon: "Share2",
            onClick: () => {},
            requiredPermission: "canShare" as const,
          },
        ]
      : []),
    ...(block.permissions.canDelete
      ? [
          {
            id: "delete",
            label: "Supprimer",
            icon: "Trash2",
            onClick: () => {},
            variant: "destructive" as const,
            requiredPermission: "canDelete" as const,
          },
        ]
      : []),
  ];

  const displayActions = actions ?? defaultActions;

  return (
    <Card
      className={cn(
        "group relative transition-all cursor-pointer",
        "hover:shadow-md hover:border-primary/30",
        selected && "ring-2 ring-primary border-primary",
        className,
      )}
      onClick={() => onClick?.(block)}
      onDoubleClick={() => onDoubleClick?.(block)}
    >
      {onSelect && (
        <div
          className={cn(
            "absolute top-2 left-2 z-10",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            selected && "opacity-100",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(block, !!checked)}
          />
        </div>
      )}

      {showActions && displayActions.length > 0 && (
        <div
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {displayActions.map((action, idx) => (
                <React.Fragment key={action.id}>
                  {action.variant === "destructive" && idx > 0 && (
                    <DropdownMenuSeparator />
                  )}
                  <DropdownMenuItem
                    onClick={() => action.onClick(block)}
                    className={cn(
                      action.variant === "destructive" && "text-destructive",
                    )}
                  >
                    {action.label}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          {block.type === "user" ? (
            <Avatar className="h-10 w-10">
              <AvatarImage src={block.avatarUrl} alt={block.title} />
              <AvatarFallback>{getInitials(block.title)}</AvatarFallback>
            </Avatar>
          ) : block.thumbnailUrl ? (
            <div className="h-10 w-10 rounded bg-muted overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={block.thumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div
              className="h-10 w-10 rounded flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${block.color}20` }}
            >
              <Icon className="h-5 w-5" style={{ color: block.color }} />
            </div>
          )}
          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-semibold truncate leading-tight">
              {block.title}
            </p>
            {block.subtitle && (
              <p className="text-sm text-muted-foreground truncate">
                {block.subtitle}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {block.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {block.description}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {block.metadata.status && (
              <Badge variant="outline" className="text-xs capitalize">
                {block.metadata.status}
              </Badge>
            )}
            {block.metadata.priority && (
              <Badge
                variant="outline"
                className="text-xs capitalize"
                style={{
                  borderColor: block.color,
                  color: block.color,
                }}
              >
                {block.metadata.priority}
              </Badge>
            )}
          </div>
          {block.metadata.updatedAt && (
            <span>{formatRelativeDate(block.metadata.updatedAt)}</span>
          )}
        </div>

        {block.metadata.tags && block.metadata.tags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {block.metadata.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {block.metadata.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{block.metadata.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Block Row Renderer
// ============================================================================

export interface BlockRowProps {
  block: UniversalBlock;
  onClick?: (block: UniversalBlock) => void;
  selected?: boolean;
  onSelect?: (block: UniversalBlock, selected: boolean) => void;
  showActions?: boolean;
  actions?: BlockAction[];
  compact?: boolean;
  className?: string;
}

export function BlockRow({
  block,
  onClick,
  selected,
  onSelect,
  showActions = true,
  actions,
  compact = false,
  className,
}: BlockRowProps) {
  const Icon = getIcon(block.icon);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-lg",
        "hover:bg-muted/50 transition-colors cursor-pointer",
        selected && "bg-primary/10",
        className,
      )}
      onClick={() => onClick?.(block)}
    >
      {onSelect && (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(block, !!checked)}
          />
        </div>
      )}

      {block.type === "user" ? (
        <Avatar className={cn(compact ? "h-6 w-6" : "h-8 w-8")}>
          <AvatarImage src={block.avatarUrl} alt={block.title} />
          <AvatarFallback className={cn(compact && "text-xs")}>
            {getInitials(block.title)}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div
          className={cn(
            "rounded flex items-center justify-center shrink-0",
            compact ? "h-6 w-6" : "h-8 w-8",
          )}
          style={{ backgroundColor: `${block.color}20` }}
        >
          <Icon
            className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")}
            style={{ color: block.color }}
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "font-medium truncate",
            compact ? "text-sm" : "text-base",
          )}
        >
          {block.title}
        </p>
        {!compact && block.subtitle && (
          <p className="text-sm text-muted-foreground truncate">
            {block.subtitle}
          </p>
        )}
      </div>

      {!compact && block.metadata.status && (
        <Badge variant="outline" className="text-xs capitalize shrink-0">
          {block.metadata.status}
        </Badge>
      )}

      {!compact && block.metadata.updatedAt && (
        <span className="text-xs text-muted-foreground shrink-0">
          {formatRelativeDate(block.metadata.updatedAt)}
        </span>
      )}

      {showActions && (
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Aperçu</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Block Renderer (dispatcher)
// ============================================================================

export function BlockRenderer(props: BlockRendererProps) {
  const { block, mode, ...rest } = props;

  switch (mode) {
    case "inline":
      return (
        <BlockInline
          block={block}
          onClick={props.onClick}
          className={props.className}
        />
      );
    case "card":
      return (
        <BlockCard
          block={block}
          onClick={props.onClick}
          onDoubleClick={props.onDoubleClick}
          selected={props.selected}
          onSelect={props.onSelect}
          showActions={props.showActions}
          actions={props.actions}
          className={props.className}
        />
      );
    case "row":
      return (
        <BlockRow
          block={block}
          onClick={props.onClick}
          selected={props.selected}
          onSelect={props.onSelect}
          showActions={props.showActions}
          actions={props.actions}
          className={props.className}
        />
      );
    case "preview":
      return <BlockPreviewContent block={block} />;
    default:
      return <BlockCard block={block} {...rest} />;
  }
}

// ============================================================================
// Block List Component
// ============================================================================

export interface BlockListProps {
  blocks: UniversalBlock[];
  mode?: BlockDisplayMode;
  onBlockClick?: (block: UniversalBlock) => void;
  onBlockDoubleClick?: (block: UniversalBlock) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  showActions?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function BlockList({
  blocks,
  mode = "row",
  onBlockClick,
  onBlockDoubleClick,
  selectedIds,
  onSelectionChange,
  showActions = true,
  emptyMessage = "Aucun élément",
  className,
}: BlockListProps) {
  const handleSelect = (block: UniversalBlock, selected: boolean) => {
    if (!onSelectionChange) return;

    const newSelection = new Set(selectedIds);
    if (selected) {
      newSelection.add(block.id);
    } else {
      newSelection.delete(block.id);
    }
    onSelectionChange(newSelection);
  };

  if (blocks.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  if (mode === "card") {
    return (
      <div
        className={cn(
          "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
          className,
        )}
      >
        {blocks.map((block) => (
          <BlockCard
            key={block.id}
            block={block}
            onClick={onBlockClick}
            onDoubleClick={onBlockDoubleClick}
            selected={selectedIds?.has(block.id)}
            onSelect={onSelectionChange ? handleSelect : undefined}
            showActions={showActions}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {blocks.map((block) => (
        <BlockRow
          key={block.id}
          block={block}
          onClick={onBlockClick}
          selected={selectedIds?.has(block.id)}
          onSelect={onSelectionChange ? handleSelect : undefined}
          showActions={showActions}
        />
      ))}
    </div>
  );
}
