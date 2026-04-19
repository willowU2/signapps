"use client";

/**
 * Step 3 — Choose a target machine (MAC address).
 *
 * Loads `/api/v1/pxe/assets/discovered` for the pick-list and also lets
 * the operator type a MAC manually. Pushes the chosen MAC into the
 * parent's WizardState (`.mac`).
 */

import { useEffect, useState } from "react";
import { getClient, ServiceName } from "@/lib/api/factory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WizardState } from "@/app/pxe/wizard/page";

type DiscoveredAsset = {
  mac_address: string;
  last_seen?: string;
  dhcp_vendor_class?: string;
};

const pxeClient = getClient(ServiceName.PXE);

type Props = {
  state: WizardState;
  setState: (s: WizardState) => void;
  back: () => void;
  next: () => void;
};

export function WizardStep3Target({ state, setState, back, next }: Props) {
  const [discovered, setDiscovered] = useState<DiscoveredAsset[]>([]);
  const [manualMac, setManualMac] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    pxeClient
      .get<DiscoveredAsset[]>("/pxe/assets/discovered")
      .then((r) => {
        if (!cancelled) setDiscovered(r.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setDiscovered([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setMac = (mac: string) => setState({ ...state, mac });

  return (
    <div className="space-y-4" data-testid="pxe-wizard-step3">
      <h2 className="text-xl font-semibold">
        Étape 3 — Choisir la machine cible
      </h2>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Assets découverts récemment
        </label>
        <div className="max-h-64 space-y-2 overflow-auto">
          {discovered.length === 0 && (
            <div className="text-sm text-muted-foreground">
              Aucun asset discover — saisissez une MAC manuellement.
            </div>
          )}
          {discovered.map((a) => (
            <button
              type="button"
              key={a.mac_address}
              onClick={() => setMac(a.mac_address)}
              className={`w-full rounded border p-2 text-left transition-colors hover:bg-muted ${
                state.mac === a.mac_address
                  ? "border-primary bg-muted"
                  : "border-border"
              }`}
              data-testid={`pxe-discovered-${a.mac_address}`}
            >
              <span className="font-mono">{a.mac_address}</span>
              {a.dhcp_vendor_class && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {a.dhcp_vendor_class}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">
          Ou saisir une MAC manuellement
        </label>
        <div className="flex gap-2">
          <Input
            placeholder="aa:bb:cc:dd:ee:ff"
            value={manualMac}
            onChange={(e) => setManualMac(e.target.value)}
            data-testid="pxe-mac-input"
          />
          <Button
            variant="secondary"
            onClick={() => setMac(manualMac)}
            disabled={!manualMac}
          >
            Utiliser
          </Button>
        </div>
      </div>

      {state.mac && (
        <div
          className="rounded border border-border bg-muted p-2 text-sm"
          data-testid="pxe-mac-summary"
        >
          Cible : <span className="font-mono">{state.mac}</span>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={back}>
          Retour
        </Button>
        <Button onClick={next} disabled={!state.mac}>
          Suivant
        </Button>
      </div>
    </div>
  );
}
