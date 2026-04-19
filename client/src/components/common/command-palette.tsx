/**
 * SO3 — Global Command Palette (⌘K / Ctrl+K).
 *
 * Opens on the `toggle-command-palette` custom event dispatched by
 * `use-keyboard-shortcuts`. Performs a debounced `orgApi.search()`
 * against the active tenant and shows 3 buckets (persons, nodes, skills)
 * with a click-to-navigate behavior.
 *
 * Mounted once globally from `AppLayout`.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, SearchIcon, User, Wrench } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useGlobalSearch } from "@/hooks/use-global-search";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { data, isLoading } = useGlobalSearch(query);

  // Wire up the global ⌘K shortcut event.
  useEffect(() => {
    const handler = () => {
      setOpen((prev) => !prev);
    };
    document.addEventListener("toggle-command-palette", handler);
    return () =>
      document.removeEventListener("toggle-command-palette", handler);
  }, []);

  // Clear query when closing.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const navigateTo = (href: string) => {
    router.push(href);
    setOpen(false);
  };

  const persons = data?.persons ?? [];
  const nodes = data?.nodes ?? [];
  const skills = data?.skills ?? [];
  const hasAny = persons.length > 0 || nodes.length > 0 || skills.length > 0;

  return (
    <CommandDialog
      title="Recherche globale"
      description="Cherchez des personnes, équipes ou compétences"
      open={open}
      onOpenChange={setOpen}
    >
      <CommandInput
        placeholder="Rechercher… (persons, équipes, skills)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isLoading && query.trim().length > 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <SearchIcon className="mx-auto mb-2 size-5 animate-pulse" />
            Recherche en cours…
          </div>
        ) : null}

        {!isLoading && query.trim().length > 0 && !hasAny ? (
          <CommandEmpty>Aucun résultat.</CommandEmpty>
        ) : null}

        {persons.length > 0 ? (
          <CommandGroup heading={`Personnes (${persons.length})`}>
            {persons.map((p) => (
              <CommandItem
                key={p.id}
                value={`person-${p.id}`}
                onSelect={() =>
                  navigateTo(`/admin/org-structure?person=${p.id}`)
                }
              >
                <User className="text-muted-foreground" />
                <span className="font-medium">
                  {p.first_name} {p.last_name}
                </span>
                {p.email ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {p.email}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {persons.length > 0 && nodes.length > 0 ? <CommandSeparator /> : null}

        {nodes.length > 0 ? (
          <CommandGroup heading={`Équipes & noeuds (${nodes.length})`}>
            {nodes.map((n) => (
              <CommandItem
                key={n.id}
                value={`node-${n.id}`}
                onSelect={() => navigateTo(`/admin/org-structure?node=${n.id}`)}
              >
                <Building2 className="text-muted-foreground" />
                <span className="font-medium">{n.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {n.kind}
                  {n.slug ? ` · ${n.slug}` : ""}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {(persons.length > 0 || nodes.length > 0) && skills.length > 0 ? (
          <CommandSeparator />
        ) : null}

        {skills.length > 0 ? (
          <CommandGroup heading={`Compétences (${skills.length})`}>
            {skills.map((s) => (
              <CommandItem
                key={s.id}
                value={`skill-${s.id}`}
                onSelect={() =>
                  navigateTo(`/admin/org-structure?skill=${s.id}`)
                }
              >
                <Wrench className="text-muted-foreground" />
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {s.category}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {query.trim().length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Tapez au moins 2 caractères pour rechercher
            <div className="mt-2 text-xs">
              Appuyez sur{" "}
              <CommandShortcut className="ml-0 inline-block rounded border px-1.5 py-0.5">
                Ctrl+K
              </CommandShortcut>{" "}
              pour ouvrir ou fermer.
            </div>
          </div>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
