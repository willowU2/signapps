"use client";

/**
 * SO7 — Groupes transverses admin page.
 *
 * Shows every group for the current tenant (filtered by kind) and lets
 * admins create / edit / archive them. Members are resolved live by the
 * backend (dynamic / hybrid / derived) or from explicit includes (static).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { usePageTitle } from "@/hooks/use-page-title";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Network, Plus, Users2, Filter } from "lucide-react";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";
import type {
  OrgGroupKind,
  OrgGroupRecord,
  OrgGroupMembersResponse,
  Person,
} from "@/types/org";
import {
  RuleEditor,
  serializeRule,
  deserializeRule,
  type RuleEditorValue,
} from "@/components/groups/rule-editor";

// ─── Local helpers ────────────────────────────────────────────────────

const KIND_LABELS: Record<OrgGroupKind, { label: string; color: string }> = {
  static: { label: "Statique", color: "bg-blue-500/15 text-blue-700" },
  dynamic: { label: "Dynamique", color: "bg-green-500/15 text-green-700" },
  hybrid: { label: "Hybride", color: "bg-purple-500/15 text-purple-700" },
  derived: { label: "Dérivé", color: "bg-orange-500/15 text-orange-700" },
};

interface DialogState {
  open: boolean;
  editing: OrgGroupRecord | null;
}

interface FormState {
  slug: string;
  name: string;
  description: string;
  kind: OrgGroupKind;
  rule: RuleEditorValue;
}

const EMPTY_FORM: FormState = {
  slug: "",
  name: "",
  description: "",
  kind: "dynamic",
  rule: { operator: "and", leaves: [] },
};

// ─── Page ─────────────────────────────────────────────────────────────

export default function OrgGroupsPage() {
  usePageTitle("Groupes transverses");

  const [groups, setGroups] = useState<OrgGroupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState<"all" | OrgGroupKind>("all");
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    editing: null,
  });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [membersOpen, setMembersOpen] = useState<OrgGroupRecord | null>(null);
  const [members, setMembers] = useState<OrgGroupMembersResponse | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = kindFilter === "all" ? undefined : { kind: kindFilter };
      const res = await orgApi.orgGroups.list(params);
      setGroups(res.data);
    } catch (e) {
      console.error("orgGroups.list failed", e);
      toast.error("Impossible de charger les groupes");
    } finally {
      setLoading(false);
    }
  }, [kindFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openCreate = useCallback(() => {
    setForm(EMPTY_FORM);
    setDialog({ open: true, editing: null });
  }, []);

  const openEdit = useCallback((g: OrgGroupRecord) => {
    setForm({
      slug: g.slug,
      name: g.name,
      description: g.description ?? "",
      kind: g.kind,
      rule: deserializeRule(
        g.rule_json as Record<string, unknown> | null | undefined,
      ),
    });
    setDialog({ open: true, editing: g });
  }, []);

  const submit = useCallback(async () => {
    try {
      const payload = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        kind: form.kind,
        rule_json:
          form.kind === "dynamic" || form.kind === "hybrid"
            ? serializeRule(form.rule)
            : undefined,
      };
      if (dialog.editing) {
        await orgApi.orgGroups.update(dialog.editing.id, {
          name: payload.name,
          description: payload.description ?? null,
          rule_json: payload.rule_json ?? null,
        });
        toast.success("Groupe mis à jour");
      } else {
        if (!payload.slug || !payload.name) {
          toast.error("Slug et nom obligatoires");
          return;
        }
        await orgApi.orgGroups.create(payload);
        toast.success("Groupe créé");
      }
      setDialog({ open: false, editing: null });
      await reload();
    } catch (e) {
      console.error("group submit failed", e);
      toast.error("Erreur lors de la sauvegarde");
    }
  }, [form, dialog, reload]);

  const archive = useCallback(
    async (g: OrgGroupRecord) => {
      if (!window.confirm(`Archiver le groupe "${g.name}" ?`)) return;
      try {
        await orgApi.orgGroups.delete(g.id);
        toast.success("Groupe archivé");
        await reload();
      } catch (e) {
        console.error("archive failed", e);
        toast.error("Impossible d'archiver");
      }
    },
    [reload],
  );

  const openMembers = useCallback(async (g: OrgGroupRecord) => {
    setMembersOpen(g);
    setMembers(null);
    try {
      const res = await orgApi.orgGroups.members(g.id);
      setMembers(res.data);
    } catch (e) {
      console.error("members load failed", e);
      toast.error("Impossible de charger les membres");
    }
  }, []);

  const visibleGroups = useMemo(() => groups, [groups]);

  return (
    <AppLayout>
      <div className="w-full space-y-6">
        <PageHeader
          title="Groupes transverses"
          description="Crée des groupes statiques, dynamiques (règles JSON), hybrides ou dérivés d'un sous-arbre org."
          icon={<Network className="h-5 w-5" />}
          actions={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nouveau groupe
            </Button>
          }
        />

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select
            value={kindFilter}
            onValueChange={(v) =>
              setKindFilter(v === "all" ? "all" : (v as OrgGroupKind))
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les kinds</SelectItem>
              <SelectItem value="static">Statique</SelectItem>
              <SelectItem value="dynamic">Dynamique</SelectItem>
              <SelectItem value="hybrid">Hybride</SelectItem>
              <SelectItem value="derived">Dérivé</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            {visibleGroups.length} groupe(s)
          </div>
        </div>

        <div className="border rounded-md bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : visibleGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <div className="flex flex-col items-center text-muted-foreground gap-1">
                      <Network className="h-8 w-8 opacity-30" />
                      <p className="text-sm font-medium">Aucun groupe</p>
                      <p className="text-xs">
                        Crée-en un avec le bouton ci-dessus.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                visibleGroups.map((g) => {
                  const meta = KIND_LABELS[g.kind];
                  return (
                    <TableRow key={g.id} className="h-12 hover:bg-muted/40">
                      <TableCell className="font-medium">{g.name}</TableCell>
                      <TableCell>
                        <Badge className={meta.color}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {g.slug}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                        {g.description || <span className="italic">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openMembers(g)}
                          >
                            <Users2 className="h-3.5 w-3.5 mr-1" />
                            Membres
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(g)}
                          >
                            Éditer
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => archive(g)}
                          >
                            Archiver
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ─── Create / edit dialog ───────────────────────────────── */}
      <Dialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialog.editing
                ? `Éditer ${dialog.editing.name}`
                : "Nouveau groupe"}
            </DialogTitle>
            <DialogDescription>
              Les groupes dynamiques et hybrides utilisent un éditeur de règles
              visuel. Les groupes statiques / dérivés n'ont pas de règle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  disabled={!!dialog.editing}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slug: e.target.value }))
                  }
                  placeholder="python-devs"
                />
              </div>
              <div>
                <Label htmlFor="kind">Kind</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, kind: v as OrgGroupKind }))
                  }
                  disabled={!!dialog.editing}
                >
                  <SelectTrigger id="kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="static">Statique</SelectItem>
                    <SelectItem value="dynamic">Dynamique</SelectItem>
                    <SelectItem value="hybrid">Hybride</SelectItem>
                    <SelectItem value="derived">Dérivé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="name">Nom affiché</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Développeurs Python"
              />
            </div>

            <div>
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>

            {(form.kind === "dynamic" || form.kind === "hybrid") && (
              <div>
                <Label>Règle</Label>
                <div className="border rounded-md p-3 bg-background">
                  <RuleEditor
                    value={form.rule}
                    onChange={(rule) => setForm((f) => ({ ...f, rule }))}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialog({ open: false, editing: null })}
            >
              Annuler
            </Button>
            <Button onClick={submit}>
              {dialog.editing ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Members drawer ───────────────────────────────────────── */}
      <Dialog
        open={!!membersOpen}
        onOpenChange={(open) => {
          if (!open) {
            setMembersOpen(null);
            setMembers(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{membersOpen?.name} — membres</DialogTitle>
            <DialogDescription>
              {membersOpen
                ? `${members?.persons.length ?? "…"} personne(s) résolue(s).`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <MemberTable persons={members?.persons ?? []} loading={!members} />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMembersOpen(null);
                setMembers(null);
              }}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function MemberTable({
  persons,
  loading,
}: {
  persons: Person[];
  loading: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground italic">Chargement…</p>;
  }
  if (persons.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Aucun membre ne matche la règle.
      </p>
    );
  }
  return (
    <div className="max-h-96 overflow-y-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {persons.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">
                {p.first_name} {p.last_name}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {p.email}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
