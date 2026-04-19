/**
 * SO3 — Template Clone Dialog.
 *
 * Pick a template (from `orgApi.templates.list()`) + a target parent node,
 * preview the structure (nodes count + positions count), then clone.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderTree } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orgApi, type OrgTemplate } from "@/lib/api/org";

export interface TemplateCloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Available target parent nodes (node id -> display name). */
  nodeOptions: Array<{ id: string; name: string }>;
  /** Pre-selected target node id. */
  defaultNodeId?: string | null;
  /** Callback once the clone finishes. */
  onCloned: (result: {
    nodesCreated: number;
    positionsCreated: number;
  }) => void;
}

export function TemplateCloneDialog({
  open,
  onOpenChange,
  nodeOptions,
  defaultNodeId,
  onCloned,
}: TemplateCloneDialogProps) {
  const [templates, setTemplates] = useState<OrgTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [slug, setSlug] = useState<string>("");
  const [targetNodeId, setTargetNodeId] = useState<string>(defaultNodeId ?? "");
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    orgApi.templates
      .list()
      .then((res) => {
        setTemplates(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err: unknown) => {
        toast.error(`Templates indisponibles: ${(err as Error).message}`);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open]);

  useEffect(() => {
    if (defaultNodeId) setTargetNodeId(defaultNodeId);
  }, [defaultNodeId]);

  const selected = templates.find((t) => t.slug === slug) ?? null;
  const nodesCount = selected?.spec_json?.nodes?.length ?? 0;
  const positionsCount = selected?.spec_json?.positions?.length ?? 0;

  const onClone = useCallback(async () => {
    if (!slug) {
      toast.error("Sélectionnez un template");
      return;
    }
    if (!targetNodeId) {
      toast.error("Sélectionnez un noeud parent");
      return;
    }
    setCloning(true);
    try {
      const res = await orgApi.templates.clone(slug, {
        target_node_id: targetNodeId,
      });
      const nodesCreated = res.data.nodes?.length ?? 0;
      const positionsCreated = res.data.positions?.length ?? 0;
      toast.success(
        `Template cloné: ${nodesCreated} noeuds, ${positionsCreated} postes`,
      );
      onCloned({ nodesCreated, positionsCreated });
      onOpenChange(false);
    } catch (err) {
      toast.error(`Clone échoué: ${(err as Error).message}`);
    } finally {
      setCloning(false);
    }
  }, [slug, targetNodeId, onCloned, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            <FolderTree className="mr-2 inline size-4" />
            Cloner un template d&apos;organisation
          </DialogTitle>
          <DialogDescription>
            Choisissez un template et le noeud parent sous lequel l&apos;arbre
            sera créé. Les nouveaux noeuds et postes seront ajoutés en une seule
            transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="tpl-slug">Template</Label>
            <Select value={slug} onValueChange={setSlug}>
              <SelectTrigger id="tpl-slug">
                <SelectValue
                  placeholder={loading ? "Chargement…" : "Sélectionner…"}
                />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.slug} value={t.slug}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected ? (
            <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
              <div className="font-medium">{selected.name}</div>
              {selected.description ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {selected.description}
                </p>
              ) : null}
              <div className="mt-2 flex gap-2">
                {selected.industry ? (
                  <Badge variant="secondary">{selected.industry}</Badge>
                ) : null}
                {selected.size_range ? (
                  <Badge variant="outline">{selected.size_range}</Badge>
                ) : null}
                <Badge>
                  {nodesCount} noeuds · {positionsCount} postes
                </Badge>
              </div>
            </div>
          ) : null}

          <div>
            <Label htmlFor="target-node">Noeud parent</Label>
            <Select value={targetNodeId} onValueChange={setTargetNodeId}>
              <SelectTrigger id="target-node">
                <SelectValue placeholder="Sélectionner…" />
              </SelectTrigger>
              <SelectContent>
                {nodeOptions.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={onClone}
            disabled={cloning || !slug || !targetNodeId}
          >
            {cloning ? "Clonage…" : "Cloner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
