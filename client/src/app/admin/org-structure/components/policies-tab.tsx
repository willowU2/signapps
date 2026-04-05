"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";
import type { OrgPolicy, EffectivePolicy, PolicySource } from "@/types/org";

// =============================================================================
// Local constants
// =============================================================================

const POLICY_DOMAIN_LABELS: Record<string, { label: string; color: string }> = {
  security: { label: "Securite", color: "text-red-600 dark:text-red-400" },
  modules: { label: "Modules", color: "text-blue-600 dark:text-blue-400" },
  naming: { label: "Nommage", color: "text-green-600 dark:text-green-400" },
  delegation: {
    label: "Delegation",
    color: "text-purple-600 dark:text-purple-400",
  },
  compliance: {
    label: "Conformite",
    color: "text-orange-600 dark:text-orange-400",
  },
  custom: {
    label: "Personnalise",
    color: "text-slate-600 dark:text-slate-400",
  },
};

// =============================================================================
// PoliciesTab
// =============================================================================

export interface PoliciesTabProps {
  nodeId: string;
  allPolicies: OrgPolicy[];
}

export function PoliciesTab({ nodeId, allPolicies }: PoliciesTabProps) {
  const [effective, setEffective] = useState<EffectivePolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    orgApi.policies
      .resolveNode(nodeId)
      .then((res) => {
        if (!cancelled) setEffective(res.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setEffective(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  const handleAttachPolicy = async () => {
    if (!selectedPolicyId) return;
    setAttaching(true);
    try {
      await orgApi.policies.addLink(selectedPolicyId, {
        link_type: "node",
        link_id: nodeId,
        is_blocked: false,
      });
      toast.success("Politique attachee");
      setAttachOpen(false);
      setSelectedPolicyId("");
      const res = await orgApi.policies.resolveNode(nodeId);
      setEffective(res.data ?? null);
    } catch {
      toast.error("Erreur lors de l'attachement");
    } finally {
      setAttaching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Chargement des politiques...
      </div>
    );
  }

  const sources = effective?.sources ?? [];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sources.length} regle(s) effective(s)
        </p>
        <DropdownMenu open={attachOpen} onOpenChange={setAttachOpen}>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <LinkIcon className="h-4 w-4 mr-1" />
              Attacher une politique
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-3">
            <div className="space-y-3">
              <Select
                value={selectedPolicyId}
                onValueChange={setSelectedPolicyId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une politique..." />
                </SelectTrigger>
                <SelectContent>
                  {allPolicies.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="w-full"
                onClick={handleAttachPolicy}
                disabled={!selectedPolicyId || attaching}
              >
                {attaching ? "Attachement..." : "Attacher"}
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {sources.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucune politique effective</p>
          <p className="text-xs mt-1">
            Attachez une politique pour configurer les regles
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((source: PolicySource, idx: number) => {
            const domainInfo = POLICY_DOMAIN_LABELS[source.link_type] ?? {
              label: source.link_type,
              color: "text-muted-foreground",
            };
            return (
              <div
                key={`${source.policy_id}-${source.key}-${idx}`}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50"
              >
                <Shield className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{source.key}</span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        domainInfo.color,
                      )}
                    >
                      {source.link_type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {source.policy_name} — via {source.via}
                  </p>
                  <p className="text-xs font-mono mt-1 text-foreground/70">
                    {JSON.stringify(source.value)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
