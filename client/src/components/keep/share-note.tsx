"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Share2, Copy, Check, Trash2, UserPlus, Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Permission = "view" | "edit";

interface ShareEntry {
  id: string;
  email: string;
  permission: Permission;
  sharedAt: string;
}

interface ShareNoteProps {
  noteId: string;
  noteTitle: string;
  onClose: () => void;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ShareNote({ noteId, noteTitle, onClose }: ShareNoteProps) {
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [permission, setPermission] = useState<Permission>("view");
  const [isPublic, setIsPublic] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareLink = `${typeof window !== "undefined" ? window.location.origin : ""}/keep/shared/${noteId}`;

  const handleAdd = () => {
    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error("Adresse email invalide.");
      return;
    }
    if (shares.some((s) => s.email === newEmail.toLowerCase())) {
      toast.error("Cet utilisateur a déjà accès.");
      return;
    }
    const entry: ShareEntry = {
      id: crypto.randomUUID(), email: newEmail.toLowerCase().trim(),
      permission, sharedAt: new Date().toISOString(),
    };
    setShares((p) => [...p, entry]);
    setNewEmail("");
    toast.success(`Note partagée avec ${entry.email}.`);
  };

  const handleRemove = (id: string) => {
    setShares((p) => p.filter((s) => s.id !== id));
  };

  const handlePermissionChange = (id: string, perm: Permission) => {
    setShares((p) => p.map((s) => s.id === id ? { ...s, permission: perm } : s));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      toast.success("Lien copié !");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error("Impossible de copier."));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Share2 className="size-4 text-primary" />
        <h3 className="font-semibold text-sm">Partager « {noteTitle || "Note"} »</h3>
      </div>

      {/* Add user */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Inviter par email</p>
        <div className="flex gap-2">
          <Input
            type="email" placeholder="colleague@example.com"
            value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            className="flex-1 h-8 text-sm"
          />
          <select value={permission} onChange={(e) => setPermission(e.target.value as Permission)}
            className="h-8 rounded-md border text-sm px-2 bg-background">
            <option value="view">Voir</option>
            <option value="edit">Modifier</option>
          </select>
          <Button size="sm" onClick={handleAdd} className="gap-1 h-8">
            <UserPlus className="size-3" />
          </Button>
        </div>
      </div>

      {/* Share list */}
      {shares.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Accès partagé ({shares.length})</p>
          {shares.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {s.email[0].toUpperCase()}
              </div>
              <span className="flex-1 truncate text-xs">{s.email}</span>
              <select value={s.permission} onChange={(e) => handlePermissionChange(s.id, e.target.value as Permission)}
                className="h-6 text-xs rounded border px-1 bg-background">
                <option value="view">Voir</option>
                <option value="edit">Modifier</option>
              </select>
              <Button size="icon" variant="ghost" className="size-6 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemove(s.id)}>
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Public link */}
      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {isPublic ? <Globe className="size-4 text-green-500" /> : <Lock className="size-4 text-muted-foreground" />}
            <span className="font-medium">{isPublic ? "Lien public actif" : "Lien privé"}</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="sr-only peer" />
            <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-card rounded-full shadow transition-transform peer-checked:translate-x-4" />
          </label>
        </div>

        {isPublic && (
          <div className="flex gap-2">
            <Input value={shareLink} readOnly className="h-7 text-xs flex-1 font-mono bg-muted/30" />
            <Button size="sm" variant="outline" onClick={handleCopyLink} className={cn("h-7 gap-1 text-xs", copied && "text-green-600")}>
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copié" : "Copier"}
            </Button>
          </div>
        )}
      </div>

      <Button variant="outline" className="w-full" onClick={onClose}>Fermer</Button>
    </div>
  );
}
