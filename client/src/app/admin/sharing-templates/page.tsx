"use client";

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import {
  LayoutTemplate,
  Plus,
  Trash2,
  Lock,
  User,
  Users,
  Building2,
  Globe,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/use-page-title";
import { sharingApi } from "@/lib/api/sharing";
import { GranteePicker } from "@/components/sharing/grantee-picker";
import type {
  SharingTemplate,
  TemplateGrantDef,
  SharingGranteeType,
  SharingRole,
} from "@/types/sharing";
import {
  SHARING_ROLE_LABELS,
  SHARING_GRANTEE_TYPE_LABELS,
} from "@/types/sharing";

// ─── Role badge colours (mirrors share-dialog.tsx) ───────────────────────────

const ROLE_BADGE_CLS: Record<SharingRole, string> = {
  viewer: "bg-muted text-muted-foreground border-border",
  editor:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  manager:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
  deny: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800",
};

// ─── Grantee type icon ────────────────────────────────────────────────────────

function GranteeTypeIcon({ type }: { type: SharingGranteeType }) {
  const cls = "h-3 w-3 shrink-0";
  switch (type) {
    case "user":
      return <User className={cls} />;
    case "group":
      return <Users className={cls} />;
    case "org_node":
      return <Building2 className={cls} />;
    case "everyone":
      return <Globe className={cls} />;
  }
}

// ─── Empty grant definition factory ─────────────────────────────────────────

function emptyGrant(): TemplateGrantDef {
  return {
    grantee_type: "user",
    grantee_id: null,
    role: "viewer",
    can_reshare: false,
  };
}

// ─── Grant row editor ─────────────────────────────────────────────────────────

interface GrantEditorRowProps {
  index: number;
  grant: TemplateGrantDef;
  onChange: (index: number, updated: TemplateGrantDef) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

function GrantEditorRow({
  index,
  grant,
  onChange,
  onRemove,
  canRemove,
}: GrantEditorRowProps) {
  const update = (patch: Partial<TemplateGrantDef>) =>
    onChange(index, { ...grant, ...patch });

  return (
    <div className="border border-border rounded-md p-3 space-y-2 bg-card">
      {/* Grantee type + picker */}
      <div className="flex gap-2">
        <Select
          value={grant.grantee_type}
          onValueChange={(v) => {
            update({ grantee_type: v as SharingGranteeType, grantee_id: null });
          }}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user" className="text-xs">
              <span className="flex items-center gap-1.5">
                <User className="h-3 w-3" />
                Utilisateur
              </span>
            </SelectItem>
            <SelectItem value="group" className="text-xs">
              <span className="flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                Groupe
              </span>
            </SelectItem>
            <SelectItem value="org_node" className="text-xs">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3" />
                Département
              </span>
            </SelectItem>
            <SelectItem value="everyone" className="text-xs">
              <span className="flex items-center gap-1.5">
                <Globe className="h-3 w-3" />
                Tout le monde
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        {/* Grantee picker (hidden when "everyone") */}
        <GranteePicker
          granteeType={grant.grantee_type}
          value={grant.grantee_id}
          onChange={(id) => update({ grantee_id: id })}
        />
      </div>

      {/* Role + can reshare + remove */}
      <div className="flex items-center gap-2">
        <Select
          value={grant.role}
          onValueChange={(v) => update({ role: v as SharingRole })}
        >
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SHARING_ROLE_LABELS) as SharingRole[]).map((r) => (
              <SelectItem key={r} value={r} className="text-xs">
                {SHARING_ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 shrink-0">
          <Checkbox
            id={`can-reshare-${index}`}
            checked={grant.can_reshare}
            onCheckedChange={(v) => update({ can_reshare: v === true })}
          />
          <Label
            htmlFor={`can-reshare-${index}`}
            className="text-[11px] text-muted-foreground cursor-pointer whitespace-nowrap"
          >
            Peut partager
          </Label>
        </div>

        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => onRemove(index)}
            title="Supprimer cette règle"
            aria-label="Supprimer cette règle"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Create template dialog ───────────────────────────────────────────────────

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (tpl: SharingTemplate) => void;
}

function CreateTemplateDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [grants, setGrants] = useState<TemplateGrantDef[]>([emptyGrant()]);
  const [submitting, setSubmitting] = useState(false);

  const handleGrantChange = (index: number, updated: TemplateGrantDef) => {
    setGrants((prev) => prev.map((g, i) => (i === index ? updated : g)));
  };

  const handleGrantRemove = (index: number) => {
    setGrants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddGrant = () => {
    setGrants((prev) => [...prev, emptyGrant()]);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Le nom du template est obligatoire");
      return;
    }
    // Validate that all non-everyone grants have a grantee selected
    const invalid = grants.find(
      (g) => g.grantee_type !== "everyone" && !g.grantee_id,
    );
    if (invalid) {
      toast.error("Chaque règle doit avoir un destinataire sélectionné");
      return;
    }

    setSubmitting(true);
    try {
      const created = await sharingApi.createTemplate({
        name: name.trim(),
        description: description.trim() || null,
        grants,
      });
      toast.success(`Template "${created.name}" créé`);
      onCreated(created);
      onOpenChange(false);
      // Reset form
      setName("");
      setDescription("");
      setGrants([emptyGrant()]);
    } catch {
      toast.error("Impossible de créer le template");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <LayoutTemplate className="h-5 w-5 text-primary shrink-0" />
            Nouveau template de partage
          </DialogTitle>
          <DialogDescription>
            Définissez un ensemble de règles d&apos;accès réutilisables que les
            gestionnaires pourront appliquer en un clic.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name" className="text-xs font-medium">
              Nom <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Lecture équipe, Accès partenaire…"
              className="h-8 text-sm"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc" className="text-xs font-medium">
              Description{" "}
              <span className="text-muted-foreground font-normal">
                (optionnel)
              </span>
            </Label>
            <Textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez à quoi sert ce template…"
              className="text-sm resize-none min-h-[64px]"
              rows={3}
            />
          </div>

          {/* Grants list */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Règles d&apos;accès</Label>
            <div className="space-y-2">
              {grants.map((grant, idx) => (
                <GrantEditorRow
                  key={idx}
                  index={idx}
                  grant={grant}
                  onChange={handleGrantChange}
                  onRemove={handleGrantRemove}
                  canRemove={grants.length > 1}
                />
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs border-dashed"
              onClick={handleAddGrant}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Ajouter une règle
            </Button>
          </div>
        </div>

        <Separator />

        <DialogFooter className="px-6 py-4 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : null}
            Créer le template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Template card ────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: SharingTemplate;
  onDelete: (id: string) => void;
}

function TemplateCard({ template, onDelete }: TemplateCardProps) {
  return (
    <Card className="border border-border group">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-sm font-semibold text-foreground truncate">
              {template.name}
            </CardTitle>
            {template.is_system && (
              <Badge
                variant="secondary"
                className="text-[10px] h-4 px-1.5 shrink-0 flex items-center gap-0.5"
              >
                <Lock className="h-2.5 w-2.5" />
                Système
              </Badge>
            )}
          </div>

          {/* Delete button — hidden for system templates */}
          {!template.is_system && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
              onClick={() => onDelete(template.id)}
              title="Supprimer ce template"
              aria-label="Supprimer ce template"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {template.description && (
          <CardDescription className="text-xs mt-0.5">
            {template.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="px-5 pb-4">
        <div className="space-y-1.5">
          {template.grants.map((g, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="text-[10px] h-5 px-1.5 flex items-center gap-1 bg-muted/40"
              >
                <GranteeTypeIcon type={g.grantee_type} />
                <span>
                  {g.grantee_type === "everyone"
                    ? "Tout le monde"
                    : (SHARING_GRANTEE_TYPE_LABELS[g.grantee_type] ??
                      g.grantee_type)}
                </span>
              </Badge>
              <Badge
                variant="outline"
                className={`text-[10px] h-5 px-1.5 ${ROLE_BADGE_CLS[g.role]}`}
              >
                {SHARING_ROLE_LABELS[g.role] ?? g.role}
              </Badge>
              {g.can_reshare && (
                <Badge
                  variant="outline"
                  className="text-[10px] h-5 px-1.5 bg-muted/30 text-muted-foreground"
                >
                  Peut partager
                </Badge>
              )}
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground mt-2">
          Créé le{" "}
          {new Date(template.created_at).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TemplatesSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border border-border">
          <CardHeader className="pb-2 pt-4 px-5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48 mt-1" />
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-2">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-3 w-32 mt-1" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SharingTemplatesPage() {
  usePageTitle("Templates de partage");

  const [templates, setTemplates] = useState<SharingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTemplates = useCallback(() => {
    setLoading(true);
    setError(null);
    sharingApi
      .listTemplates()
      .then((data) => setTemplates(data))
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les templates",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreated = (tpl: SharingTemplate) => {
    setTemplates((prev) => [tpl, ...prev]);
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      await sharingApi.deleteTemplate(deleteTargetId);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTargetId));
      toast.success("Template supprimé");
    } catch {
      toast.error("Impossible de supprimer le template");
    } finally {
      setDeleting(false);
      setDeleteTargetId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Templates de partage"
          description="Préréglages de permissions réutilisables. Les gestionnaires peuvent les appliquer en un clic dans la boîte de dialogue de partage."
          icon={<LayoutTemplate className="h-5 w-5 text-primary" />}
          badge={
            !loading && templates.length > 0 ? (
              <Badge variant="secondary" className="text-xs h-5 px-2">
                {templates.length}
              </Badge>
            ) : undefined
          }
          actions={
            <Button
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Nouveau template
            </Button>
          }
        />

        {/* Content */}
        {loading ? (
          <TemplatesSkeleton />
        ) : error ? (
          <Card className="border border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-center justify-between gap-3 py-4 text-sm text-destructive">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={loadTemplates}
                className="shrink-0"
              >
                Réessayer
              </Button>
            </CardContent>
          </Card>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <LayoutTemplate className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">
                Aucun template de partage
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Créez des préréglages de permissions pour simplifier la gestion
                des accès.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 mt-2"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Créer le premier template
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <CreateTemplateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTargetId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce template ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le template sera définitivement
              supprimé et ne pourra plus être appliqué aux ressources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
