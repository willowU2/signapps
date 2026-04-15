"use client";

/**
 * View Editor Sheet
 *
 * Side panel for editing view configuration.
 */

import * as React from "react";
import {
  Save,
  X,
  Columns,
  Filter,
  ArrowUpDown,
  Users,
  Settings,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  ViewDefinition,
  ViewType,
  FieldDefinition,
  ColumnConfig,
} from "./types";
import { FilterBuilder, FilterSummary } from "./filter-builder";
import { createEmptyFilterGroup } from "./registry";
import {
  useActiveView,
  useViewActions,
  useDraftChanges,
} from "@/stores/views-store";

// ============================================================================
// Types
// ============================================================================

interface ViewEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  fields: FieldDefinition[];
}

// ============================================================================
// Column Editor
// ============================================================================

interface ColumnEditorProps {
  columns: ColumnConfig[];
  fields: FieldDefinition[];
  onChange: (columns: ColumnConfig[]) => void;
}

function ColumnEditor({ columns, fields, onChange }: ColumnEditorProps) {
  const toggleColumn = (field: string) => {
    const existing = columns.find((c) => c.field === field);
    if (existing) {
      onChange(
        columns.map((c) =>
          c.field === field ? { ...c, visible: !c.visible } : c,
        ),
      );
    } else {
      onChange([...columns, { field, visible: true, order: columns.length }]);
    }
  };

  const moveColumn = (field: string, direction: "up" | "down") => {
    const index = columns.findIndex((c) => c.field === field);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= columns.length) return;

    const newColumns = [...columns];
    [newColumns[index], newColumns[newIndex]] = [
      newColumns[newIndex],
      newColumns[index],
    ];
    onChange(newColumns.map((c, i) => ({ ...c, order: i })));
  };

  // Ensure all fields have a column entry
  const allColumns = fields.map((f) => {
    const existing = columns.find((c) => c.field === f.field);
    return (
      existing || { field: f.field, visible: false, order: columns.length }
    );
  });

  const sortedColumns = [...allColumns].sort((a, b) => {
    // Visible first, then by order
    if (a.visible !== b.visible) return a.visible ? -1 : 1;
    return a.order - b.order;
  });

  return (
    <div className="space-y-2">
      {sortedColumns.map((col, index) => {
        const field = fields.find((f) => f.field === col.field);
        return (
          <div
            key={col.field}
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg border",
              col.visible ? "bg-background" : "bg-muted/50",
            )}
          >
            <Switch
              checked={col.visible}
              onCheckedChange={() => toggleColumn(col.field)}
            />
            <span
              className={cn(
                "flex-1 text-sm",
                !col.visible && "text-muted-foreground",
              )}
            >
              {field?.label || col.field}
            </span>
            {col.visible && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => moveColumn(col.field, "up")}
                  disabled={index === 0}
                >
                  <ArrowUpDown className="h-3 w-3 rotate-180" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => moveColumn(col.field, "down")}
                  disabled={
                    index === sortedColumns.filter((c) => c.visible).length - 1
                  }
                >
                  <ArrowUpDown className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Sort Editor
// ============================================================================

interface SortEditorProps {
  sort: { field: string; direction: "asc" | "desc" }[];
  fields: FieldDefinition[];
  onChange: (sort: { field: string; direction: "asc" | "desc" }[]) => void;
}

function SortEditor({ sort, fields, onChange }: SortEditorProps) {
  const addSort = () => {
    const usedFields = sort.map((s) => s.field);
    const availableField = fields.find((f) => !usedFields.includes(f.field));
    if (availableField) {
      onChange([...sort, { field: availableField.field, direction: "asc" }]);
    }
  };

  const removeSort = (index: number) => {
    onChange(sort.filter((_, i) => i !== index));
  };

  const updateSort = (
    index: number,
    field: string,
    direction: "asc" | "desc",
  ) => {
    onChange(sort.map((s, i) => (i === index ? { field, direction } : s)));
  };

  return (
    <div className="space-y-3">
      {sort.map((s, index) => (
        <div key={index} className="flex items-center gap-2">
          <Select
            value={s.field}
            onValueChange={(v) => updateSort(index, v, s.direction)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fields.map((f) => (
                <SelectItem key={f.field} value={f.field}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={s.direction}
            onValueChange={(v) =>
              updateSort(index, s.field, v as "asc" | "desc")
            }
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Croissant</SelectItem>
              <SelectItem value="desc">Décroissant</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => removeSort(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={addSort}
        disabled={sort.length >= fields.length}
      >
        Ajouter un tri
      </Button>
    </div>
  );
}

// ============================================================================
// View Editor Sheet
// ============================================================================

export function ViewEditorSheet({
  open,
  onOpenChange,
  entityType,
  fields,
}: ViewEditorSheetProps) {
  const activeView = useActiveView(entityType);
  const { draft, hasDraft } = useDraftChanges(entityType);
  const {
    setDraftChanges,
    applyDraftChanges,
    discardDraftChanges,
    updateView,
  } = useViewActions();

  const [activeTab, setActiveTab] = React.useState("columns");

  // Merge active view with draft changes
  const currentView = React.useMemo(() => {
    if (!activeView) return null;
    return { ...activeView, ...draft } as ViewDefinition;
  }, [activeView, draft]);

  const handleChange = <K extends keyof ViewDefinition>(
    key: K,
    value: ViewDefinition[K],
  ) => {
    setDraftChanges(entityType, { ...draft, [key]: value });
  };

  const handleSave = () => {
    if (activeView && hasDraft) {
      updateView(entityType, activeView.id, draft);
      discardDraftChanges(entityType);
    }
    onOpenChange(false);
  };

  const handleCancel = () => {
    discardDraftChanges(entityType);
    onOpenChange(false);
  };

  if (!currentView) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col h-full sm:max-w-lg w-full">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Modifier la vue
          </SheetTitle>
          <SheetDescription>
            Personnalisez les colonnes, filtres et tri de cette vue.
          </SheetDescription>
        </SheetHeader>

        {/* View Name */}
        <div className="space-y-2 py-4">
          <Label htmlFor="view-name">Nom de la vue</Label>
          <Input
            id="view-name"
            value={currentView.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Ma vue personnalisée"
          />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="columns" className="gap-2">
              <Columns className="h-4 w-4" />
              Colonnes
            </TabsTrigger>
            <TabsTrigger value="filters" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtres
            </TabsTrigger>
            <TabsTrigger value="sort" className="gap-2">
              <ArrowUpDown className="h-4 w-4" />
              Tri
            </TabsTrigger>
          </TabsList>

          <TabsContent value="columns" className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-full pr-4">
              <ColumnEditor
                columns={currentView.columns}
                fields={fields}
                onChange={(columns) => handleChange("columns", columns)}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="filters" className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-full pr-4">
              <FilterBuilder
                fields={fields}
                value={currentView.filters || createEmptyFilterGroup()}
                onChange={(filters) => handleChange("filters", filters)}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="sort" className="flex-1 min-h-0 mt-4">
            <ScrollArea className="h-full pr-4">
              <SortEditor
                sort={currentView.sort}
                fields={fields}
                onChange={(sort) => handleChange("sort", sort)}
              />
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <Separator className="my-4" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasDraft && (
              <Badge variant="secondary" className="text-xs">
                Modifications non enregistrées
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={!hasDraft}>
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
