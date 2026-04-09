"use client";

import { useState } from "react";
import { Trash2, RotateCcw, AlertTriangle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trashApi, type TrashItem } from "@/lib/api/trash";

// ============================================================================
// Constants
// ============================================================================

const ENTITY_TYPE_ICONS: Record<string, string> = {
  file: "📁",
  document: "📄",
  email: "✉️",
  event: "📅",
  task: "✅",
  contact: "👤",
  form: "📝",
  note: "🗒️",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  file: "Fichier",
  document: "Document",
  email: "Email",
  event: "Événement",
  task: "Tâche",
  contact: "Contact",
  form: "Formulaire",
  note: "Note",
};

/** All filterable entity types */
const FILTER_TYPES = [
  "file",
  "document",
  "email",
  "event",
  "task",
  "contact",
  "form",
  "note",
] as const;

const TRASH_QUERY_KEY = ["trash"] as const;

// ============================================================================
// Helpers
// ============================================================================

function daysUntil(date?: string) {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

// ============================================================================
// Skeleton loader
// ============================================================================

function TrashSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-7 w-36" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-lg border"
          >
            <Skeleton className="h-6 w-6 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function UnifiedTrash() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("all");
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<TrashItem | null>(
    null,
  );

  // ── Fetch trash items ────────────────────────────────────────────────────
  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: [...TRASH_QUERY_KEY, typeFilter],
    queryFn: async () => {
      const params = typeFilter !== "all" ? { type: typeFilter } : undefined;
      const res = await trashApi.list(params);
      return res.data;
    },
  });

  // ── Restore mutation ─────────────────────────────────────────────────────
  const restoreMutation = useMutation({
    mutationFn: (id: string) => trashApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRASH_QUERY_KEY });
      toast.success("Restauré avec succès");
    },
    onError: () => {
      toast.error("Restauration échouée");
    },
  });

  // ── Permanent delete mutation ────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => trashApi.permanentDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRASH_QUERY_KEY });
      setConfirmDeleteItem(null);
      toast.success("Supprimé définitivement");
    },
    onError: () => {
      setConfirmDeleteItem(null);
      toast.error("Erreur lors de la suppression");
    },
  });

  // ── Purge expired mutation ───────────────────────────────────────────────
  const purgeMutation = useMutation({
    mutationFn: () => trashApi.purgeExpired(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRASH_QUERY_KEY });
      setConfirmPurge(false);
      toast.success("Corbeille vidée");
    },
    onError: () => {
      setConfirmPurge(false);
      toast.error("Erreur lors de la purge");
    },
  });

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) return <TrashSkeleton />;

  // ── Error state ──────────────────────────────────────────────────────────
  if (isError) {
    return (
      <EmptyState
        icon={Trash2}
        title="Erreur de chargement"
        description="Impossible de charger la corbeille. Vérifiez votre connexion et réessayez."
        actionLabel="Réessayer"
        onAction={() =>
          queryClient.invalidateQueries({ queryKey: TRASH_QUERY_KEY })
        }
        animate={false}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar: filter + purge button ──────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="Filtrer par type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {FILTER_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {ENTITY_TYPE_ICONS[t]} {ENTITY_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary" className="text-xs">
            {items.length} élément{items.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {items.length > 0 && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirmPurge(true)}
            disabled={purgeMutation.isPending}
            className="h-7"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Purger les expirés
          </Button>
        )}
      </div>

      {/* ── Item list ───────────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="La corbeille est vide"
          description={
            typeFilter !== "all"
              ? `Aucun élément de type « ${ENTITY_TYPE_LABELS[typeFilter] || typeFilter} » dans la corbeille.`
              : "Aucun élément supprimé. Les éléments placés dans la corbeille apparaîtront ici."
          }
        />
      ) : (
        <ScrollArea className="h-[calc(100vh-300px)]">
          <div className="space-y-2 pr-2">
            {items.map((item) => {
              const days = daysUntil(item.expires_at);
              const isRestoring =
                restoreMutation.isPending &&
                restoreMutation.variables === item.id;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                >
                  <span className="text-lg">
                    {ENTITY_TYPE_ICONS[item.entity_type] || "🗑️"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {item.entity_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs h-4 px-1">
                        {ENTITY_TYPE_LABELS[item.entity_type] ||
                          item.entity_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Supprimé{" "}
                        {new Date(item.deleted_at).toLocaleDateString()}
                      </span>
                      {days !== null && days <= 7 && (
                        <span className="flex items-center gap-0.5 text-xs text-orange-500">
                          <AlertTriangle className="w-3 h-3" />
                          Expire dans {days}j
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreMutation.mutate(item.id)}
                      disabled={isRestoring}
                      className="h-7 text-xs"
                    >
                      <RotateCcw
                        className={`w-3 h-3 mr-1 ${isRestoring ? "animate-spin" : ""}`}
                      />
                      Restaurer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDeleteItem(item)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* ── Confirm permanent delete (single item) ─────────────────────── */}
      <AlertDialog
        open={confirmDeleteItem !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteItem(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
            <AlertDialogDescription>
              {`L'élément « ${confirmDeleteItem?.entity_name ?? ""} » sera supprimé définitivement. Cette action est irréversible.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirmDeleteItem && deleteMutation.mutate(confirmDeleteItem.id)
              }
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm purge all expired ──────────────────────────────────── */}
      <AlertDialog open={confirmPurge} onOpenChange={setConfirmPurge}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purger les éléments expirés ?</AlertDialogTitle>
            <AlertDialogDescription>
              Tous les éléments dont la période de rétention est dépassée seront
              supprimés définitivement. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purgeMutation.isPending}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => purgeMutation.mutate()}
              disabled={purgeMutation.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              Purger
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
