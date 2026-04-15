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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Copy, Link, Mail, Trash2, Check, Users } from "lucide-react";
import { toast } from "sonner";

interface Collaborator {
  email: string;
  permission: "reader" | "editor" | "owner";
  addedAt: string;
}

interface ShareData {
  collaborators: Collaborator[];
  publicLink: boolean;
  publicLinkExpiry: string | null;
}

const STORAGE_KEY = "signapps-doc-shares";

function getShareData(docId: string): ShareData {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return (
      all[docId] || {
        collaborators: [],
        publicLink: false,
        publicLinkExpiry: null,
      }
    );
  } catch {
    return { collaborators: [], publicLink: false, publicLinkExpiry: null };
  }
}

function saveShareData(docId: string, data: ShareData) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all[docId] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function ShareDialog({
  open,
  onClose,
  docId,
  docTitle,
}: {
  open: boolean;
  onClose: () => void;
  docId: string;
  docTitle: string;
}) {
  const [data, setData] = useState<ShareData>(() => getShareData(docId));
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"reader" | "editor">("reader");
  const [copied, setCopied] = useState(false);

  const addCollaborator = () => {
    if (!email.includes("@")) {
      toast.error("Email invalide");
      return;
    }
    if (data.collaborators.some((c) => c.email === email)) {
      toast.error("Déjà ajouté");
      return;
    }
    const updated = {
      ...data,
      collaborators: [
        ...data.collaborators,
        { email, permission, addedAt: new Date().toISOString() },
      ],
    };
    setData(updated);
    saveShareData(docId, updated);
    setEmail("");
    toast.success(
      `${email} ajouté comme ${permission === "reader" ? "lecteur" : "éditeur"}`,
    );
  };

  const removeCollaborator = (emailToRemove: string) => {
    const updated = {
      ...data,
      collaborators: data.collaborators.filter(
        (c) => c.email !== emailToRemove,
      ),
    };
    setData(updated);
    saveShareData(docId, updated);
  };

  const togglePublicLink = (checked: boolean) => {
    const updated = { ...data, publicLink: checked };
    setData(updated);
    saveShareData(docId, updated);
  };

  const copyLink = () => {
    const link = `${window.location.origin}/docs/shared/${docId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Lien copié");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Partager "{docTitle}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCollaborator()}
              className="flex-1"
            />
            <Select
              value={permission}
              onValueChange={(v: any) => setPermission(v)}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reader">Lecteur</SelectItem>
                <SelectItem value="editor">Éditeur</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={addCollaborator} size="sm">
              <Mail className="h-4 w-4" />
            </Button>
          </div>

          {data.collaborators.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Collaborateurs ({data.collaborators.length})
              </Label>
              {data.collaborators.map((c) => (
                <div
                  key={c.email}
                  className="flex items-center justify-between py-1"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                      {c.email[0].toUpperCase()}
                    </div>
                    <span className="text-sm">{c.email}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {c.permission === "reader" ? "Lecteur" : "Éditeur"}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCollaborator(c.email)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Lien public</Label>
                <p className="text-xs text-muted-foreground">
                  Toute personne avec le lien peut voir
                </p>
              </div>
              <Switch
                checked={data.publicLink}
                onCheckedChange={togglePublicLink}
              />
            </div>
            {data.publicLink && (
              <Button variant="outline" className="w-full" onClick={copyLink}>
                {copied ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copied ? "Copié !" : "Copier le lien"}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
