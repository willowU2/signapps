"use client";

/**
 * Step 1 — Choose an OS image from the PXE catalog.
 *
 * Loads `/api/v1/pxe/catalog` and renders a searchable list. The
 * selected image is pushed into the parent's WizardState (`.image`).
 */

import { useEffect, useState } from "react";
import { getClient, ServiceName } from "@/lib/api/factory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WizardState } from "@/app/pxe/wizard/page";

type CatalogImage = {
  name: string;
  version: string;
  arch: string;
  iso_url: string;
  size_bytes: number;
  os_type: string;
  category: string;
  description: string;
};

const pxeClient = getClient(ServiceName.PXE);

type Props = {
  state: WizardState;
  setState: (s: WizardState) => void;
  next: () => void;
};

export function WizardStep1Catalog({ state, setState, next }: Props) {
  const [catalog, setCatalog] = useState<CatalogImage[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    pxeClient
      .get<CatalogImage[]>("/pxe/catalog")
      .then((r) => {
        if (!cancelled) setCatalog(r.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = catalog.filter(
    (i) =>
      !filter ||
      i.name.toLowerCase().includes(filter.toLowerCase()) ||
      i.os_type.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-4" data-testid="pxe-wizard-step1">
      <h2 className="text-xl font-semibold">Étape 1 — Choisir l&apos;image</h2>
      <Input
        placeholder="Filtrer par nom ou OS..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Filtrer catalogue"
      />
      <div className="grid max-h-96 grid-cols-1 gap-2 overflow-auto md:grid-cols-2">
        {loading && (
          <div className="text-sm text-muted-foreground">
            Chargement du catalogue...
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Aucune image ne correspond au filtre.
          </div>
        )}
        {filtered.map((img) => {
          const key = `${img.name}-${img.version}`;
          const isSelected = selected === key;
          return (
            <button
              type="button"
              key={key}
              onClick={() => {
                setSelected(key);
                setState({
                  ...state,
                  image: {
                    name: img.name,
                    version: img.version,
                    iso_url: img.iso_url,
                  },
                });
              }}
              className={`rounded border p-3 text-left transition-colors hover:bg-muted ${
                isSelected ? "border-primary bg-muted" : "border-border"
              }`}
              data-testid={`pxe-catalog-${key}`}
            >
              <div className="font-medium">
                {img.name} {img.version}
              </div>
              <div className="text-sm text-muted-foreground">
                {img.os_type} · {img.arch} · {(img.size_bytes / 1e9).toFixed(1)}{" "}
                GB
              </div>
              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {img.description}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end">
        <Button onClick={next} disabled={!state.image}>
          Suivant
        </Button>
      </div>
    </div>
  );
}
