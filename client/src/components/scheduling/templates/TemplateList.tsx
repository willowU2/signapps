"use client";

/**
 * TemplateList Component
 *
 * Displays a list of event templates with search and category filtering.
 */

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, FileText, Clock, MapPin, Palette } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { EventTemplate } from "@/lib/scheduling/types/scheduling";

// ============================================================================
// Props
// ============================================================================

interface TemplateListProps {
  templates: EventTemplate[];
  isLoading?: boolean;
  onSelect?: (template: EventTemplate) => void;
  onEdit?: (template: EventTemplate) => void;
  onCreate?: () => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  meeting: "Réunion",
  call: "Appel",
  work: "Travail",
  personal: "Personnel",
  focus: "Focus",
  other: "Autre",
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins}`;
}

// ============================================================================
// TemplateCard
// ============================================================================

interface TemplateCardProps {
  template: EventTemplate;
  onSelect?: (template: EventTemplate) => void;
  onEdit?: (template: EventTemplate) => void;
}

function TemplateCard({ template, onSelect, onEdit }: TemplateCardProps) {
  const defaults = template.eventDefaults;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "group relative rounded-lg border p-4 transition-all",
        "hover:border-primary/50 hover:bg-accent/50 cursor-pointer",
      )}
      onClick={() => onSelect?.(template)}
    >
      {/* Color indicator */}
      {defaults.color && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
          style={{ backgroundColor: defaults.color }}
        />
      )}

      <div className="pl-2">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="font-medium">{template.name}</h4>
            {template.description && (
              <p className="text-sm text-muted-foreground line-clamp-1">
                {template.description}
              </p>
            )}
          </div>
          {template.category && (
            <Badge variant="secondary" className="ml-2 shrink-0">
              {CATEGORY_LABELS[template.category] || template.category}
            </Badge>
          )}
        </div>

        {/* Defaults preview */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {defaults.title && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {defaults.title}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {defaults.allDay
              ? "Journée entière"
              : formatDuration(defaults.duration)}
          </span>
          {defaults.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {defaults.location}
            </span>
          )}
        </div>

        {/* Edit button (appears on hover) */}
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(template);
            }}
          >
            Modifier
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function TemplateList({
  templates,
  isLoading = false,
  onSelect,
  onEdit,
  onCreate,
  className,
}: TemplateListProps) {
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");

  // Get unique categories
  const categories = React.useMemo(() => {
    const cats = new Set<string>();
    templates.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats);
  }, [templates]);

  // Filter templates
  const filteredTemplates = React.useMemo(() => {
    return templates.filter((template) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesName = template.name.toLowerCase().includes(searchLower);
        const matchesDescription = template.description
          ?.toLowerCase()
          .includes(searchLower);
        const matchesTitle = template.eventDefaults.title
          ?.toLowerCase()
          .includes(searchLower);
        if (!matchesName && !matchesDescription && !matchesTitle) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== "all" && template.category !== categoryFilter) {
        return false;
      }

      return true;
    });
  }, [templates, search, categoryFilter]);

  if (isLoading) {
    return (
      <div className={cn("flex flex-col gap-4", className)}>
        <div className="flex gap-2">
          <div className="h-10 flex-1 bg-muted animate-pulse rounded-md" />
          <div className="h-10 w-32 bg-muted animate-pulse rounded-md" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header with search and filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un modèle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat] || cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {onCreate && (
            <Button onClick={onCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau
            </Button>
          )}
        </div>
      </div>

      {/* Templates list */}
      {filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Palette className="h-12 w-12 text-muted-foreground mb-4" />
          {templates.length === 0 ? (
            <>
              <p className="text-muted-foreground mb-4">Aucun modèle créé</p>
              {onCreate && (
                <Button onClick={onCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer un modèle
                </Button>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">
              Aucun modèle ne correspond à votre recherche
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={onSelect}
                onEdit={onEdit}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Footer with count */}
      {filteredTemplates.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {filteredTemplates.length} modèle
          {filteredTemplates.length !== 1 ? "s" : ""}
          {search || categoryFilter !== "all"
            ? ` (sur ${templates.length})`
            : ""}
        </p>
      )}
    </div>
  );
}

export default TemplateList;
