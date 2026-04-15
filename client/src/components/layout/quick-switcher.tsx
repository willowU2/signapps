"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Table2, Presentation, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type RecentDocument,
  type DocKind,
  getRecentDocs,
  trackDocVisit,
} from "@/components/ui/quick-switcher";
import { getClient, ServiceName } from "@/lib/api/factory";

const identityClient = getClient(ServiceName.IDENTITY);

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
      return "text-green-500";
    case "slide":
      return "text-amber-500";
    default:
      return "text-blue-500";
  }
}

function kindBg(kind: DocKind) {
  switch (kind) {
    case "sheet":
      return "bg-green-500/10";
    case "slide":
      return "bg-amber-500/10";
    default:
      return "bg-blue-500/10";
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
  if (minutes < 1) return "a l'instant";
  if (minutes < 60) return `il y a ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return new Date(isoDate).toLocaleDateString("fr-FR");
}

const MAX_VISIBLE = 8;

// ── Quick Switcher Overlay (Ctrl+Tab) ──────────────────────────────────────

export function QuickDocumentSwitcher() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [docs, setDocs] = useState<RecentDocument[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isCtrlHeld = useRef(false);

  // Load recent docs from API / localStorage
  const loadDocs = useCallback(async () => {
    try {
      const res = await identityClient.get<any[]>("/users/me/recent-docs");
      const loaded: RecentDocument[] = (res.data ?? []).map((d: any) => ({
        id: d.doc_id ?? d.id,
        name: d.name ?? "",
        kind: (["text", "sheet", "slide"].includes(d.kind)
          ? d.kind
          : "text") as DocKind,
        href: d.href ?? `/docs/${d.doc_id ?? d.id}`,
        lastOpenedAt:
          d.last_opened_at ?? d.lastOpenedAt ?? new Date().toISOString(),
      }));
      setDocs(loaded.slice(0, MAX_VISIBLE));
    } catch {
      setDocs(getRecentDocs().slice(0, MAX_VISIBLE));
    }
  }, []);

  // Open on Ctrl+Tab, cycle on repeated Tab, close on Ctrl release
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Tab → open switcher
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();

        if (!isOpen) {
          isCtrlHeld.current = true;
          loadDocs();
          setSelectedIndex(0);
          setIsOpen(true);
        } else {
          // Cycle through items (Tab = forward, Shift+Tab = backward)
          setSelectedIndex((prev) => {
            const max = Math.max(docs.length - 1, 0);
            if (e.shiftKey) {
              return prev <= 0 ? max : prev - 1;
            }
            return prev >= max ? 0 : prev + 1;
          });
        }
        return;
      }

      // Arrow keys while open
      if (isOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev >= docs.length - 1 ? 0 : prev + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev <= 0 ? docs.length - 1 : prev - 1));
        } else if (e.key === "Enter") {
          e.preventDefault();
          // Navigate to selected doc
          const doc = docs[selectedIndex];
          if (doc) {
            trackDocVisit({
              id: doc.id,
              name: doc.name,
              kind: doc.kind,
              href: doc.href,
            });
            setIsOpen(false);
            router.push(doc.href);
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          setIsOpen(false);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // When Ctrl is released while switcher is open, navigate to selected
      if (
        (e.key === "Control" || e.key === "Meta") &&
        isOpen &&
        isCtrlHeld.current
      ) {
        isCtrlHeld.current = false;
        const doc = docs[selectedIndex];
        if (doc) {
          trackDocVisit({
            id: doc.id,
            name: doc.name,
            kind: doc.kind,
            href: doc.href,
          });
          setIsOpen(false);
          router.push(doc.href);
        } else {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keyup", handleKeyUp, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [isOpen, docs, selectedIndex, loadDocs, router]);

  // Scroll selected item into view
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const items = containerRef.current.querySelectorAll("[data-switcher-item]");
    items[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Switcher overlay */}
      <div
        ref={containerRef}
        className="fixed left-1/2 top-1/2 z-[101] -translate-x-1/2 -translate-y-1/2 w-[420px] max-h-[480px] rounded-xl border border-border/60 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                Ctrl
              </kbd>
              <span>+</span>
              <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                Tab
              </kbd>
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Documents recents
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Document list */}
        <div className="overflow-y-auto max-h-[400px] py-1">
          {docs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <FileText className="h-10 w-10 opacity-40" />
              <p className="text-sm">Aucun document recent</p>
              <p className="text-xs">
                Ouvrez un document pour le voir apparaitre ici.
              </p>
            </div>
          ) : (
            docs.map((doc, index) => {
              const Icon = kindIcon(doc.kind);
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={doc.id}
                  data-switcher-item
                  role="button"
                  tabIndex={-1}
                  onClick={() => {
                    trackDocVisit({
                      id: doc.id,
                      name: doc.name,
                      kind: doc.kind,
                      href: doc.href,
                    });
                    setIsOpen(false);
                    router.push(doc.href);
                  }}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 mx-1 rounded-lg cursor-pointer transition-colors",
                    isSelected
                      ? "bg-primary/10 text-foreground ring-1 ring-primary/30"
                      : "hover:bg-muted/60 text-foreground/80",
                  )}
                >
                  {/* Doc type icon */}
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      kindBg(doc.kind),
                    )}
                  >
                    <Icon className={cn("h-4.5 w-4.5", kindColor(doc.kind))} />
                  </div>

                  {/* Doc info */}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">
                      {doc.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {kindLabel(doc.kind)}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {timeAgo(doc.lastOpenedAt)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/40 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[9px]">
                ↑↓
              </kbd>
              Naviguer
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[9px]">
                ↵
              </kbd>
              Ouvrir
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[9px]">
              Esc
            </kbd>
            Fermer
          </span>
        </div>
      </div>
    </>
  );
}
