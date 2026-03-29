"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Table2,
  Presentation,
  Clock,
  Search,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getClient, ServiceName } from "@/lib/api/factory";

const identityClient = getClient(ServiceName.IDENTITY);

// ── Types ──────────────────────────────────────────────────────────────────

export type DocKind = "text" | "sheet" | "slide";

export interface RecentDocument {
  id: string;
  name: string;
  kind: DocKind;
  href: string;
  lastOpenedAt: string; // ISO
}

// ── Storage helpers ────────────────────────────────────────────────────────

const RECENT_DOCS_KEY = "signapps_recent_docs";
const MAX_RECENT = 20;

export function getRecentDocs(): RecentDocument[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_DOCS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function trackDocVisit(doc: Omit<RecentDocument, "lastOpenedAt">): void {
  const docs = getRecentDocs();
  const filtered = docs.filter((d) => d.id !== doc.id);
  const updated: RecentDocument = { ...doc, lastOpenedAt: new Date().toISOString() };
  const next = [updated, ...filtered].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(next));
  // Sync to API (fire-and-forget)
  identityClient.post('/users/me/recent-docs', {
    doc_id: doc.id,
    name: doc.name,
    kind: doc.kind,
    href: doc.href,
  }).catch(() => {});
}

export function clearRecentDocs(): void {
  localStorage.removeItem(RECENT_DOCS_KEY);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function kindIcon(kind: DocKind) {
  switch (kind) {
    case "sheet":
      return Table2;
    case "slide":
      return Presentation;
    default:
      return FileText;
  }
}

function kindColor(kind: DocKind) {
  switch (kind) {
    case "sheet":
      return "text-green-600";
    case "slide":
      return "text-amber-600";
    default:
      return "text-blue-600";
  }
}

function kindLabel(kind: DocKind) {
  switch (kind) {
    case "sheet":
      return "Sheet";
    case "slide":
      return "Slide";
    default:
      return "Doc";
  }
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

// ── Hook: track doc visits from any component ──────────────────────────────

export function useTrackDocVisit() {
  return React.useCallback((doc: Omit<RecentDocument, "lastOpenedAt">) => {
    trackDocVisit(doc);
  }, []);
}

// ── Quick Switcher Component ───────────────────────────────────────────────

export function QuickSwitcher() {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [recentDocs, setRecentDocs] = React.useState<RecentDocument[]>([]);

  // Register Ctrl+Shift+K shortcut
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "K") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Load recent docs when opening — API first, localStorage fallback
  React.useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    const load = async () => {
      try {
        const res = await identityClient.get<any[]>('/users/me/recent-docs');
        const loaded: RecentDocument[] = (res.data ?? []).map((d: any) => ({
          id: d.doc_id ?? d.id,
          name: d.name ?? '',
          kind: (['text','sheet','slide'].includes(d.kind) ? d.kind : 'text') as DocKind,
          href: d.href ?? `/docs/${d.doc_id ?? d.id}`,
          lastOpenedAt: d.last_opened_at ?? d.lastOpenedAt ?? new Date().toISOString(),
        }));
        setRecentDocs(loaded);
        localStorage.setItem(RECENT_DOCS_KEY, JSON.stringify(loaded));
      } catch {
        setRecentDocs(getRecentDocs());
      }
    };
    load();
  }, [isOpen]);

  const filteredDocs = React.useMemo(() => {
    if (!query.trim()) return recentDocs;
    const q = query.toLowerCase();
    return recentDocs.filter(
      (doc) =>
        doc.name.toLowerCase().includes(q) ||
        kindLabel(doc.kind).toLowerCase().includes(q)
    );
  }, [recentDocs, query]);

  const handleSelect = (doc: RecentDocument) => {
    // Track visit again (moves to top)
    trackDocVisit({ id: doc.id, name: doc.name, kind: doc.kind, href: doc.href });
    setIsOpen(false);
    router.push(doc.href);
  };

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      title="Quick Document Switcher"
      description="Switch between recently opened documents"
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Rechercher..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6">
            <Search className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {recentDocs.length === 0
                ? "No recent documents yet."
                : `No documents matching "${query}"`}
            </p>
          </div>
        </CommandEmpty>

        {filteredDocs.length > 0 && (
          <CommandGroup heading="Recent Documents">
            {filteredDocs.map((doc) => {
              const Icon = kindIcon(doc.kind);
              return (
                <CommandItem
                  key={doc.id}
                  value={`${doc.name} ${kindLabel(doc.kind)}`}
                  onSelect={() => handleSelect(doc)}
                  className="flex items-center gap-3 py-2.5"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", kindColor(doc.kind))} />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium text-sm truncate">{doc.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {kindLabel(doc.kind)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {timeAgo(doc.lastOpenedAt)}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>

      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
            ↵
          </kbd>
          <span>Open</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
              ⌘⇧K
            </kbd>
            <span>Toggle</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
              esc
            </kbd>
            <span>Fermer</span>
          </div>
        </div>
      </div>
    </CommandDialog>
  );
}
