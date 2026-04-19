/**
 * `/directory` — SO5 mobile directory entry point.
 *
 * Responsive: mobile-first on small screens (stacked list + drawer), desktop
 * gets a 12-column grid with the list in the left 5 cols and the detail in
 * the right 7 cols.
 *
 * Everyone authenticated can open this page — route protection is handled
 * globally by `AuthProvider`.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  useDirectoryStore,
  selectFilteredPersons,
} from "@/stores/directory-store";
import type { Person } from "@/types/org";
import { PersonCard } from "@/components/directory/person-card";
import { PersonDetailDrawer } from "@/components/directory/person-detail-drawer";
import { SearchBar } from "@/components/directory/search-bar";
import { FilterChips } from "@/components/directory/filter-chips";

export default function DirectoryPage() {
  usePageTitle("Annuaire");
  const router = useRouter();

  const {
    persons,
    nodes,
    loading,
    error,
    query,
    filters,
    loadAll,
    setQuery,
    setFilters,
    clearFilters,
  } = useDirectoryStore();

  // Memoized filtered list — recomputed only when inputs change.
  const filteredPersons = useMemo(
    () =>
      selectFilteredPersons({
        persons,
        nodes,
        skills: [],
        lastFetchedAt: null,
        loading: false,
        error: null,
        filters,
        query,
        loadAll,
        invalidate: () => {},
        reset: () => {},
        setQuery: () => {},
        setFilters: () => {},
        clearFilters: () => {},
      }),
    [persons, nodes, filters, query, loadAll],
  );

  // Selected person for the detail drawer (desktop) / sheet (mobile).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo<Person | null>(
    () => filteredPersons.find((p) => p.id === selectedId) ?? null,
    [filteredPersons, selectedId],
  );

  const handleSelect = useCallback((p: Person) => {
    setSelectedId(p.id);
  }, []);

  const handleCloseDetail = useCallback(() => setSelectedId(null), []);

  // Kick off initial load — the store itself handles the 5-min TTL so
  // re-mounting the page after a quick navigation won't re-fetch.
  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // ─── Header (sticky, mobile-first) ──────────────────────────────────
  const header = (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/90 px-3 py-2 backdrop-blur-xl">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => router.back()}
        aria-label="Retour"
        className="shrink-0"
      >
        <ArrowLeft className="size-5" />
      </Button>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Users className="size-4" />
        <span>Annuaire</span>
        {persons.length > 0 ? (
          <span className="text-muted-foreground font-normal">
            ({persons.length})
          </span>
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void loadAll({ force: true })}
          aria-label="Actualiser"
          className="shrink-0"
          disabled={loading}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </header>
  );

  return (
    <>
      {header}

      <div className="md:grid md:grid-cols-12 md:gap-4 md:px-4 md:py-3 md:flex-1 md:overflow-hidden">
        {/* ── List column ────────────────────────────────────────────── */}
        <section
          className="flex min-h-0 flex-1 flex-col overflow-hidden md:col-span-5"
          aria-label="Liste des personnes"
        >
          <div className="sticky top-[49px] z-10 flex flex-col gap-2 border-b bg-background px-3 py-2 md:static md:border-none md:px-0 md:py-0">
            <SearchBar
              value={query}
              onChange={setQuery}
              onClear={() => setQuery("")}
              placeholder="Rechercher une personne…"
            />
            <FilterChips
              nodes={nodes}
              filters={filters}
              onChange={setFilters}
              onReset={clearFilters}
            />
          </div>

          {/* ── List body ─────────────────────────────────────────── */}
          <div
            className="flex-1 overflow-y-auto px-3 py-2 md:px-0"
            data-testid="directory-list"
          >
            {loading && persons.length === 0 ? (
              <LoadingState variant="skeleton" />
            ) : error && persons.length === 0 ? (
              <ErrorState
                title="Impossible de charger l'annuaire"
                message={error}
                onRetry={() => void loadAll({ force: true })}
              />
            ) : filteredPersons.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Aucune personne trouvée
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {filteredPersons.map((p) => (
                  <li key={p.id}>
                    <PersonCard
                      person={p}
                      selected={p.id === selectedId}
                      onClick={() => handleSelect(p)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── Desktop detail pane ───────────────────────────────────── */}
        <section
          className="hidden min-h-0 md:col-span-7 md:flex md:flex-col md:overflow-hidden md:rounded-lg md:border md:bg-card"
          aria-label="Détail de la personne sélectionnée"
        >
          {selected ? (
            <PersonDetailDrawer
              person={selected}
              nodes={nodes}
              onClose={handleCloseDetail}
              embedded
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
              Sélectionnez une personne pour voir les détails
            </div>
          )}
        </section>
      </div>

      {/* ── Mobile drawer (Sheet full screen) ──────────────────────── */}
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) handleCloseDetail();
        }}
      >
        <SheetContent
          side="right"
          className="w-full max-w-full border-l-0 p-0 md:hidden sm:max-w-full md:max-w-full lg:max-w-full"
        >
          <SheetTitle className="sr-only">
            {selected
              ? `${selected.first_name} ${selected.last_name}`
              : "Détails"}
          </SheetTitle>
          {selected ? (
            <PersonDetailDrawer
              person={selected}
              nodes={nodes}
              onClose={handleCloseDetail}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
