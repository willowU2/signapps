"use client";

/**
 * Step 5 — Live deployment progress.
 *
 * Delegates to [`LiveDeploymentTerminal`] which subscribes to the
 * SSE stream for the selected MAC and renders a progress bar plus a
 * pseudo-terminal log.
 */

import { LiveDeploymentTerminal } from "./LiveDeploymentTerminal";
import { Button } from "@/components/ui/button";
import type { WizardState } from "@/app/pxe/wizard/page";

type Props = {
  state: WizardState;
  reset: () => void;
};

export function WizardStep5Progress({ state, reset }: Props) {
  return (
    <div className="space-y-4" data-testid="pxe-wizard-step5">
      <h2 className="text-xl font-semibold">Étape 5 — Déploiement en cours</h2>
      {state.mac ? (
        <LiveDeploymentTerminal mac={state.mac} />
      ) : (
        <div className="text-sm text-muted-foreground">
          Aucune cible sélectionnée.
        </div>
      )}
      <div className="flex justify-end">
        <Button variant="outline" onClick={reset}>
          Nouveau déploiement
        </Button>
      </div>
    </div>
  );
}
