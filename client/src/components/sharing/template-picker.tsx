"use client";

import { useState, useEffect } from "react";
import { Loader2, LayoutTemplate, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { sharingApi } from "@/lib/api/sharing";
import type { SharingTemplate, SharingResourceType } from "@/types/sharing";
import {
  SHARING_ROLE_LABELS,
  SHARING_GRANTEE_TYPE_LABELS,
} from "@/types/sharing";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TemplatePickerProps {
  /** Type of the resource to which the template will be applied. */
  resourceType: SharingResourceType;
  /** UUID of the target resource. */
  resourceId: string;
  /**
   * Called after a template is successfully applied.
   * Receives the number of grants that were created.
   */
  onApplied?: (count: number) => void;
}

// ─── Template summary ────────────────────────────────────────────────────────

function TemplateSummary({ template }: { template: SharingTemplate }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {template.name}
        </span>
        {template.is_system && (
          <Badge
            variant="secondary"
            className="text-[10px] h-4 px-1.5 shrink-0"
          >
            Système
          </Badge>
        )}
      </div>
      {template.description && (
        <p className="text-[11px] text-muted-foreground">
          {template.description}
        </p>
      )}
      <div className="flex flex-wrap gap-1 mt-0.5">
        {template.grants.map((g, i) => (
          <Badge
            key={i}
            variant="outline"
            className="text-[10px] h-4 px-1.5 bg-muted/40"
          >
            {g.grantee_type === "everyone"
              ? "Tout le monde"
              : (SHARING_GRANTEE_TYPE_LABELS[g.grantee_type] ?? g.grantee_type)}
            {" — "}
            {SHARING_ROLE_LABELS[g.role] ?? g.role}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TemplatePicker({
  resourceType,
  resourceId,
  onApplied,
}: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<SharingTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selected, setSelected] = useState<SharingTemplate | null>(null);
  const [applying, setApplying] = useState(false);

  // Load templates when the popover opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingTemplates(true);
    sharingApi
      .listTemplates()
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch(() => {
        if (!cancelled)
          toast.error("Impossible de charger les templates de partage");
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleApply = async () => {
    if (!selected) return;
    setApplying(true);
    try {
      const { count } = await sharingApi.applyTemplate(
        resourceType,
        resourceId,
        selected.id,
      );
      toast.success(
        `Template "${selected.name}" appliqué — ${count} accès créé${count > 1 ? "s" : ""}`,
      );
      setSelected(null);
      setOpen(false);
      onApplied?.(count);
    } catch {
      toast.error("Échec de l'application du template");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Template selector popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 flex-1 justify-start text-xs font-normal gap-1.5",
              !selected && "text-muted-foreground",
            )}
          >
            <LayoutTemplate className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate flex-1 text-left">
              {selected ? selected.name : "Choisir un template…"}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="p-0 w-[320px]" align="start" sideOffset={4}>
          {loadingTemplates ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <p className="px-4 py-6 text-xs text-center text-muted-foreground">
              Aucun template disponible
            </p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto py-1">
              {templates.map((tpl, idx) => (
                <button
                  key={tpl.id}
                  className={cn(
                    "w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                    tpl.id === selected?.id && "bg-accent/50",
                    idx > 0 && "border-t border-border/40",
                  )}
                  onClick={() => {
                    setSelected(tpl.id === selected?.id ? null : tpl);
                    setOpen(false);
                  }}
                >
                  <TemplateSummary template={tpl} />
                  {tpl.id === selected?.id && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary mt-0.5" />
                  )}
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Apply button */}
      <Button
        size="sm"
        className="h-8 text-xs shrink-0"
        onClick={handleApply}
        disabled={!selected || applying}
      >
        {applying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        ) : null}
        Appliquer
      </Button>
    </div>
  );
}
