"use client";

import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { LoadingState } from "@/components/ui/loading-state";
import { ProviderCard } from "@/components/admin/oauth/ProviderCard";
import { ProviderConfigDrawer } from "@/components/admin/oauth/ProviderConfigDrawer";
import { listProviders } from "@/lib/api/oauth-providers";
import type {
  ProviderConfigSummary,
  ProviderCategory,
} from "@/types/oauth-providers";
import { ShieldCheck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORIES: (ProviderCategory | "All")[] = [
  "All",
  "Mail",
  "Calendar",
  "Drive",
  "Social",
  "Sso",
  "Chat",
  "Dev",
  "Crm",
  "Other",
];

export default function OAuthProvidersPage() {
  const [providers, setProviders] = useState<ProviderConfigSummary[] | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProviderCategory | "All">("All");
  const [drawerKey, setDrawerKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listProviders()
      .then((data) => {
        if (!cancelled) setProviders(data);
      })
      .catch((err) => {
        console.error("listProviders failed", err);
        if (!cancelled) setProviders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!providers) return [];
    return providers.filter((p) => {
      if (category !== "All" && !p.categories.includes(category)) return false;
      if (
        search &&
        !p.display_name.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [providers, search, category]);

  // Group by primary category for visual scanning
  const grouped = useMemo(() => {
    const groups = new Map<ProviderCategory, ProviderConfigSummary[]>();
    for (const p of filtered) {
      const primary = (p.categories[0] ?? "Other") as ProviderCategory;
      if (!groups.has(primary)) groups.set(primary, []);
      groups.get(primary)!.push(p);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="OAuth Providers"
          description="Configurez les fournisseurs OAuth disponibles pour votre tenant. Activez, fournissez les credentials, et restreignez la visibilité par département, groupe ou rôle."
          icon={<ShieldCheck className="h-5 w-5 text-primary" />}
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Rechercher un provider..."
            containerClassName="max-w-xs"
          />
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as ProviderCategory | "All")}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "All" ? "Toutes catégories" : c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {providers === null ? (
          <LoadingState variant="skeleton" />
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Aucun provider ne correspond.</p>
            <p className="text-xs mt-1">
              Modifiez votre recherche ou la catégorie sélectionnée.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([cat, list]) => (
              <section key={cat}>
                <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                  {cat} ({list.length})
                </h2>
                <div className="grid gap-2">
                  {list.map((p) => (
                    <ProviderCard
                      key={p.provider_key}
                      provider={p}
                      onConfigure={(key) => setDrawerKey(key)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <ProviderConfigDrawer
        providerKey={drawerKey}
        onClose={() => setDrawerKey(null)}
        onUpdated={() =>
          listProviders()
            .then(setProviders)
            .catch((err) => console.error("listProviders refresh failed", err))
        }
      />
    </AppLayout>
  );
}
