"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { getProvider, upsertProvider } from "@/lib/api/oauth-providers";
import type {
  ProviderConfigDetail,
  UpsertProviderConfigBody,
} from "@/types/oauth-providers";
import { GeneralTab } from "./tabs/GeneralTab";
import { CredentialsTab } from "./tabs/CredentialsTab";
import { VisibilityTab } from "./tabs/VisibilityTab";

interface Props {
  /** Provider key to configure, or null when closed. */
  providerKey: string | null;
  onClose: () => void;
  /** Called after a successful save so the parent can refresh its list. */
  onUpdated: () => void;
}

export function ProviderConfigDrawer({
  providerKey,
  onClose,
  onUpdated,
}: Props) {
  const [detail, setDetail] = useState<ProviderConfigDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Credentials are kept separate — they are write-only (never populated from server).
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  // Fetch detail whenever the drawer opens for a new key.
  useEffect(() => {
    if (!providerKey) {
      setDetail(null);
      setClientId("");
      setClientSecret("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    getProvider(providerKey)
      .then((data) => {
        if (!cancelled) {
          setDetail(data);
          setClientId("");
          setClientSecret("");
        }
      })
      .catch((err) => {
        console.error("getProvider failed", err);
        if (!cancelled) {
          toast.error("Impossible de charger la configuration du provider.");
          onClose();
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [providerKey, onClose]);

  /** Merge a partial patch into the local draft. */
  function patch(partial: Partial<ProviderConfigDetail>) {
    setDetail((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  async function handleSave() {
    if (!detail || !providerKey) return;

    setSaving(true);
    try {
      const body: UpsertProviderConfigBody = {
        enabled: detail.enabled,
        purposes: detail.purposes,
        allowed_scopes: detail.allowed_scopes,
        visibility: detail.visibility,
        visible_to_org_nodes: detail.visible_to_org_nodes,
        visible_to_groups: detail.visible_to_groups,
        visible_to_roles: detail.visible_to_roles,
        visible_to_users: detail.visible_to_users,
        allow_user_override: detail.allow_user_override,
        is_tenant_sso: detail.is_tenant_sso,
        auto_provision_users: detail.auto_provision_users,
        default_role: detail.default_role,
      };

      // Only include credentials if the admin typed something.
      if (clientId.trim()) body.client_id = clientId.trim();
      if (clientSecret.trim()) body.client_secret = clientSecret.trim();

      await upsertProvider(providerKey, body);
      toast.success(`${detail.display_name} mis à jour avec succès.`);
      onUpdated();
      onClose();
    } catch (err) {
      console.error("upsertProvider failed", err);
      toast.error("Échec de la sauvegarde — veuillez réessayer.");
    } finally {
      setSaving(false);
    }
  }

  const open = providerKey !== null;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="flex flex-col gap-0 p-0 sm:max-w-lg md:max-w-xl lg:max-w-2xl"
        showCloseButton={!saving}
      >
        {/* Header */}
        <SheetHeader className="border-b border-border/50 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle className="text-lg font-bold text-foreground leading-tight">
                {detail?.display_name ?? providerKey ?? "Provider"}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                {detail
                  ? `Clé : ${detail.provider_key} · Catégories : ${detail.categories.join(", ")}`
                  : "Chargement…"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading || !detail ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Chargement de la configuration…</span>
            </div>
          ) : (
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="mb-6 w-full justify-start gap-1">
                <TabsTrigger value="general" className="px-4">
                  Général
                </TabsTrigger>
                <TabsTrigger value="credentials" className="px-4">
                  Credentials
                </TabsTrigger>
                <TabsTrigger value="visibility" className="px-4">
                  Visibilité
                </TabsTrigger>
              </TabsList>

              <TabsContent value="general">
                <GeneralTab detail={detail} onChange={patch} />
              </TabsContent>

              <TabsContent value="credentials">
                <CredentialsTab
                  detail={detail}
                  clientId={clientId}
                  clientSecret={clientSecret}
                  onChangeClientId={setClientId}
                  onChangeClientSecret={setClientSecret}
                />
              </TabsContent>

              <TabsContent value="visibility">
                <VisibilityTab detail={detail} onChange={patch} />
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="border-t border-border/50 px-6 py-4 flex-row justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="h-10 px-5 font-semibold"
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !detail}
            className="h-10 px-6 font-semibold bg-primary hover:bg-primary/90"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement…
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
