"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCalendarStore } from "@/stores/calendar-store";
import { layersApi, categoriesApi } from "@/lib/api/calendar";
import { Category } from "@/types/calendar";
import { cn } from "@/lib/utils";

// ─── Layer metadata ───────────────────────────────────────────────────────────

interface LayerMeta {
  id: string;
  label: string;
  color: string;
  section: "personal" | "team" | "resources" | "external";
}

const STATIC_LAYERS: LayerMeta[] = [
  // Personal
  { id: "my-events", label: "Mes événements", color: "#3b82f6", section: "personal" },
  { id: "my-tasks", label: "Mes tâches", color: "#8b5cf6", section: "personal" },
  { id: "projects", label: "Projets", color: "#6366f1", section: "personal" },
  // Team
  { id: "team-leaves", label: "Congés équipe", color: "#f97316", section: "team" },
  { id: "team-shifts", label: "Planning équipe", color: "#f43f5e", section: "team" },
  // Resources
  { id: "rooms", label: "Salles", color: "#22c55e", section: "resources" },
  { id: "equipment", label: "Matériel", color: "#06b6d4", section: "resources" },
  { id: "vehicles", label: "Véhicules", color: "#eab308", section: "resources" },
  // External
  { id: "external", label: "Calendriers externes", color: "#6b7280", section: "external" },
];

const SECTION_LABELS: Record<string, string> = {
  personal: "Mes vues",
  team: "Équipe",
  resources: "Ressources",
  external: "Externe",
};

const OPACITY_OPTIONS = [
  { label: "100%", value: 100 },
  { label: "50%", value: 50 },
  { label: "25%", value: 25 },
];

// ─── Colleague stub type (would come from users API in a real app) ─────────────

interface ColleagueStub {
  id: string;
  name: string;
  initials: string;
}

// ─── Resource stub type ───────────────────────────────────────────────────────

interface ResourceStub {
  id: string;
  name: string;
  resource_type: "room" | "equipment" | "vehicle";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ColorDotProps {
  color: string;
  className?: string;
}

function ColorDot({ color, className }: ColorDotProps) {
  return (
    <span
      className={cn("inline-block w-2.5 h-2.5 rounded-full shrink-0", className)}
      style={{ backgroundColor: color }}
    />
  );
}

interface OpacityPickerProps {
  value: number;
  onChange: (v: number) => void;
}

function OpacityPicker({ value, onChange }: OpacityPickerProps) {
  return (
    <div className="flex gap-0.5">
      {OPACITY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded transition-colors",
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface LayerRowProps {
  layerId: string;
  label: string;
  color: string;
  enabled: boolean;
  opacity: number;
  onToggle: () => void;
  onOpacityChange: (v: number) => void;
}

function LayerRow({ layerId, label, color, enabled, opacity, onToggle, onOpacityChange }: LayerRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Checkbox
        id={`layer-${layerId}`}
        checked={enabled}
        onCheckedChange={onToggle}
        className="shrink-0"
        style={enabled ? { backgroundColor: color, borderColor: color } : undefined}
      />
      <ColorDot color={color} />
      <label
        htmlFor={`layer-${layerId}`}
        className="flex-1 text-sm text-foreground cursor-pointer truncate select-none"
      >
        {label}
      </label>
      {hovered && enabled && (
        <OpacityPicker value={opacity} onChange={onOpacityChange} />
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        {title}
      </button>
      {open && <div className="ml-1">{children}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LayerPanel() {
  const {
    layers,
    toggleLayer,
    setLayerOpacity,
    selectedColleagues,
    toggleColleague,
    selectedResources,
    toggleResource,
    setLayers,
  } = useCalendarStore();

  // Derived helpers
  const getLayer = (id: string) =>
    layers.find((l) => l.layer_id === id) ?? { layer_id: id, enabled: false, opacity: 100 };

  // Categories from API
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryLayers, setCategoryLayers] = useState<Map<string, { enabled: boolean; opacity: number }>>(new Map());

  // Colleague search
  const [colleagueQuery, setColleagueQuery] = useState("");
  const [colleagues] = useState<ColleagueStub[]>([]); // populated from users API in real usage

  // Resource search
  const [resourceQuery, setResourceQuery] = useState("");
  const [resources] = useState<ResourceStub[]>([]); // populated from resources API in real usage

  // Debounced save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(
    (updatedLayers: typeof layers) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        layersApi.saveConfig(updatedLayers).catch(() => {
          // Silently fail — local state is the source of truth
        });
      }, 500);
    },
    [] // updatedLayers is passed as argument, not captured from closure
  );

  // Load categories once
  useEffect(() => {
    categoriesApi.list().then((res) => {
      const cats: Category[] = Array.isArray(res.data) ? res.data : [];
      setCategories(cats);
      // Initialise categoryLayers from store
      const map = new Map<string, { enabled: boolean; opacity: number }>();
      cats.forEach((cat) => {
        const existing = layers.find((l) => l.layer_id === cat.id);
        map.set(cat.id, { enabled: existing?.enabled ?? false, opacity: existing?.opacity ?? 100 });
      });
      setCategoryLayers(map);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handlers that also schedule save
  const handleToggle = useCallback(
    (layerId: string) => {
      toggleLayer(layerId);
      // Build the projected state for saving
      const projected = layers.map((l) =>
        l.layer_id === layerId ? { ...l, enabled: !l.enabled } : l
      );
      scheduleSave(projected);
    },
    [layers, toggleLayer, scheduleSave]
  );

  const handleOpacity = useCallback(
    (layerId: string, opacity: number) => {
      setLayerOpacity(layerId, opacity);
      const projected = layers.map((l) =>
        l.layer_id === layerId ? { ...l, opacity } : l
      );
      scheduleSave(projected);
    },
    [layers, setLayerOpacity, scheduleSave]
  );

  // Category layer toggle (adds/updates in the store)
  const handleCategoryToggle = useCallback(
    (catId: string) => {
      setCategoryLayers((prev) => {
        const current = prev.get(catId) ?? { enabled: false, opacity: 100 };
        const updated = new Map(prev);
        updated.set(catId, { ...current, enabled: !current.enabled });
        return updated;
      });
      // Update main store
      const existing = layers.find((l) => l.layer_id === catId);
      if (existing) {
        toggleLayer(catId);
        const projected = layers.map((l) =>
          l.layer_id === catId ? { ...l, enabled: !l.enabled } : l
        );
        scheduleSave(projected);
      } else {
        const newLayer = { layer_id: catId, enabled: true, opacity: 100 };
        const projected = [...layers, newLayer];
        setLayers(projected);
        scheduleSave(projected);
      }
    },
    [layers, toggleLayer, setLayers, scheduleSave]
  );

  const handleCategoryOpacity = useCallback(
    (catId: string, opacity: number) => {
      setCategoryLayers((prev) => {
        const current = prev.get(catId) ?? { enabled: true, opacity: 100 };
        const updated = new Map(prev);
        updated.set(catId, { ...current, opacity });
        return updated;
      });
      const existing = layers.find((l) => l.layer_id === catId);
      if (existing) {
        handleOpacity(catId, opacity);
      } else {
        const newLayer = { layer_id: catId, enabled: true, opacity };
        const projected = [...layers, newLayer];
        setLayers(projected);
        scheduleSave(projected);
      }
    },
    [layers, handleOpacity, setLayers, scheduleSave]
  );

  // Filtered colleagues / resources
  const filteredColleagues = colleagues.filter((c) =>
    c.name.toLowerCase().includes(colleagueQuery.toLowerCase())
  );
  const filteredResources = (type: ResourceStub["resource_type"]) =>
    resources
      .filter((r) => r.resource_type === type)
      .filter((r) => r.name.toLowerCase().includes(resourceQuery.toLowerCase()));

  const layersBySection = (section: LayerMeta["section"]) =>
    STATIC_LAYERS.filter((l) => l.section === section);

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-foreground">Calques</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 py-2 space-y-1">

          {/* ── Section: Mes vues ─────────────────────────────────────────── */}
          <Section title={SECTION_LABELS.personal}>
            {layersBySection("personal").map((meta) => {
              const layer = getLayer(meta.id);
              return (
                <LayerRow
                  key={meta.id}
                  layerId={meta.id}
                  label={meta.label}
                  color={meta.color}
                  enabled={layer.enabled}
                  opacity={layer.opacity}
                  onToggle={() => handleToggle(meta.id)}
                  onOpacityChange={(v) => handleOpacity(meta.id, v)}
                />
              );
            })}
          </Section>

          {/* ── Section: Équipe ───────────────────────────────────────────── */}
          <Section title={SECTION_LABELS.team}>
            {layersBySection("team").map((meta) => {
              const layer = getLayer(meta.id);
              return (
                <LayerRow
                  key={meta.id}
                  layerId={meta.id}
                  label={meta.label}
                  color={meta.color}
                  enabled={layer.enabled}
                  opacity={layer.opacity}
                  onToggle={() => handleToggle(meta.id)}
                  onOpacityChange={(v) => handleOpacity(meta.id, v)}
                />
              );
            })}

            {/* Colleagues picker */}
            <div className="mt-2 px-2">
              <div className="relative mb-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Rechercher un collègue..."
                  value={colleagueQuery}
                  onChange={(e) => setColleagueQuery(e.target.value)}
                  className="pl-7 h-7 text-xs bg-muted/50 border-none shadow-none"
                />
              </div>
              {filteredColleagues.length === 0 && colleagueQuery === "" && (
                <p className="text-xs text-muted-foreground px-1 py-1">Aucun collègue</p>
              )}
              {filteredColleagues.map((colleague) => (
                <div
                  key={colleague.id}
                  className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={`colleague-${colleague.id}`}
                    checked={selectedColleagues.includes(colleague.id)}
                    onCheckedChange={() => toggleColleague(colleague.id)}
                    className="shrink-0"
                  />
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium shrink-0">
                    {colleague.initials}
                  </span>
                  <label
                    htmlFor={`colleague-${colleague.id}`}
                    className="text-sm text-foreground cursor-pointer truncate select-none"
                  >
                    {colleague.name}
                  </label>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Section: Ressources ───────────────────────────────────────── */}
          <Section title={SECTION_LABELS.resources} defaultOpen={false}>
            {/* Static resource layers */}
            {layersBySection("resources").map((meta) => {
              const layer = getLayer(meta.id);
              return (
                <LayerRow
                  key={meta.id}
                  layerId={meta.id}
                  label={meta.label}
                  color={meta.color}
                  enabled={layer.enabled}
                  opacity={layer.opacity}
                  onToggle={() => handleToggle(meta.id)}
                  onOpacityChange={(v) => handleOpacity(meta.id, v)}
                />
              );
            })}

            {/* Resource picker */}
            <div className="mt-2 px-2">
              <div className="relative mb-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Rechercher une ressource..."
                  value={resourceQuery}
                  onChange={(e) => setResourceQuery(e.target.value)}
                  className="pl-7 h-7 text-xs bg-muted/50 border-none shadow-none"
                />
              </div>
              {(["room", "equipment", "vehicle"] as const).map((type) => {
                const items = filteredResources(type);
                if (items.length === 0) return null;
                return items.map((res) => (
                  <div
                    key={res.id}
                    className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={`resource-${res.id}`}
                      checked={selectedResources.includes(res.id)}
                      onCheckedChange={() => toggleResource(res.id)}
                      className="shrink-0"
                    />
                    <label
                      htmlFor={`resource-${res.id}`}
                      className="text-sm text-foreground cursor-pointer truncate select-none"
                    >
                      {res.name}
                    </label>
                  </div>
                ));
              })}
            </div>
          </Section>

          {/* ── Section: Externe ─────────────────────────────────────────── */}
          <Section title={SECTION_LABELS.external} defaultOpen={false}>
            {layersBySection("external").map((meta) => {
              const layer = getLayer(meta.id);
              return (
                <LayerRow
                  key={meta.id}
                  layerId={meta.id}
                  label={meta.label}
                  color={meta.color}
                  enabled={layer.enabled}
                  opacity={layer.opacity}
                  onToggle={() => handleToggle(meta.id)}
                  onOpacityChange={(v) => handleOpacity(meta.id, v)}
                />
              );
            })}
          </Section>

          {/* ── Section: Catégories ───────────────────────────────────────── */}
          {categories.length > 0 && (
            <Section title="Catégories" defaultOpen={false}>
              {categories.map((cat) => {
                const state = categoryLayers.get(cat.id) ?? { enabled: false, opacity: 100 };
                return (
                  <LayerRow
                    key={cat.id}
                    layerId={cat.id}
                    label={cat.name}
                    color={cat.color}
                    enabled={state.enabled}
                    opacity={state.opacity}
                    onToggle={() => handleCategoryToggle(cat.id)}
                    onOpacityChange={(v) => handleCategoryOpacity(cat.id, v)}
                  />
                );
              })}
            </Section>
          )}

        </div>
      </ScrollArea>

      {/* Footer: add layer */}
      <div className="px-3 py-2 border-t border-border shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground text-xs h-8"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter un calque…
        </Button>
      </div>
    </div>
  );
}
