"use client";

/**
 * /admin/settings/panel-layout - SO6 W3 T11
 *
 * Admin-only page that lets an operator customize the DetailPanel
 * layout per (role, entity_type) for the current tenant. The page
 * uses dnd-kit for the tab ordering UI and lets the admin add /
 * remove custom widgets.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Plus, RotateCcw, Trash2 } from "lucide-react";
import { orgApi } from "@/lib/api/org";
import type {
  PanelEntitySlug,
  PanelLayoutConfig,
  PanelRoleSlug,
  PanelTabItem,
} from "@/lib/api/org";
import { invalidatePanelLayout } from "@/app/admin/org-structure/components/detail-panel/hooks/use-panel-layout";
import { WidgetPicker } from "./widget-picker";

const ROLE_LABELS: Record<PanelRoleSlug, string> = {
  admin: "Admin",
  manager: "Manager",
  viewer: "Viewer",
};

const ENTITY_LABELS: Record<PanelEntitySlug, string> = {
  node: "Noeud",
  person: "Personne",
};

const BUILTIN_TAB_OPTIONS: Record<PanelEntitySlug, string[]> = {
  node: [
    "details",
    "people",
    "positions",
    "governance",
    "headcount",
    "raci",
    "decisions",
    "audit",
    "policies",
    "groups",
    "sites",
    "delegations",
    "gpo",
    "kerberos",
    "dns",
    "dhcp",
    "ntp",
    "certificates",
    "deployment",
    "computers",
  ],
  person: [
    "profile",
    "assignments",
    "skills",
    "permissions",
    "delegations",
    "audit",
  ],
};

interface Draft extends PanelLayoutConfig {}

function itemKey(item: PanelTabItem, idx: number): string {
  if (item.type === "builtin") return "builtin:" + item.id;
  return "widget:" + item.widget_type + ":" + idx;
}

function itemLabel(item: PanelTabItem): string {
  if (item.type === "builtin") return item.id;
  const cfg = item.config ?? {};
  if (typeof cfg.label === "string" && cfg.label.trim().length > 0) {
    return "[" + item.widget_type + "] " + cfg.label;
  }
  return "[" + item.widget_type + "]";
}

interface SortableRowProps {
  id: string;
  label: string;
  onRemove: () => void;
}

function SortableRow({ id, label, onRemove }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border bg-card"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground"
        aria-label="Glisser pour reordonner"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex-1 text-sm truncate">{label}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-destructive"
        onClick={onRemove}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

export default function PanelLayoutAdminPage() {
  const [role, setRole] = useState<PanelRoleSlug>("admin");
  const [entityType, setEntityType] = useState<PanelEntitySlug>("node");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCustom, setIsCustom] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    main_tabs: [],
    hidden_tabs: [],
    hero_quick_actions: [],
    hero_kpis: [],
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await orgApi.panelLayouts.get(role, entityType);
      setIsCustom(res.data.is_custom);
      setDraft(res.data.config);
    } catch (err) {
      toast.error("Chargement du layout échoué");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [role, entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraft((d) => {
      const items = [...d.main_tabs];
      const oldIndex = items.findIndex((it, i) => itemKey(it, i) === active.id);
      const newIndex = items.findIndex((it, i) => itemKey(it, i) === over.id);
      if (oldIndex < 0 || newIndex < 0) return d;
      const reordered = arrayMove(items, oldIndex, newIndex).map(
        (item, idx): PanelTabItem => ({ ...item, position: idx }),
      );
      return { ...d, main_tabs: reordered };
    });
  };

  const addBuiltin = (id: string) => {
    setDraft((d) => {
      const exists = d.main_tabs.some(
        (t) => t.type === "builtin" && t.id === id,
      );
      if (exists) return d;
      return {
        ...d,
        main_tabs: [
          ...d.main_tabs,
          { type: "builtin", id, position: d.main_tabs.length },
        ],
        hidden_tabs: d.hidden_tabs.filter((h) => h !== id),
      };
    });
  };

  const addWidget = (widgetType: string, config: Record<string, unknown>) => {
    setDraft((d) => ({
      ...d,
      main_tabs: [
        ...d.main_tabs,
        {
          type: "widget",
          widget_type: widgetType,
          config,
          position: d.main_tabs.length,
        },
      ],
    }));
    setPickerOpen(false);
  };

  const removeAt = (idx: number) => {
    setDraft((d) => ({
      ...d,
      main_tabs: d.main_tabs
        .filter((_, i) => i !== idx)
        .map((item, i) => ({ ...item, position: i })),
    }));
  };

  const toggleHidden = (id: string) => {
    setDraft((d) => {
      const hidden = d.hidden_tabs.includes(id)
        ? d.hidden_tabs.filter((h) => h !== id)
        : [...d.hidden_tabs, id];
      return { ...d, hidden_tabs: hidden };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await orgApi.panelLayouts.upsert(role, entityType, draft);
      invalidatePanelLayout(role, entityType);
      setIsCustom(true);
      toast.success("Layout enregistré");
    } catch (err) {
      toast.error("Sauvegarde échouée (admin requis)");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await orgApi.panelLayouts.reset(role, entityType);
      invalidatePanelLayout(role, entityType);
      await load();
      toast.success("Layout remis au défaut");
    } catch (err) {
      toast.error("Reset échoué");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const availableBuiltins = useMemo(() => {
    const already = new Set(
      draft.main_tabs
        .filter(
          (t): t is { type: "builtin"; id: string; position?: number } =>
            t.type === "builtin",
        )
        .map((t) => t.id),
    );
    return BUILTIN_TAB_OPTIONS[entityType].filter((id) => !already.has(id));
  }, [draft.main_tabs, entityType]);

  return (
    <AppLayout>
      <div className="container mx-auto p-6 space-y-4 max-w-5xl">
        <div>
          <h1 className="text-2xl font-semibold">Layout du panneau droit</h1>
          <p className="text-sm text-muted-foreground">
            Personnalise les onglets + widgets du DetailPanel par rôle et entité
            pour le tenant courant.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cible</CardTitle>
            <CardDescription>
              {isCustom
                ? "Layout custom déjà stocké - `reset` le supprime."
                : "Aucun layout custom - les onglets viennent des defaults."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div>
              <Label>Rôle</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as PanelRoleSlug)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as PanelRoleSlug[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entité</Label>
              <Select
                value={entityType}
                onValueChange={(v) => setEntityType(v as PanelEntitySlug)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ENTITY_LABELS) as PanelEntitySlug[]).map(
                    (e) => (
                      <SelectItem key={e} value={e}>
                        {ENTITY_LABELS[e]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Onglets principaux</CardTitle>
              <CardDescription>
                Les 5 premiers sont affichés, le reste passe dans l'overflow.
                Glisser pour réordonner.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Ajouter widget
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-xs text-muted-foreground">Chargement...</p>
            ) : draft.main_tabs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aucun onglet configuré.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={draft.main_tabs.map((t, i) => itemKey(t, i))}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
                    {draft.main_tabs.map((item, idx) => (
                      <SortableRow
                        key={itemKey(item, idx)}
                        id={itemKey(item, idx)}
                        label={itemLabel(item)}
                        onRemove={() => removeAt(idx)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {availableBuiltins.length > 0 && (
              <div className="pt-3 border-t border-border">
                <Label className="text-xs text-muted-foreground">
                  Ajouter un onglet builtin
                </Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {availableBuiltins.map((id) => (
                    <Button
                      key={id}
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => addBuiltin(id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {id}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Onglets masqués</CardTitle>
            <CardDescription>
              Toggler un onglet ici le cache même de l'overflow menu.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {BUILTIN_TAB_OPTIONS[entityType].map((id) => {
              const hidden = draft.hidden_tabs.includes(id);
              return (
                <Badge
                  key={id}
                  variant={hidden ? "destructive" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleHidden(id)}
                >
                  {id}
                </Badge>
              );
            })}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={reset}
            disabled={saving || !isCustom}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset au défaut
          </Button>
          <Button onClick={save} disabled={saving}>
            Enregistrer
          </Button>
        </div>
      </div>

      <WidgetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addWidget}
      />
    </AppLayout>
  );
}
