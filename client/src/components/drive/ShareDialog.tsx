"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DriveNode, driveAclApi, DriveAcl, AclRole } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Users } from "lucide-react";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: DriveNode | null;
}

export function ShareDialog({ open, onOpenChange, node }: ShareDialogProps) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<AclRole>("viewer");
  const [loading, setLoading] = useState(false);
  const [grants, setGrants] = useState<DriveAcl[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(false);

  // Reload existing grants when dialog opens
  useEffect(() => {
    if (!open || !node) {
      setGrants([]);
      return;
    }
    setGrantsLoading(true);
    driveAclApi
      .list(node.id)
      .then((res) => setGrants(res.data))
      .catch(() => {})
      .finally(() => setGrantsLoading(false));
  }, [open, node]);

  const handleShare = async () => {
    if (!node || !userId.trim()) return;

    setLoading(true);
    try {
      await driveAclApi.create(node.id, {
        grantee_type: "user",
        grantee_id: userId.trim(),
        role,
        inherit: true,
      });
      toast.success(`Accès accordé en tant que ${role}`);
      setUserId("");
      // Refresh the grants list
      const res = await driveAclApi.list(node.id);
      setGrants(res.data);
    } catch {
      toast.error("Erreur lors du partage");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (aclId: string) => {
    if (!node) return;
    try {
      await driveAclApi.delete(node.id, aclId);
      setGrants((prev) => prev.filter((g) => g.id !== aclId));
      toast.success("Accès révoqué");
    } catch {
      toast.error("Erreur lors de la révocation");
    }
  };

  if (!node) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Partager &ldquo;{node.name}&rdquo;</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label>Identifiant utilisateur (UUID ou email)</Label>
            <Input
              placeholder="ex: uuid ou jean.dupont@signapps.fr"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleShare();
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Rôle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AclRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez un rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">
                  Lecteur (consultation seule)
                </SelectItem>
                <SelectItem value="downloader">Téléchargeur</SelectItem>
                <SelectItem value="editor">
                  Éditeur (modification permise)
                </SelectItem>
                <SelectItem value="contributor">Contributeur</SelectItem>
                <SelectItem value="manager">
                  Gestionnaire (peut partager)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Existing grants */}
          {grants.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Accès actuels
              </div>
              <ul className="divide-y">
                {grants.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="truncate text-muted-foreground max-w-[240px]">
                      {g.grantee_name ??
                        g.grantee_id ??
                        "Tous les utilisateurs"}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs bg-muted rounded px-1.5 py-0.5">
                        {g.role}
                      </span>
                      <button
                        onClick={() => handleRevoke(g.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Révoquer l'accès"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {grantsLoading && (
            <p className="text-xs text-muted-foreground">
              Chargement des accès…
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button onClick={handleShare} disabled={loading || !userId.trim()}>
            {loading ? "Partage…" : "Partager"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
