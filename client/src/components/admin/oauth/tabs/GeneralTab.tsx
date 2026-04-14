"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import type { ProviderConfigDetail } from "@/types/oauth-providers";

const ALL_PURPOSES = ["login", "integration"] as const;

interface Props {
  detail: ProviderConfigDetail;
  onChange: (patch: Partial<ProviderConfigDetail>) => void;
}

export function GeneralTab({ detail, onChange }: Props) {
  return (
    <div className="space-y-6">
      {/* Enabled toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
        <div className="space-y-0.5">
          <Label className="text-sm font-semibold text-foreground">
            Activer ce provider
          </Label>
          <p className="text-xs text-muted-foreground">
            Le provider sera disponible selon la visibilité configurée.
          </p>
        </div>
        <Switch
          checked={detail.enabled}
          onCheckedChange={(checked) => onChange({ enabled: checked })}
        />
      </div>

      {/* Allow user override */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
        <div className="space-y-0.5">
          <Label className="text-sm font-semibold text-foreground">
            Autoriser l&apos;override utilisateur
          </Label>
          <p className="text-xs text-muted-foreground">
            Les utilisateurs peuvent activer / désactiver ce provider pour leur
            propre compte.
          </p>
        </div>
        <Switch
          checked={detail.allow_user_override}
          onCheckedChange={(checked) =>
            onChange({ allow_user_override: checked })
          }
        />
      </div>

      {/* Purposes */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold text-foreground">
          Usages (purposes)
        </Label>
        <p className="text-xs text-muted-foreground -mt-1">
          Sélectionnez les contextes dans lesquels ce provider est utilisé.
        </p>
        <div className="flex flex-col gap-2">
          {ALL_PURPOSES.map((purpose) => (
            <label
              key={purpose}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-muted/10 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <Checkbox
                checked={detail.purposes.includes(purpose)}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...detail.purposes, purpose]
                    : detail.purposes.filter((p) => p !== purpose);
                  onChange({ purposes: next });
                }}
              />
              <div>
                <span className="text-sm font-medium text-foreground capitalize">
                  {purpose}
                </span>
                <p className="text-xs text-muted-foreground">
                  {purpose === "login"
                    ? "Authentification SSO — bouton présent sur la page de connexion."
                    : "Intégration tierce — synchronisation mail, calendrier, etc."}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* SSO-specific options */}
      {detail.purposes.includes("login") && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
          <Label className="text-sm font-semibold text-foreground">
            Options SSO
          </Label>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm text-foreground">
                Provider SSO tenant
              </Label>
              <p className="text-xs text-muted-foreground">
                Marquer comme provider SSO principal du tenant.
              </p>
            </div>
            <Switch
              checked={detail.is_tenant_sso}
              onCheckedChange={(checked) =>
                onChange({ is_tenant_sso: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm text-foreground">
                Provisionnement automatique
              </Label>
              <p className="text-xs text-muted-foreground">
                Créer automatiquement le compte utilisateur à la première
                connexion.
              </p>
            </div>
            <Switch
              checked={detail.auto_provision_users}
              onCheckedChange={(checked) =>
                onChange({ auto_provision_users: checked })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
