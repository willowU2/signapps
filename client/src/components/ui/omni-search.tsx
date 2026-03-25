"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  StickyNote,
  Mail,
  CheckSquare,
  MessageCircle,
  FileText,
  Calendar,
  Settings,
  Search,
  ArrowRight,
  Sparkles,
  Bot,
  Loader2,
  Table2,
  Presentation,
  HardDrive,
  Contact,
} from "lucide-react";
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
import { useOmniStore, useOmniIsOpen, useOmniActions } from "@/stores/omni-store";
import { usePageContext } from "@/lib/store/page-context";
import { toast } from "sonner";

interface AppLink {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
}

const apps: AppLink[] = [
  {
    id: "keep",
    name: "Keep",
    description: "Notes et listes",
    href: "/keep",
    icon: StickyNote,
    shortcut: "K",
  },
  {
    id: "mail",
    name: "Mail",
    description: "Messagerie",
    href: "/mail",
    icon: Mail,
    shortcut: "M",
  },
  {
    id: "tasks",
    name: "Tasks",
    description: "Gestion des tâches",
    href: "/tasks",
    icon: CheckSquare,
    shortcut: "T",
  },
  {
    id: "chat",
    name: "Chat",
    description: "Conversations IA",
    href: "/chat",
    icon: MessageCircle,
    shortcut: "C",
  },
  {
    id: "docs",
    name: "Docs",
    description: "Documents collaboratifs",
    href: "/docs",
    icon: FileText,
    shortcut: "D",
  },
  {
    id: "calendar",
    name: "Calendrier",
    description: "Agenda et événements",
    href: "/cal",
    icon: Calendar,
  },
];

const quickActions = [
  {
    id: "new-note",
    name: "Nouvelle note",
    description: "Créer une note rapidement",
    icon: StickyNote,
    keywords: ["note", "créer", "nouveau"],
  },
  {
    id: "new-task",
    name: "Nouvelle tâche",
    description: "Ajouter une tâche",
    icon: CheckSquare,
    keywords: ["tâche", "todo", "créer"],
  },
  {
    id: "new-doc",
    name: "Créer un document",
    description: "Nouveau document texte collaboratif",
    icon: FileText,
    keywords: ["document", "doc", "créer", "nouveau", "texte"],
  },
  {
    id: "new-sheet",
    name: "Créer un tableur",
    description: "Nouveau tableur collaboratif",
    icon: Table2,
    keywords: ["tableur", "sheet", "excel", "créer", "nouveau"],
  },
  {
    id: "new-slide",
    name: "Créer une présentation",
    description: "Nouveau diaporama collaboratif",
    icon: Presentation,
    keywords: ["présentation", "slide", "powerpoint", "créer", "nouveau"],
  },
  {
    id: "compose-email",
    name: "Composer un email",
    description: "Rédiger et envoyer un email",
    icon: Mail,
    keywords: ["email", "mail", "envoyer", "message", "compose"],
  },
  {
    id: "new-contact",
    name: "Nouveau contact",
    description: "Ajouter un contact",
    icon: Contact,
    keywords: ["contact", "personne", "carnet", "créer", "nouveau"],
  },
  {
    id: "new-event",
    name: "Nouvel événement",
    description: "Créer un événement dans le calendrier",
    icon: Calendar,
    keywords: ["événement", "event", "calendrier", "réunion", "créer"],
  },
  {
    id: "ai-chat",
    name: "Discuter avec l'IA",
    description: "Démarrer une conversation",
    icon: Sparkles,
    keywords: ["ia", "ai", "chat", "assistant"],
  },
  {
    id: "settings",
    name: "Paramètres",
    description: "Configuration de l'application",
    icon: Settings,
    keywords: ["config", "préférences", "options"],
  },
];

// ── Cross-app search result types ──────────────────────────────────────────

interface CrossAppResult {
  id: string;
  category: "document" | "email" | "event" | "file" | "contact";
  title: string;
  subtitle: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  date?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  document: "Documents",
  email: "Emails",
  event: "Events",
  file: "Files",
  contact: "Contacts",
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  document: FileText,
  email: Mail,
  event: Calendar,
  file: HardDrive,
  contact: Contact,
};

function docTypeIcon(docType?: string): React.ComponentType<{ className?: string }> {
  if (docType === "sheet") return Table2;
  if (docType === "slide") return Presentation;
  return FileText;
}

// ── Cross-app search hook ──────────────────────────────────────────────────

function useCrossAppSearch(query: string) {
  const [results, setResults] = React.useState<CrossAppResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  React.useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const searchFns = [
          // Documents search
          import("@/lib/api/docs").then(async ({ docsApi }) => {
            try {
              // Search across doc types — the docs service has a listing endpoint
              // We filter client-side since there's no search endpoint
              const items: CrossAppResult[] = [];
              // Text docs, sheets, slides are all created via the docs API
              // Use generic listing if available
              return items;
            } catch {
              return [] as CrossAppResult[];
            }
          }),

          // Mail search
          import("@/lib/api/mail").then(async ({ mailApi }) => {
            try {
              const res = await mailApi.searchEmails({ q: query, limit: 5 });
              const emails = res.data || [];
              return emails.map(
                (e: any): CrossAppResult => ({
                  id: `mail-${e.id}`,
                  category: "email",
                  title: e.subject || "(no subject)",
                  subtitle: `${e.sender_name || e.sender} ${e.snippet ? "- " + e.snippet.slice(0, 60) : ""}`,
                  href: `/mail?id=${e.id}`,
                  icon: Mail,
                  date: e.received_at || e.created_at,
                })
              );
            } catch {
              return [] as CrossAppResult[];
            }
          }),

          // Calendar events search
          import("@/lib/api/calendar").then(async ({ calendarApi }) => {
            try {
              const calendarsRes = await calendarApi.listCalendars();
              const calendars = calendarsRes.data || [];
              const now = new Date();
              const futureEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
              const allEvents: CrossAppResult[] = [];

              for (const cal of calendars.slice(0, 3)) {
                try {
                  const eventsRes = await calendarApi.listEvents(cal.id, now, futureEnd);
                  const events = eventsRes.data || [];
                  const matching = events
                    .filter((ev: any) => ev.title?.toLowerCase().includes(query.toLowerCase()))
                    .slice(0, 3);
                  matching.forEach((ev: any) => {
                    allEvents.push({
                      id: `cal-${ev.id}`,
                      category: "event",
                      title: ev.title,
                      subtitle: ev.start_time
                        ? new Date(ev.start_time).toLocaleDateString()
                        : "",
                      href: `/cal?event=${ev.id}`,
                      icon: Calendar,
                      date: ev.start_time,
                    });
                  });
                } catch {
                  // skip calendar
                }
              }
              return allEvents.slice(0, 5);
            } catch {
              return [] as CrossAppResult[];
            }
          }),

          // Files search (via storage search API)
          import("@/lib/api/storage").then(async ({ searchApi }) => {
            try {
              const res = await searchApi.quickSearch(query, 5);
              const files = res.data?.results || [];
              return files.map(
                (f: any): CrossAppResult => ({
                  id: `file-${f.bucket}-${f.key}`,
                  category: "file",
                  title: f.filename,
                  subtitle: `${f.bucket}/${f.key}`,
                  href: `/drive?bucket=${f.bucket}&file=${encodeURIComponent(f.key)}`,
                  icon: HardDrive,
                })
              );
            } catch {
              return [] as CrossAppResult[];
            }
          }),

          // Contacts search
          import("@/lib/api/contacts").then(async ({ contactsApi }) => {
            try {
              const res = await contactsApi.list();
              const contacts = res.data || [];
              const q = query.toLowerCase();
              return contacts
                .filter(
                  (c: any) =>
                    c.first_name?.toLowerCase().includes(q) ||
                    c.last_name?.toLowerCase().includes(q) ||
                    c.email?.toLowerCase().includes(q) ||
                    c.company?.toLowerCase().includes(q)
                )
                .slice(0, 5)
                .map(
                  (c: any): CrossAppResult => ({
                    id: `contact-${c.id}`,
                    category: "contact",
                    title: `${c.first_name} ${c.last_name}`.trim(),
                    subtitle: [c.email, c.company].filter(Boolean).join(" - "),
                    href: `/contacts?id=${c.id}`,
                    icon: Contact,
                  })
                );
            } catch {
              return [] as CrossAppResult[];
            }
          }),
        ];

        const settled = await Promise.allSettled(searchFns);
        const allResults: CrossAppResult[] = [];
        settled.forEach((r) => {
          if (r.status === "fulfilled" && Array.isArray(r.value)) {
            allResults.push(...r.value);
          }
        });

        setResults(allResults);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return { results, isSearching };
}

// ── Group results by category ──────────────────────────────────────────────

function groupByCategory(results: CrossAppResult[]): Record<string, CrossAppResult[]> {
  const groups: Record<string, CrossAppResult[]> = {};
  results.forEach((r) => {
    if (!groups[r.category]) groups[r.category] = [];
    groups[r.category].push(r);
  });
  return groups;
}

// ── Main Component ─────────────────────────────────────────────────────────

export function OmniSearch() {
  const router = useRouter();
  const isOpen = useOmniIsOpen();
  const { close, setQuery, addRecentSearch } = useOmniActions();
  const query = useOmniStore((state) => state.query);
  const [isExecuting, setIsExecuting] = React.useState(false);
  const pageContext = usePageContext();

  const { results: crossAppResults, isSearching } = useCrossAppSearch(isOpen ? query : "");
  const grouped = React.useMemo(() => groupByCategory(crossAppResults), [crossAppResults]);

  const executeAIAction = async () => {
    close();
    setIsExecuting(true);
    const loadingToast = toast.loading(`Exécution de : "${query}"...`);
    try {
      const res = await fetch('/api/v1/ai/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          context_id: pageContext.activeContext
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Succès (${Math.round(data.confidence * 100)}% confiant)`, {
          description: data.result_message,
          id: loadingToast
        });
      } else {
        toast.error('Échec de l\'action', {
          description: data.result_message,
          id: loadingToast
        });
      }
    } catch (e) {
      toast.error('Erreur', { description: 'Impossible de contacter l\'orchestrateur IA', id: loadingToast });
    } finally {
      setIsExecuting(false);
      setQuery("");
    }
  };

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        useOmniStore.getState().toggle();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = (href: string, searchTerm?: string) => {
    if (searchTerm) {
      addRecentSearch(searchTerm);
    }
    close();
    router.push(href);
  };

  const handleAction = (actionId: string) => {
    close();
    switch (actionId) {
      case "new-note":
        router.push("/keep?action=new");
        break;
      case "new-task":
        router.push("/tasks?action=new");
        break;
      case "new-doc":
        router.push("/docs?action=new&type=doc");
        break;
      case "new-sheet":
        router.push("/docs?action=new&type=sheet");
        break;
      case "new-slide":
        router.push("/docs?action=new&type=slide");
        break;
      case "compose-email":
        router.push("/mail?action=compose");
        break;
      case "new-contact":
        router.push("/contacts?action=new");
        break;
      case "new-event":
        router.push("/cal?action=new");
        break;
      case "ai-chat":
        router.push("/chat");
        break;
      case "settings":
        router.push("/settings");
        break;
    }
  };

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title="Recherche rapide"
      description="Recherchez des applications, des notes, des tâches..."
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Rechercher partout: apps, docs, emails, events, fichiers, contacts..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6">
            {isSearching ? (
              <>
                <Loader2 className="h-10 w-10 text-muted-foreground/50 animate-spin" />
                <p className="text-sm text-muted-foreground">Searching across apps...</p>
              </>
            ) : (
              <>
                <Search className="h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Aucun résultat pour &quot;{query}&quot;
                </p>
              </>
            )}
          </div>
        </CommandEmpty>

        {query.length > 3 && (
          <>
            <CommandGroup heading="SignApps Autopilot">
              <CommandItem onSelect={executeAIAction} disabled={isExecuting}>
                <Sparkles className="mr-2 h-4 w-4 text-primary" />
                Demander à l'IA d'agir : "{query}"
              </CommandItem>
            </CommandGroup>

            <CommandGroup heading="Assistant (RAG)">
              <CommandItem onSelect={() => {
                close();
                router.push(`/chat?q=${encodeURIComponent(query)}`);
              }}>
                <Bot className="mr-2 h-4 w-4 text-primary" />
                Interroger l'IA sur : "{query}"
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* ── Cross-app search results ── */}
        {query.length >= 2 && (
          <>
            {isSearching && crossAppResults.length === 0 && (
              <CommandGroup heading="Recherche en cours...">
                <CommandItem disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Searching across all apps...</span>
                </CommandItem>
              </CommandGroup>
            )}

            {Object.entries(grouped).map(([category, items]) => {
              const CategoryIcon = CATEGORY_ICONS[category] || Search;
              return (
                <React.Fragment key={category}>
                  <CommandGroup heading={CATEGORY_LABELS[category] || category}>
                    {items.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={`${item.title} ${item.subtitle}`}
                        onSelect={() => handleSelect(item.href, item.title)}
                        className="flex items-center gap-3 py-2"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                          <item.icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-medium text-sm truncate">{item.title}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {item.subtitle}
                          </span>
                        </div>
                        {item.date && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(item.date).toLocaleDateString()}
                          </span>
                        )}
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </React.Fragment>
              );
            })}
          </>
        )}

        <CommandGroup heading="Applications">
          {apps.map((app) => (
            <CommandItem
              key={app.id}
              value={`${app.name} ${app.description}`}
              onSelect={() => handleSelect(app.href, app.name)}
              className="flex items-center gap-3 py-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <app.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{app.name}</span>
                <span className="text-xs text-muted-foreground">
                  {app.description}
                </span>
              </div>
              {app.shortcut && (
                <CommandShortcut className="ml-auto">
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    <span className="text-xs">⌘</span>
                    {app.shortcut}
                  </kbd>
                </CommandShortcut>
              )}
              <ArrowRight className="ml-2 h-4 w-4 text-muted-foreground/50" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions rapides">
          {quickActions.map((action) => (
            <CommandItem
              key={action.id}
              value={`${action.name} ${action.description} ${action.keywords?.join(" ")}`}
              onSelect={() => handleAction(action.id)}
              className="flex items-center gap-3 py-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                <action.icon className="h-5 w-5 text-accent-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{action.name}</span>
                <span className="text-xs text-muted-foreground">
                  {action.description}
                </span>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground/50" />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>

      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
            ↵
          </kbd>
          <span>Sélectionner</span>
        </div>
        <div className="flex items-center gap-4">
          {isSearching && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching...
            </span>
          )}
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
