"use client";

/**
 * Step 2 — Choose a boot profile.
 *
 * Loads `/api/v1/pxe/profiles` and renders a list of PxeProfile rows.
 * The selected profile `.id` and `.name` are pushed into
 * the parent's WizardState (`.profile`).
 */

import { useEffect, useState } from "react";
import { getClient, ServiceName } from "@/lib/api/factory";
import { Button } from "@/components/ui/button";
import type { WizardState } from "@/app/pxe/wizard/page";

type Profile = {
  id: string;
  name: string;
  description?: string;
};

const pxeClient = getClient(ServiceName.PXE);

type Props = {
  state: WizardState;
  setState: (s: WizardState) => void;
  back: () => void;
  next: () => void;
};

export function WizardStep2Profile({ state, setState, back, next }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    pxeClient
      .get<Profile[]>("/pxe/profiles")
      .then((r) => {
        if (!cancelled) setProfiles(r.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setProfiles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4" data-testid="pxe-wizard-step2">
      <h2 className="text-xl font-semibold">
        Étape 2 — Choisir le profil de boot
      </h2>
      <div className="space-y-2">
        {loading && (
          <div className="text-sm text-muted-foreground">
            Chargement des profils...
          </div>
        )}
        {!loading && profiles.length === 0 && (
          <div className="rounded border border-border p-3 text-sm text-muted-foreground">
            Aucun profil configuré. Créez-en un via l&apos;administration.
          </div>
        )}
        {profiles.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() =>
              setState({ ...state, profile: { id: p.id, name: p.name } })
            }
            className={`w-full rounded border p-3 text-left transition-colors hover:bg-muted ${
              state.profile?.id === p.id
                ? "border-primary bg-muted"
                : "border-border"
            }`}
            data-testid={`pxe-profile-${p.id}`}
          >
            <div className="font-medium">{p.name}</div>
            {p.description && (
              <div className="text-sm text-muted-foreground">
                {p.description}
              </div>
            )}
          </button>
        ))}
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={back}>
          Retour
        </Button>
        <Button onClick={next} disabled={!state.profile}>
          Suivant
        </Button>
      </div>
    </div>
  );
}
