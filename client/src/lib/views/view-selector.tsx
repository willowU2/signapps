"use client";

/**
 * View Selector Component
 *
 * Dropdown for selecting, creating, and managing views.
 */

import * as React from "react";
import {
  Check,
  ChevronDown,
  Plus,
  Copy,
  Trash2,
  Edit,
  Share2,
  Download,
  Upload,
  Star,
  LayoutGrid,
  Table2,
  Columns,
  Calendar,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ViewDefinition, ViewType } from "./types";
import { useViews, useActiveView, useViewActions } from "@/stores/views-store";
import { getTemplatesForEntity, templateCategories } from "./registry";

// ============================================================================
// Types
// ============================================================================

interface ViewSelectorProps {
  entityType: string;
  onEditView?: (viewId: string) => void;
  onCreateView?: () => void;
  className?: string;
}

// ============================================================================
// View Type Icons
// ============================================================================

const viewTypeIcons: Record<ViewType, React.ElementType> = {
  table: Table2,
  cards: LayoutGrid,
  kanban: Columns,
  calendar: Calendar,
  timeline: Clock,
};

const viewTypeLabels: Record<ViewType, string> = {
  table: "Tableau",
  cards: "Cartes",
  kanban: "Kanban",
  calendar: "Calendrier",
  timeline: "Timeline",
};

// ============================================================================
// View Selector Component
// ============================================================================

export function ViewSelector({
  entityType,
  onEditView,
  onCreateView,
  className,
}: ViewSelectorProps) {
  const views = useViews(entityType);
  const activeView = useActiveView(entityType);
  const { setActiveView, deleteView, duplicateView, exportView, importView } =
    useViewActions();

  const templates = getTemplatesForEntity(entityType);
  const groupedTemplates = React.useMemo(() => {
    const groups: Record<string, typeof templates> = {};
    templates.forEach((t) => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, [templates]);

  const handleSelectView = (viewId: string) => {
    setActiveView(entityType, viewId);
  };

  const handleCreateFromTemplate = (templateId: string) => {
    // This would typically open a dialog to confirm creation
    console.log("Create view from template:", templateId);
    onCreateView?.();
  };

  const handleDuplicate = (viewId: string, viewName: string) => {
    const duplicated = duplicateView(
      entityType,
      viewId,
      `${viewName} (copie)`
    );
    if (duplicated) {
      setActiveView(entityType, duplicated.id);
    }
  };

  const handleDelete = (viewId: string) => {
    deleteView(entityType, viewId);
  };

  const handleExport = (viewId: string) => {
    const view = exportView(entityType, viewId);
    if (view) {
      const blob = new Blob([JSON.stringify(view, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `view-${view.name.toLowerCase().replace(/\s+/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const view = JSON.parse(text) as ViewDefinition;
        const imported = importView(view);
        setActiveView(entityType, imported.id);
      } catch (error) {
        console.error("Failed to import view:", error);
      }
    };
    input.click();
  };

  const ViewIcon = activeView
    ? viewTypeIcons[activeView.viewType]
    : Table2;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-between min-w-[200px]", className)}
        >
          <div className="flex items-center gap-2">
            <ViewIcon className="h-4 w-4" />
            <span className="truncate">
              {activeView?.name || "Sélectionner une vue"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[280px]">
        {/* Saved Views */}
        {views.length > 0 && (
          <>
            <DropdownMenuLabel>Mes Vues</DropdownMenuLabel>
            <DropdownMenuGroup>
              {views.map((view) => {
                const Icon = viewTypeIcons[view.viewType];
                const isActive = activeView?.id === view.id;
                return (
                  <DropdownMenuItem
                    key={view.id}
                    className="flex items-center justify-between"
                    onSelect={() => handleSelectView(view.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="truncate">{view.name}</span>
                      {view.isDefault && (
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      )}
                      {view.isShared && (
                        <Share2 className="h-3 w-3 text-blue-500" />
                      )}
                    </div>
                    {isActive && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Templates */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle vue
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-[220px]">
            {Object.entries(groupedTemplates).map(([category, items]) => {
              const categoryInfo = templateCategories.find(
                (c) => c.id === category
              );
              return (
                <React.Fragment key={category}>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {categoryInfo?.label || category}
                  </DropdownMenuLabel>
                  {items.map((template) => {
                    const Icon = template.icon;
                    return (
                      <DropdownMenuItem
                        key={template.id}
                        onSelect={() => handleCreateFromTemplate(template.id)}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {template.name}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                </React.Fragment>
              );
            })}
            <DropdownMenuItem onSelect={onCreateView}>
              <Plus className="h-4 w-4 mr-2" />
              Vue personnalisée
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* View Actions */}
        {activeView && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {onEditView && (
                <DropdownMenuItem onSelect={() => onEditView(activeView.id)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() =>
                  handleDuplicate(activeView.id, activeView.name)
                }
              >
                <Copy className="h-4 w-4 mr-2" />
                Dupliquer
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExport(activeView.id)}>
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </DropdownMenuItem>
              {!activeView.isSystem && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => handleDelete(activeView.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </>
        )}

        {/* Import */}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleImport}>
          <Upload className="h-4 w-4 mr-2" />
          Importer une vue
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Quick View Type Switcher
// ============================================================================

interface ViewTypeSwitcherProps {
  entityType: string;
  allowedTypes?: ViewType[];
  className?: string;
}

export function ViewTypeSwitcher({
  entityType,
  allowedTypes = ["table", "cards"],
  className,
}: ViewTypeSwitcherProps) {
  const activeView = useActiveView(entityType);
  const { setDraftChanges } = useViewActions();

  const handleTypeChange = (type: ViewType) => {
    if (!activeView) return;
    setDraftChanges(entityType, { viewType: type });
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {allowedTypes.map((type) => {
        const Icon = viewTypeIcons[type];
        const isActive = activeView?.viewType === type;
        return (
          <Button
            key={type}
            variant={isActive ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => handleTypeChange(type)}
            title={viewTypeLabels[type]}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
