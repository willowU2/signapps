"use client";

// IDEA-261: Email aliases — manage multiple from addresses per account

import { useState, useEffect } from "react";
import { Plus, Trash2, Check, Mail, AtSign, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { accountApi } from "@/lib/api-mail";

export interface EmailAlias {
  id: string;
  account_id: string;
  alias_email: string;
  display_name: string;
  is_default: boolean;
  verified: boolean;
  created_at: string;
}

interface EmailAliasesProps {
  accountId: string;
  accountEmail: string;
}

export function EmailAliases({ accountId, accountEmail }: EmailAliasesProps) {
  const [aliases, setAliases] = useState<EmailAlias[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAlias, setEditAlias] = useState<EmailAlias | null>(null);
  const [form, setForm] = useState({ alias_email: "", display_name: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAliases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function loadAliases() {
    setLoading(true);
    try {
      const data = await accountApi.listAliases(accountId);
      setAliases(data as unknown as EmailAlias[]);
    } catch {
      toast.error("Impossible de charger les alias");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditAlias(null);
    setForm({ alias_email: "", display_name: "" });
    setDialogOpen(true);
  }

  function openEdit(alias: EmailAlias) {
    setEditAlias(alias);
    setForm({
      alias_email: alias.alias_email,
      display_name: alias.display_name,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.alias_email.includes("@")) {
      toast.error("Email invalide address");
      return;
    }
    setSaving(true);
    try {
      if (editAlias) {
        const updated = await accountApi.updateAlias(
          accountId,
          editAlias.id,
          form,
        );
        setAliases((prev) =>
          prev.map((a) => (a.id === editAlias.id ? { ...a, ...updated } : a)),
        );
        toast.success("Alias mis à jour");
      } else {
        const created = await accountApi.createAlias(accountId, form);
        setAliases((prev) => [...prev, created as unknown as EmailAlias]);
        toast.success("Alias créé — email de vérification envoyé");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Impossible d'enregistrer alias");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(aliasId: string) {
    try {
      await accountApi.deleteAlias(accountId, aliasId);
      setAliases((prev) => prev.filter((a) => a.id !== aliasId));
      toast.success("Alias supprimé");
    } catch {
      toast.error("Impossible de supprimer alias");
    }
  }

  async function setDefault(aliasId: string) {
    try {
      await accountApi.setDefaultAlias(accountId, aliasId);
      setAliases((prev) =>
        prev.map((a) => ({ ...a, is_default: a.id === aliasId })),
      );
      toast.success("Expéditeur par défaut mis à jour");
    } catch {
      toast.error("Impossible de mettre à jour default");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AtSign className="h-4 w-4" /> From Addresses
        </CardTitle>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Alias
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Primary account address */}
        <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-muted/40">
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm">{accountEmail}</span>
            <Badge variant="secondary" className="text-xs">
              Primary
            </Badge>
          </div>
        </div>

        {loading && (
          <p className="text-xs text-muted-foreground py-2">Chargement...</p>
        )}

        {aliases.map((alias) => (
          <div
            key={alias.id}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AtSign className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm truncate">{alias.alias_email}</p>
                {alias.display_name && (
                  <p className="text-xs text-muted-foreground truncate">
                    {alias.display_name}
                  </p>
                )}
              </div>
              {alias.is_default && (
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  Default
                </Badge>
              )}
              {!alias.verified && (
                <Badge variant="destructive" className="text-xs flex-shrink-0">
                  Unverified
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
              {!alias.is_default && alias.verified && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setDefault(alias.id)}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => openEdit(alias)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() => handleDelete(alias.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {!loading && aliases.length === 0 && (
          <p className="text-xs text-muted-foreground py-2 text-center">
            No aliases configured
          </p>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editAlias ? "Edit Alias" : "Add Email Alias"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Email address</Label>
              <Input
                value={form.alias_email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, alias_email: e.target.value }))
                }
                placeholder="alias@example.com"
                disabled={!!editAlias}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Display name (optional)</Label>
              <Input
                value={form.display_name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, display_name: e.target.value }))
                }
                placeholder="John Doe"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editAlias ? "Update" : "Add Alias"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
