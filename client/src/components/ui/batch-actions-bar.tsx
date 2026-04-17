"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Trash2, FolderInput, Tag, Archive, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BatchAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  variant?: "default" | "destructive";
  onClick: (selectedIds: string[]) => void;
}

interface BatchActionsBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  actions?: BatchAction[];
  /** Label for the item type, e.g. "fichiers", "emails" */
  itemLabel?: string;
}

const DEFAULT_ACTIONS: BatchAction[] = [
  {
    id: "archive",
    label: "Archiver",
    icon: <Archive className="h-4 w-4" />,
    onClick: () => {},
  },
  {
    id: "move",
    label: "Déplacer",
    icon: <FolderInput className="h-4 w-4" />,
    onClick: () => {},
  },
  {
    id: "label",
    label: "Étiqueter",
    icon: <Tag className="h-4 w-4" />,
    onClick: () => {},
  },
  {
    id: "delete",
    label: "Supprimer",
    icon: <Trash2 className="h-4 w-4" />,
    variant: "destructive" as const,
    onClick: () => {},
  },
];

/**
 * Floating bottom bar shown when multiple items are selected.
 * Renders a count of selected items with action buttons.
 *
 * Usage:
 *   <BatchActionsBar
 *     selectedIds={selectedIds}
 *     onClearSelection={() => setSelectedIds([])}
 *     actions={[
 *       { id: 'delete', label: 'Supprimer', icon: <Trash2 />, variant: 'destructive', onClick: (ids) => ... },
 *     ]}
 *   />
 */
export function BatchActionsBar({
  selectedIds,
  onClearSelection,
  actions,
  itemLabel = "éléments",
}: BatchActionsBarProps) {
  const resolvedActions = actions ?? DEFAULT_ACTIONS;
  const count = selectedIds.length;

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border bg-card/95 backdrop-blur-lg px-5 py-3 shadow-lg ring-1 ring-border/50"
        >
          {/* Count badge */}
          <div className="flex items-center gap-2 pr-3 border-r border-border">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold px-2">
              {count}
            </span>
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              {itemLabel} sélectionné{count > 1 ? "s" : ""}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {resolvedActions.map((action) => (
              <Button
                key={action.id}
                variant={
                  action.variant === "destructive" ? "destructive" : "outline"
                }
                size="sm"
                className="gap-1.5"
                onClick={() => action.onClick(selectedIds)}
              >
                {action.icon}
                <span className="hidden sm:inline">{action.label}</span>
              </Button>
            ))}
          </div>

          {/* Clear selection */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 ml-1"
            onClick={onClearSelection}
            title="Annuler la sélection"
            aria-label="Annuler la sélection"
          >
            <X className="h-4 w-4" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
