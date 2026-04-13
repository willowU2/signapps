"use client";

import React from "react";
import {
  FileText,
  Image as ImageIcon,
  File,
  FileArchive,
  FileCode,
  MoreVertical,
  Folder,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useDraggable } from "@dnd-kit/core";
import type { FileItem, DriveView } from "./types";

interface FileGridItemProps {
  item: FileItem;
  selected?: boolean;
  onSelect?: () => void;
  onNavigate?: () => void;
  onPreview?: () => void;
  onAction?: (action: string, item: FileItem) => void;
  viewMode?: DriveView;
}

export const FileGridItem = React.memo(function FileGridItem({
  item,
  selected,
  onSelect,
  onNavigate,
  onPreview,
  onAction,
  viewMode,
}: FileGridItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `file-${item.id}`,
    data: {
      type: "file",
      file: item,
    },
  });

  const getIcon = () => {
    if (item.type === "folder")
      return <Folder className="h-12 w-12 text-blue-500" />;

    // Simple extension check - in production use content-type
    const ext = item.name.split(".").pop()?.toLowerCase();

    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) {
      return <ImageIcon className="h-12 w-12 text-purple-500" />;
    }
    if (["pdf"].includes(ext || "")) {
      return <FileText className="h-12 w-12 text-red-500" />;
    }
    if (["zip", "rar", "tar", "gz"].includes(ext || "")) {
      return <FileArchive className="h-12 w-12 text-yellow-500" />;
    }
    if (["js", "ts", "tsx", "jsx", "bg", "py", "rs"].includes(ext || "")) {
      return <FileCode className="h-12 w-12 text-blue-400" />;
    }

    return <File className="h-12 w-12 text-gray-400" />;
  };

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative flex flex-col overflow-hidden transition-all hover:shadow-md cursor-grab active:cursor-grabbing border-transparent",
        selected &&
          "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500/20",
        isDragging && "opacity-50 ring-2 ring-blue-500",
      )}
      onClick={onSelect}
      onDoubleClick={() => {
        if (item.type === "folder") {
          onNavigate?.();
        } else {
          onPreview?.();
        }
      }}
    >
      {/* Preview Area */}
      <div className="aspect-[4/3] bg-muted/30 flex items-center justify-center p-6 transition-colors group-hover:bg-muted/50">
        {getIcon()}
      </div>

      {/* Info Bar */}
      <div className="p-3 bg-card border-t flex items-center gap-3">
        <div className="p-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30">
          {item.type === "folder" ? (
            <Folder className="h-4 w-4 text-blue-500" />
          ) : (
            <File className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" title={item.name}>
            {item.name}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {item.lastModified
              ? new Date(item.lastModified).toLocaleDateString()
              : "-"}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {viewMode === "trash" ? (
              <>
                <DropdownMenuItem onClick={() => onAction?.("restore", item)}>
                  Restore
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onAction?.("delete-forever", item)}
                >
                  Delete Forever
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem onClick={() => onAction?.("open", item)}>
                  Open
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction?.("preview", item)}>
                  Preview
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onAction?.("download", item)}>
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction?.("rename", item)}>
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction?.("move", item)}>
                  Move to...
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onAction?.("permissions", item)}
                >
                  Permissions
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onAction?.("manage-tags", item)}
                >
                  Manage Tags
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onAction?.("version-history", item)}
                >
                  Version History
                </DropdownMenuItem>
                {viewMode === "starred" ? (
                  <DropdownMenuItem onClick={() => onAction?.("unstar", item)}>
                    Remove from Starred
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onAction?.("star", item)}>
                    Add to Starred
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onAction?.("share", item)}>
                  Share
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onAction?.("delete", item)}
                >
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
});
