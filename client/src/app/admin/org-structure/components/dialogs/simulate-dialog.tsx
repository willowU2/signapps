"use client";

/**
 * SO2 G1.5 — RBAC simulator dialog.
 *
 * Ouvre un formulaire avec : dropdown `action` + input `resource` + bouton
 * "Simuler". L'API `POST /org/rbac/simulate` retourne `{allowed, reason, chain}`.
 * Le dialog affiche une card verte/rouge + la liste des sources
 * contribuant au verdict.
 */

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orgApi } from "@/lib/api/org";
import type { RbacSimulateResponse } from "@/lib/api/org";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle } from "lucide-react";

const ACTIONS = [
  "read",
  "write",
  "create",
  "update",
  "delete",
  "admin",
  "manage",
  "share",
];

export interface SimulateDialogProps {
  personId: string;
  personName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SimulateDialog({
  personId,
  personName,
  open,
  onOpenChange,
}: SimulateDialogProps) {
  const [action, setAction] = useState("read");
  const [resource, setResource] = useState("docs.document");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RbacSimulateResponse | null>(null);

  const handleSimulate = async () => {
    if (!resource.trim()) return;
    setLoading(true);
    try {
      const res = await orgApi.rbac.simulate({
        person_id: personId,
        action,
        resource: resource.trim(),
      });
      setResult(res.data);
    } catch (e) {
      console.error("simulate failed", e);
      setResult({
        allowed: false,
        reason: "Erreur serveur",
        chain: [],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Simuler une permission</DialogTitle>
          <DialogDescription>
            {personName
              ? `Vérifier ce que ${personName} peut faire sur une ressource précise.`
              : "Vérifier une action sur une ressource précise."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="sim-action">Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger id="sim-action" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="sim-resource">Ressource</Label>
            <Input
              id="sim-resource"
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              placeholder="e.g. docs.document, mail.inbox, org_node.*"
            />
            <p className="text-[10px] text-muted-foreground">
              Format&nbsp;: <code>service.resource</code>. Utiliser
              <code>service.*</code> pour matcher tout un domaine.
            </p>
          </div>

          {result && (
            <div
              data-testid="rbac-simulate-result"
              className={cn(
                "rounded-md border p-3 text-sm",
                result.allowed
                  ? "border-emerald-400/40 bg-emerald-500/10"
                  : "border-rose-400/40 bg-rose-500/10",
              )}
            >
              <div className="flex items-center gap-2 font-medium">
                {result.allowed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                )}
                {result.allowed ? "Autorisé" : "Refusé"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {result.reason}
              </p>

              {result.chain.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.chain.map((p, i) => (
                    <li key={i} className="flex items-center gap-2 text-[11px]">
                      <Badge variant="outline" className="text-[10px]">
                        {p.source.type}
                      </Badge>
                      <span className="font-mono">
                        {p.action} @ {p.resource}
                      </span>
                      <span className="text-muted-foreground">
                        ({p.source.ref_name})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button
            onClick={handleSimulate}
            disabled={loading || !resource.trim()}
            data-testid="rbac-simulate-submit"
          >
            {loading ? "Simulation…" : "Simuler"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
