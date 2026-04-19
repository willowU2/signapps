"use client";

/**
 * SO7 — Groups tab embedded in the org-structure DetailPanel.
 *
 * Two modes :
 *
 *  - `mode="node"` : the panel is showing an `OrgNode`. We display the
 *    list of groups that reference this node (source_node_id) OR whose
 *    dynamic rule targets its subtree (rule.node_path_startswith) — for
 *    now we settle for a simple fetch of all groups and render the ones
 *    that match via prefix because the backend doesn't expose a
 *    `?node_id=` filter yet. Good enough for Nexus-scale.
 *
 *  - `mode="person"` : the panel is showing a `Person`. We list every
 *    group the person belongs to by probing the `/members` endpoint of
 *    each visible group (only up to a small N — 20 groups in Nexus so
 *    O(N) is fine).
 */
import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Network, ExternalLink, UserCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { orgApi } from "@/lib/api/org";
import type { OrgGroupKind, OrgGroupRecord, OrgNode } from "@/types/org";

// =============================================================================
// Helpers
// =============================================================================

const GROUP_KIND_LABELS: Record<
  OrgGroupKind,
  { label: string; color: string }
> = {
  static: { label: "Statique", color: "bg-blue-500/15 text-blue-700" },
  dynamic: { label: "Dynamique", color: "bg-green-500/15 text-green-700" },
  hybrid: { label: "Hybride", color: "bg-purple-500/15 text-purple-700" },
  derived: { label: "Dérivé", color: "bg-orange-500/15 text-orange-700" },
};

// =============================================================================
// GroupsTab — unified node + person variant
// =============================================================================

export interface GroupsTabProps {
  mode?: "node" | "person";
  node?: OrgNode | null;
  personId?: string;
}

export function GroupsTab({ mode = "node", node, personId }: GroupsTabProps) {
  const [groups, setGroups] = useState<OrgGroupRecord[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load groups once.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    orgApi.orgGroups
      .list()
      .then((res) => {
        if (!cancelled) setGroups(res.data);
      })
      .catch((e) => {
        console.error("groups list failed", e);
        if (!cancelled) toast.error("Impossible de charger les groupes");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Person mode : probe membership for each group (up to 20 groups).
  useEffect(() => {
    if (mode !== "person" || !personId || groups.length === 0) {
      setMemberOf(new Set());
      return;
    }
    let cancelled = false;
    const probeLimit = 20;
    const probe = async () => {
      const next = new Set<string>();
      await Promise.all(
        groups.slice(0, probeLimit).map(async (g) => {
          try {
            const res = await orgApi.orgGroups.members(g.id);
            if (res.data.persons.some((p) => p.id === personId)) {
              next.add(g.id);
            }
          } catch {
            // Silently ignore failures so one broken group doesn't kill
            // the whole tab.
          }
        }),
      );
      if (!cancelled) setMemberOf(next);
    };
    void probe();
    return () => {
      cancelled = true;
    };
  }, [mode, personId, groups]);

  const filtered: OrgGroupRecord[] = useMemo(() => {
    if (mode === "person") {
      return groups.filter((g) => memberOf.has(g.id));
    }
    if (!node) return groups;
    // Node mode heuristic — show the groups whose source_node_id equals
    // the current node id, OR whose rule prefix path matches the node's
    // slug (lowercase, underscored).
    const candidatePrefix = slugsToPrefix(node);
    return groups.filter((g) => {
      if (g.source_node_id === node.id) return true;
      const rule = g.rule_json as Record<string, unknown> | null | undefined;
      if (rule && typeof rule["node_path_startswith"] === "string") {
        return (rule["node_path_startswith"] as string).startsWith(
          candidatePrefix,
        );
      }
      return false;
    });
  }, [groups, mode, node, memberOf]);

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading
            ? "Chargement…"
            : `${filtered.length} groupe(s) ${mode === "person" ? "— appartenance" : "— liés à ce noeud"}`}
        </p>
        <Link
          href="/admin/org-groups"
          className="text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3 inline mr-1" />
          Gérer
        </Link>
      </div>

      {filtered.length === 0 && !loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg">
          <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Aucun groupe</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((g) => {
            const meta = GROUP_KIND_LABELS[g.kind];
            return (
              <div
                key={g.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30"
              >
                <Network className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium flex-1 truncate">
                  {g.name}
                </span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] px-1.5 py-0 ${meta.color}`}
                >
                  {meta.label}
                </Badge>
                {mode === "person" && (
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function slugsToPrefix(node: OrgNode): string {
  // Very rough heuristic : convert "Engineering" → "engineering", drop
  // spaces, lowercase. Backend paths use snake_case so this is a best
  // effort filter.
  return node.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
}
