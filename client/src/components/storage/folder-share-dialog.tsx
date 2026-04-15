"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, X, FolderOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type FolderPermissionRole = "viewer" | "editor" | "owner";

export interface FolderShareEntry {
  email: string;
  role: FolderPermissionRole;
}

interface FolderShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderName: string;
  initialShares?: FolderShareEntry[];
  onSave: (shares: FolderShareEntry[]) => Promise<void>;
}

const ROLE_LABELS: Record<FolderPermissionRole, string> = {
  viewer: "Viewer — can view and download",
  editor: "Editor — can upload and rename",
  owner: "Owner — full control",
};

const ROLE_COLORS: Record<FolderPermissionRole, string> = {
  viewer: "bg-blue-500/10 text-blue-700",
  editor: "bg-green-500/10 text-green-700",
  owner: "bg-purple-500/10 text-purple-700",
};

export function FolderShareDialog({
  open,
  onOpenChange,
  folderName,
  initialShares = [],
  onSave,
}: FolderShareDialogProps) {
  const [shares, setShares] = useState<FolderShareEntry[]>(initialShares);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<FolderPermissionRole>("viewer");
  const [saving, setSaving] = useState(false);

  const handleAdd = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (shares.some((s) => s.email === email)) {
      toast.error("This email is already in the list");
      return;
    }
    setShares([...shares, { email, role: newRole }]);
    setNewEmail("");
    setNewRole("viewer");
  };

  const handleRemove = (email: string) => {
    setShares(shares.filter((s) => s.email !== email));
  };

  const handleRoleChange = (email: string, role: FolderPermissionRole) => {
    setShares(shares.map((s) => (s.email === email ? { ...s, role } : s)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(shares);
      toast.success("Folder permissions saved");
      onOpenChange(false);
    } catch {
      toast.error("Impossible d'enregistrer permissions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Share Folder
          </DialogTitle>
          <p className="text-sm text-muted-foreground break-all">
            <span className="font-medium text-foreground">{folderName}</span>
          </p>
        </DialogHeader>

        {/* Add person */}
        <div className="space-y-3">
          <Label>Add people</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Email address..."
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1"
            />
            <Select
              value={newRole}
              onValueChange={(v) => setNewRole(v as FolderPermissionRole)}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" onClick={handleAdd} variant="outline">
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Current shares */}
        {shares.length > 0 ? (
          <div className="space-y-2 max-h-56 overflow-y-auto">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Shared with ({shares.length})
            </Label>
            {shares.map((s) => (
              <div
                key={s.email}
                className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.email}</p>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[s.role]}`}
                  >
                    {s.role}
                  </span>
                </div>
                <Select
                  value={s.role}
                  onValueChange={(v) =>
                    handleRoleChange(s.email, v as FolderPermissionRole)
                  }
                >
                  <SelectTrigger className="w-24 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleRemove(s.email)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No one added yet. Add people above to share this folder.
          </p>
        )}

        {/* Legend */}
        <div className="text-xs text-muted-foreground space-y-0.5">
          {(Object.keys(ROLE_LABELS) as FolderPermissionRole[]).map((r) => (
            <div key={r}>
              <span className="font-medium capitalize">{r}:</span>{" "}
              {ROLE_LABELS[r].split(" — ")[1]}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
