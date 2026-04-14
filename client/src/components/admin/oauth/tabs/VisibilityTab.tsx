"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  VisibilityPicker,
  type VisibilitySelection,
} from "@/components/shared/VisibilityPicker";
import type { ProviderConfigDetail } from "@/types/oauth-providers";

interface Props {
  detail: ProviderConfigDetail;
  onChange: (patch: Partial<ProviderConfigDetail>) => void;
}

/**
 * Visibility tab for the ProviderConfigDrawer.
 *
 * Shows a toggle between "all" (everyone) and "restricted" (scoped to
 * org_nodes / groups / roles / users). When restricted, delegates to the
 * reusable VisibilityPicker. All state is propagated up immediately via
 * onChange so the parent Drawer save button captures the latest values.
 */
export function VisibilityTab({ detail, onChange }: Props) {
  const [visibility, setVisibility] = useState<"all" | "restricted">(
    detail.visibility,
  );
  const [selection, setSelection] = useState<VisibilitySelection>({
    org_nodes: detail.visible_to_org_nodes,
    groups: detail.visible_to_groups,
    roles: detail.visible_to_roles,
    users: detail.visible_to_users,
  });

  // Re-sync local state when the drawer opens for a different provider.
  useEffect(() => {
    setVisibility(detail.visibility);
    setSelection({
      org_nodes: detail.visible_to_org_nodes,
      groups: detail.visible_to_groups,
      roles: detail.visible_to_roles,
      users: detail.visible_to_users,
    });
  }, [
    detail.visibility,
    detail.visible_to_org_nodes,
    detail.visible_to_groups,
    detail.visible_to_roles,
    detail.visible_to_users,
  ]);

  function handleVisibilityChange(next: "all" | "restricted") {
    setVisibility(next);
    if (next === "all") {
      onChange({
        visibility: "all",
        visible_to_org_nodes: [],
        visible_to_groups: [],
        visible_to_roles: [],
        visible_to_users: [],
      });
    } else {
      onChange({ visibility: "restricted" });
    }
  }

  function handleSelectionChange(next: VisibilitySelection) {
    setSelection(next);
    onChange({
      visible_to_org_nodes: next.org_nodes,
      visible_to_groups: next.groups,
      visible_to_roles: next.roles,
      visible_to_users: next.users,
    });
  }

  return (
    <div className="space-y-6">
      {/* Explanation banner */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <p>
          Choisissez si <strong className="text-foreground">tous</strong> les
          utilisateurs voient ce provider, ou restreignez l&apos;accès.
          Visibilité = OR entre (org_nodes ∪ groupes ∪ rôles). Les utilisateurs
          nominaux sont une whitelist prioritaire.
        </p>
      </div>

      {/* Visibility toggle */}
      <div className="space-y-2">
        <Label>Visibilité</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={visibility === "all" ? "default" : "outline"}
            onClick={() => handleVisibilityChange("all")}
            size="sm"
          >
            Tous
          </Button>
          <Button
            type="button"
            variant={visibility === "restricted" ? "default" : "outline"}
            onClick={() => handleVisibilityChange("restricted")}
            size="sm"
          >
            Restreint
          </Button>
        </div>
      </div>

      {/* Picker — only when restricted */}
      {visibility === "restricted" && (
        <div className="space-y-4">
          <VisibilityPicker
            value={selection}
            onChange={handleSelectionChange}
          />

          {selection.org_nodes.length === 0 &&
            selection.groups.length === 0 &&
            selection.roles.length === 0 &&
            selection.users.length === 0 && (
              <div className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 p-4 text-sm text-muted-foreground">
                <Info className="inline-block h-3.5 w-3.5 mr-1.5 text-amber-500 align-text-bottom" />
                En mode restreint sans entités sélectionnées, personne ne verra
                ce provider.
              </div>
            )}
        </div>
      )}

      {/* Unrestricted info */}
      {visibility === "all" && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-blue-500/5 p-4 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
          <p>
            Ce provider est visible par{" "}
            <strong className="text-foreground">tous les utilisateurs</strong>{" "}
            du tenant. Activez «&nbsp;Restreint&nbsp;» pour affiner la
            visibilité par nœud org, groupe, rôle ou utilisateur individuel.
          </p>
        </div>
      )}
    </div>
  );
}
