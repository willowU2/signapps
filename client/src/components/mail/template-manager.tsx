"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, Copy, Eye, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  account_id: string;
  name: string;
  subject: string;
  body_html: string;
  variables: string[];
  created_at: string;
  updated_at: string;
}

interface TemplateManagerProps {
  accountId: string;
  /** Called when user picks a template to use */
  onUse?: (template: EmailTemplate) => void;
}

interface EditState {
  id?: string;
  name: string;
  subject: string;
  body_html: string;
  variables: string;
}

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

function extractVariables(text: string): string[] {
  const vars = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = VARIABLE_REGEX.exec(text)) !== null) vars.add(m[1]);
  return [...vars];
}

function substitutePreview(body: string, vars: string[]): string {
  return vars.reduce(
    (s, v) =>
      s.replaceAll(
        `{{${v}}}`,
        `<span class="text-primary font-semibold">[${v}]</span>`,
      ),
    body,
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TemplateManager({ accountId, onUse }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [previewing, setPreviewing] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/mail/templates?account_id=${accountId}`)
      .then((r) => r.json())
      .then(setTemplates)
      .catch(() => toast.error("Impossible de charger les modèles"))
      .finally(() => setLoading(false));
  }, [accountId]);

  const openCreate = () =>
    setEditing({ name: "", subject: "", body_html: "", variables: "" });

  const openEdit = (t: EmailTemplate) =>
    setEditing({
      id: t.id,
      name: t.name,
      subject: t.subject,
      body_html: t.body_html,
      variables: (t.variables ?? []).join(", "),
    });

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Nom requis");
      return;
    }

    setSaving(true);
    try {
      const detected = extractVariables(editing.body_html + editing.subject);
      const manual = editing.variables
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const allVars = [...new Set([...detected, ...manual])];

      const url = editing.id
        ? `/api/mail/templates/${editing.id}`
        : "/api/mail/templates";
      const method = editing.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          name: editing.name,
          subject: editing.subject,
          body_html: editing.body_html,
          variables: allVars,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const saved: EmailTemplate = await res.json();

      setTemplates((prev) =>
        editing.id
          ? prev.map((t) => (t.id === editing.id ? saved : t))
          : [...prev, saved],
      );
      setEditing(null);
      toast.success(editing.id ? "Modèle mis à jour" : "Modèle créé");
    } catch (err) {
      toast.error(
        `Erreur: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      await fetch(`/api/mail/templates/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Modèle supprimé");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const duplicate = async (t: EmailTemplate) => {
    try {
      const res = await fetch("/api/mail/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          name: `${t.name} (copie)`,
          subject: t.subject,
          body_html: t.body_html,
          variables: t.variables,
        }),
      });
      if (!res.ok) throw new Error();
      const created: EmailTemplate = await res.json();
      setTemplates((prev) => [...prev, created]);
      toast.success("Modèle dupliqué");
    } catch {
      toast.error("Erreur duplication");
    }
  };

  if (loading)
    return <div className="p-4 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Modèles d'e-mail</h3>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Nouveau modèle
        </Button>
      </div>

      {templates.length === 0 && !editing ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Aucun modèle
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Sujet</TableHead>
              <TableHead>Variables</TableHead>
              <TableHead className="w-[140px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium text-sm">{t.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {t.subject || "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {(t.variables ?? []).slice(0, 3).map((v) => (
                      <Badge key={v} variant="secondary" className="text-xs">
                        {"{{"}
                        {v}
                        {"}}"}
                      </Badge>
                    ))}
                    {(t.variables ?? []).length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{(t.variables ?? []).length - 3}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {onUse && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Utiliser"
                        aria-label={`Utiliser ${t.name}`}
                        onClick={() => onUse(t)}
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Aperçu"
                      aria-label={`Aperçu de ${t.name}`}
                      onClick={() => setPreviewing(t)}
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Dupliquer"
                      aria-label={`Dupliquer ${t.name}`}
                      onClick={() => duplicate(t)}
                    >
                      <Copy
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Modifier"
                      aria-label={`Modifier ${t.name}`}
                      onClick={() => openEdit(t)}
                    >
                      <Edit3 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      title="Supprimer"
                      aria-label={`Supprimer ${t.name}`}
                      onClick={() => deleteTemplate(t.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Edit / Create dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? "Modifier le modèle" : "Nouveau modèle"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nom</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) =>
                      setEditing({ ...editing, name: e.target.value })
                    }
                    placeholder="Modèle de bienvenue"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sujet</Label>
                  <Input
                    value={editing.subject}
                    onChange={(e) =>
                      setEditing({ ...editing, subject: e.target.value })
                    }
                    placeholder="Bonjour {{prenom}}"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Corps (HTML ou texte — utilisez {"{{variable}}"} pour les
                  champs dynamiques)
                </Label>
                <Textarea
                  value={editing.body_html}
                  onChange={(e) =>
                    setEditing({ ...editing, body_html: e.target.value })
                  }
                  rows={8}
                  placeholder="Bonjour {{prenom}},&#10;&#10;Bienvenue chez {{entreprise}}…"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Variables additionnelles (séparées par virgule — celles dans
                  le texte sont détectées automatiquement)
                </Label>
                <Input
                  value={editing.variables}
                  onChange={(e) =>
                    setEditing({ ...editing, variables: e.target.value })
                  }
                  placeholder="prenom, entreprise, date"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  <X className="h-4 w-4 mr-1" /> Annuler
                </Button>
                <Button onClick={save} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" />
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog
        open={!!previewing}
        onOpenChange={(o) => !o && setPreviewing(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Aperçu : {previewing?.name}</DialogTitle>
          </DialogHeader>
          {previewing && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Sujet :{" "}
                <span className="font-normal">{previewing.subject}</span>
              </p>
              <iframe
                srcDoc={substitutePreview(
                  previewing.body_html,
                  previewing.variables ?? [],
                )}
                sandbox=""
                className="border rounded w-full min-h-[100px] bg-muted/30"
                style={{ height: "200px" }}
                title="Template preview"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
