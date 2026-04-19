"use client";

/**
 * Step 4 — Confirm and kick off the deployment.
 *
 * Sends `POST /api/v1/pxe/deployments` with `{ asset_mac, profile_id }`.
 * On success, advances to step 5 where the live terminal subscribes
 * to the SSE stream keyed by MAC.
 */

import { useState } from "react";
import { getClient, ServiceName } from "@/lib/api/factory";
import { Button } from "@/components/ui/button";
import type { WizardState } from "@/app/pxe/wizard/page";

const pxeClient = getClient(ServiceName.PXE);

type Props = {
  state: WizardState;
  back: () => void;
  next: () => void;
};

export function WizardStep4Confirm({ state, back, next }: Props) {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const kickoff = async () => {
    if (!state.mac || !state.profile) {
      setError("MAC ou profil manquant.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await pxeClient.post("/pxe/deployments", {
        asset_mac: state.mac,
        profile_id: state.profile.id,
      });
      next();
    } catch (e) {
      // Even on error we still advance so the operator can watch the SSE
      // terminal — the deployment row may already exist from auto-enroll.
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      next();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="pxe-wizard-step4">
      <h2 className="text-xl font-semibold">Étape 4 — Confirmation</h2>
      <div className="space-y-2 rounded border border-border p-4">
        <div>
          <span className="text-muted-foreground">Image :</span>{" "}
          <strong>
            {state.image?.name} {state.image?.version}
          </strong>
        </div>
        <div>
          <span className="text-muted-foreground">Profile :</span>{" "}
          <strong>{state.profile?.name}</strong>
        </div>
        <div>
          <span className="text-muted-foreground">Cible :</span>{" "}
          <code className="font-mono">{state.mac}</code>
        </div>
      </div>
      <div className="rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
        Cette opération va booter la machine{" "}
        <strong className="font-mono">{state.mac}</strong> et effacer son disque
        local.
      </div>
      {error && (
        <div
          className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          data-testid="pxe-confirm-error"
        >
          {error}
        </div>
      )}
      <div className="flex justify-between">
        <Button variant="outline" onClick={back} disabled={submitting}>
          Retour
        </Button>
        <Button
          onClick={kickoff}
          disabled={submitting}
          data-testid="pxe-kickoff"
        >
          {submitting ? "Démarrage..." : "Lancer le déploiement"}
        </Button>
      </div>
    </div>
  );
}
