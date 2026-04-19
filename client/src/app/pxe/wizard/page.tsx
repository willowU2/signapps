"use client";

/**
 * PXE Deployment Wizard — 5-step flow
 *
 * Refactored (S2.T8) from the legacy PX3 template-generation wizard.
 * Each step is delegated to its own component under
 * `@/components/pxe/WizardStep*`. The wizard state persists only in
 * React local state — no global store.
 *
 * Flow:
 *   1. Catalog          — pick an OS image
 *   2. Profile          — pick a boot profile
 *   3. Target           — pick (or type) a MAC address
 *   4. Confirm          — review then kickoff POST /pxe/deployments
 *   5. Progress (SSE)   — LiveDeploymentTerminal streams updates
 */

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { WizardStep1Catalog } from "@/components/pxe/WizardStep1Catalog";
import { WizardStep2Profile } from "@/components/pxe/WizardStep2Profile";
import { WizardStep3Target } from "@/components/pxe/WizardStep3Target";
import { WizardStep4Confirm } from "@/components/pxe/WizardStep4Confirm";
import { WizardStep5Progress } from "@/components/pxe/WizardStep5Progress";
import { usePageTitle } from "@/hooks/use-page-title";

export type WizardState = {
  image?: { name: string; version: string; iso_url: string };
  profile?: { id: string; name: string };
  mac?: string;
};

export default function PxeWizardPage() {
  usePageTitle("Déploiement PXE");
  const [step, setStep] = useState<number>(1);
  const [state, setState] = useState<WizardState>({});

  return (
    <AppLayout>
      <div className="container mx-auto max-w-4xl py-8">
        <h1 className="mb-6 text-3xl font-bold">Déploiement PXE</h1>
        <div className="mb-8 flex gap-2" data-testid="pxe-wizard-stepper">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`h-2 flex-1 rounded ${n <= step ? "bg-primary" : "bg-muted"}`}
              data-testid={`pxe-wizard-step-indicator-${n}`}
            />
          ))}
        </div>

        {step === 1 && (
          <WizardStep1Catalog
            state={state}
            setState={setState}
            next={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <WizardStep2Profile
            state={state}
            setState={setState}
            back={() => setStep(1)}
            next={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <WizardStep3Target
            state={state}
            setState={setState}
            back={() => setStep(2)}
            next={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <WizardStep4Confirm
            state={state}
            back={() => setStep(3)}
            next={() => setStep(5)}
          />
        )}
        {step === 5 && (
          <WizardStep5Progress
            state={state}
            reset={() => {
              setState({});
              setStep(1);
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
