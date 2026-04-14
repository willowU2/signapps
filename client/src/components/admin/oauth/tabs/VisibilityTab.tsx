"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import type { ProviderConfigDetail } from "@/types/oauth-providers";

interface Props {
  detail: ProviderConfigDetail;
  onChange: (patch: Partial<ProviderConfigDetail>) => void;
}

export function VisibilityTab({ detail, onChange }: Props) {
  const isRestricted = detail.visibility === "restricted";
  const totalRestrictions =
    detail.visible_to_org_nodes.length +
    detail.visible_to_groups.length +
    detail.visible_to_roles.length +
    detail.visible_to_users.length;

  return (
    <div className="space-y-6">
      {/* Visibility mode toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
        <div className="space-y-0.5">
          <Label className="text-sm font-semibold text-foreground">
            Accès restreint
          </Label>
          <p className="text-xs text-muted-foreground">
            Lorsqu&apos;activé, seuls les utilisateurs des entités sélectionnées
            ci-dessous peuvent utiliser ce provider.
          </p>
        </div>
        <Switch
          checked={isRestricted}
          onCheckedChange={(checked) =>
            onChange({ visibility: checked ? "restricted" : "all" })
          }
        />
      </div>

      {/* Info banner when unrestricted */}
      {!isRestricted && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-blue-500/5 p-4 text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
          <p>
            Ce provider est visible par{" "}
            <strong className="text-foreground">tous les utilisateurs</strong>{" "}
            du tenant. Activez «&nbsp;Accès restreint&nbsp;» pour affiner la
            visibilité par nœud org, groupe, rôle ou utilisateur individuel.
          </p>
        </div>
      )}

      {/* Restriction summary when restricted */}
      {isRestricted && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-amber-500/5 p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
            <p>
              Le sélecteur de visibilité avancé (nœuds org, groupes, rôles,
              utilisateurs) sera disponible à la{" "}
              <strong className="text-foreground">prochaine tâche</strong> (P6T7
              — VisibilityPicker). Pour l&apos;instant vous pouvez enregistrer
              la restriction globale.
            </p>
          </div>

          {/* Current restrictions summary */}
          {totalRestrictions > 0 ? (
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-foreground">
                Restrictions actuelles
              </Label>
              <div className="flex flex-wrap gap-2">
                {detail.visible_to_org_nodes.map((id) => (
                  <Badge key={id} variant="outline" className="text-xs">
                    Nœud : {id.slice(0, 8)}…
                  </Badge>
                ))}
                {detail.visible_to_groups.map((id) => (
                  <Badge key={id} variant="outline" className="text-xs">
                    Groupe : {id.slice(0, 8)}…
                  </Badge>
                ))}
                {detail.visible_to_roles.map((id) => (
                  <Badge key={id} variant="outline" className="text-xs">
                    Rôle : {id}
                  </Badge>
                ))}
                {detail.visible_to_users.map((id) => (
                  <Badge key={id} variant="outline" className="text-xs">
                    Utilisateur : {id.slice(0, 8)}…
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Aucune restriction définie.
              <br />
              <span className="text-xs">
                En mode restreint sans entités sélectionnées, personne ne verra
                ce provider.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
