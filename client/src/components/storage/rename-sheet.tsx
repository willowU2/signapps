"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FileItem {
  key: string;
  name: string;
  type: "folder" | "file";
}

interface RenameSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FileItem | null;
  onRename: (newName: string) => Promise<void>;
}

export function RenameSheet({
  open,
  onOpenChange,
  item,
  onRename,
}: RenameSheetProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item && open) {
      setName(item.name);
    }
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name === item?.name) {
      onOpenChange(false);
      return;
    }

    setLoading(true);
    try {
      await onRename(name.trim());
      onOpenChange(false);
    } catch (error) {
      console.warn(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            Renommer {item?.type === "folder" ? "le dossier" : "le fichier"}
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Saisir le nouveau nom"
              autoFocus
              disabled={loading}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-muted">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Renommage…" : "Renommer"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
