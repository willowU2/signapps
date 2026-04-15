"use client";

/**
 * Feature 12: Social → attach Drive files to posts
 * Feature 23: Social → share Drive folder as portfolio
 */

import { useState } from "react";
import { HardDrive, Folder, File, X, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { driveApi, DriveNode } from "@/lib/api/drive";
import { driveNodeUrl } from "@/hooks/use-cross-module";

interface SocialAttachDriveProps {
  onAttach: (attachments: { node: DriveNode; url: string }[]) => void;
  maxFiles?: number;
}

export function SocialAttachDrive({
  onAttach,
  maxFiles = 4,
}: SocialAttachDriveProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DriveNode[]>([]);

  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ["drive-nodes-for-social"],
    queryFn: () => driveApi.listNodes(null),
    enabled: open,
  });

  const toggle = (node: DriveNode) => {
    setSelected((prev) => {
      if (prev.some((n) => n.id === node.id))
        return prev.filter((n) => n.id !== node.id);
      if (prev.length >= maxFiles) {
        toast.error(`Max ${maxFiles} fichiers`);
        return prev;
      }
      return [...prev, node];
    });
  };

  const handleConfirm = () => {
    const attachments = selected.map((n) => ({
      node: n,
      url: driveNodeUrl(n.id),
    }));
    onAttach(attachments);
    setOpen(false);
    setSelected([]);
    toast.success(`${attachments.length} fichier(s) joint(s)`);
  };

  const handleShareFolder = (folder: DriveNode) => {
    const url = driveNodeUrl(folder.id);
    navigator.clipboard.writeText(url);
    toast.success("Lien du dossier copié pour partage portfolio");
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <HardDrive className="h-3.5 w-3.5" />
        Drive
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Joindre des fichiers Drive
            </DialogTitle>
          </DialogHeader>

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1 pb-2 border-b">
              {selected.map((n) => (
                <Badge key={n.id} variant="secondary" className="gap-1 text-xs">
                  {n.name.slice(0, 20)}
                  <button
                    onClick={() => toggle(n)}
                    className="ml-0.5 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="max-h-64 overflow-y-auto space-y-1">
            {isLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Chargement...
              </p>
            )}
            {!isLoading &&
              nodes.map((node) => {
                const isSelected = selected.some((n) => n.id === node.id);
                return (
                  <div
                    key={node.id}
                    className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <button
                      className="flex-1 flex items-center gap-2 text-sm"
                      onClick={() => toggle(node)}
                    >
                      {node.node_type === "folder" ? (
                        <Folder className="h-4 w-4 text-yellow-500 shrink-0" />
                      ) : (
                        <File className="h-4 w-4 text-blue-500 shrink-0" />
                      )}
                      <span className="truncate">{node.name}</span>
                      {isSelected && (
                        <Plus className="h-3.5 w-3.5 text-primary ml-auto rotate-45" />
                      )}
                    </button>
                    {node.node_type === "folder" && (
                      <button
                        onClick={() => handleShareFolder(node)}
                        className="p-1 rounded hover:bg-accent"
                        title="Partager comme portfolio"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                );
              })}
            {!isLoading && nodes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun fichier dans Drive
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleConfirm} disabled={selected.length === 0}>
              Joindre {selected.length > 0 ? `(${selected.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
