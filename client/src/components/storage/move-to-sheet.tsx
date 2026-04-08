"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { FolderTree } from "./folder-tree";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FileItem {
  key: string;
  name: string;
  type: "folder" | "file";
}

interface MoveToSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FileItem | null;
  currentBucket: string;
  onMove: (destPath: string) => Promise<void>;
}

export function MoveToSheet({
  open,
  onOpenChange,
  item,
  currentBucket,
  onMove,
}: MoveToSheetProps) {
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Reset selected path when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPath("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedPath && selectedPath !== "") return; // Allow root? Yes.

    setLoading(true);
    try {
      await onMove(selectedPath);
      onOpenChange(false);
    } catch (error) {
      console.warn(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col h-full sm:max-w-md w-full">
        <SheetHeader>
          <SheetTitle>Déplacer &ldquo;{item?.name}&rdquo; vers…</SheetTitle>
        </SheetHeader>

        <div className="flex-1 flex flex-col gap-4 mt-6 min-h-0">
          <div className="flex-1 border rounded-md overflow-hidden">
            <ScrollArea className="h-full p-4">
              <FolderTree
                bucket={currentBucket}
                currentPath={selectedPath}
                onSelectFolder={(path) => {
                  setSelectedPath(path);
                }}
              />
            </ScrollArea>
          </div>

          <div className="text-sm font-medium text-muted-foreground p-3 border rounded-md bg-muted/30 break-all">
            <span className="text-foreground font-semibold mr-2">
              Destination :
            </span>
            {selectedPath || "Racine (Mon Drive)"}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 mt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? "Déplacement…" : "Déplacer ici"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
