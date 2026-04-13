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
  Users,
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
import {
  useOmniStore,
  useOmniIsOpen,
  useOmniActions,
} from "@/stores/omni-store";
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
  category:
    | "user"
    | "contact"
    | "event"
    | "document"
    | "file"
    | "email"
    | "task"
    | "chat"
    | "note";
  title: string;
  subtitle: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  date?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  user: "Utilisateurs",
  contact: "Contacts",
  event: "Événements",
  document: "Documents",
  file: "Fichiers",
  email: "Emails",
  task: "Tâches",
  chat: "Messages",
  note: "Notes",
};

const CATEGORY_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  user: Users,
  contact: Contact,
  event: Calendar,
  document: FileText,
  file: HardDrive,
  email: Mail,
  task: CheckSquare,
  chat: MessageCircle,
  note: StickyNote,
};

function docTypeIcon(
  docType?: string,
): React.ComponentType<{ className?: string }> {
  if (docType === "sheet") return Table2;
  if (docType === "slide") return Presentation;
  return FileText;
}

// ── Cross-app search hook ──────────────────────────────────────────────────

function useCrossAppSearch(query: string) {
  const [results, setResults] = React.useState<CrossAppResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const q = query.toLowerCase();

      const searchFns: Promise<CrossAppResult[]>[] = [
        // ── 1. Identity users ─────────────────────────────────────────
        import("@/lib/api/identity").then(async ({ usersApi }) => {
          try {
            const res = await usersApi.list(0, 50);
            const users = res.data?.users || [];
            return users
              .filter(
                (u) =>
                  u.username?.toLowerCase().includes(q) ||
                  u.display_name?.toLowerCase().includes(q) ||
                  u.email?.toLowerCase().includes(q),
              )
              .slice(0, 5)
              .map(
                (u): CrossAppResult => ({
                  id: `user-${u.id}`,
                  category: "user",
                  title: u.display_name || u.username || "",
                  subtitle: [u.email, u.department].filter(Boolean).join(" - "),
                  href: `/workforce?user=${u.id}`,
                  icon: Users,
                  date: u.last_login,
                }),
              );
          } catch {
            return [] as CrossAppResult[];
          }
        }),

        // ── 2. Contacts ───────────────────────────────────────────────
        import("@/lib/api/contacts").then(async ({ contactsApi }) => {
          try {
            const res = await contactsApi.list();
            const contacts = res.data || [];
            return contacts
              .filter(
                (c) =>
                  c.first_name?.toLowerCase().includes(q) ||
                  c.last_name?.toLowerCase().includes(q) ||
                  c.email?.toLowerCase().includes(q) ||
                  c.company?.toLowerCase().includes(q) ||
                  c.organization?.toLowerCase().includes(q),
              )
              .slice(0, 5)
              .map(
                (c): CrossAppResult => ({
                  id: `contact-${c.id}`,
                  category: "contact",
                  title: `${c.first_name} ${c.last_name}`.trim(),
                  subtitle: [c.email, c.organization || c.company]
                    .filter(Boolean)
                    .join(" - "),
                  href: `/contacts?id=${c.id}`,
                  icon: Contact,
                }),
              );
          } catch {
            return [] as CrossAppResult[];
          }
        }),

        // ── 3. Calendar events ────────────────────────────────────────
        import("@/lib/api/calendar").then(async ({ calendarApi }) => {
          try {
            const calendarsRes = await calendarApi.listCalendars();
            const calendars = calendarsRes.data || [];
            const now = new Date();
            const futureEnd = new Date(
              now.getTime() + 365 * 24 * 60 * 60 * 1000,
            );
            const allEvents: CrossAppResult[] = [];

            for (const cal of calendars.slice(0, 3)) {
              try {
                const eventsRes = await calendarApi.listEvents(
                  cal.id,
                  now,
                  futureEnd,
                );
                const events = eventsRes.data || [];
                events
                  .filter((ev) => ev.title?.toLowerCase().includes(q))
                  .slice(0, 3)
                  .forEach((ev) => {
                    allEvents.push({
                      id: `cal-${ev.id}`,
                      category: "event",
                      title: ev.title,
                      subtitle: `Événements${ev.start_time ? " - " + new Date(ev.start_time).toLocaleDateString("fr-FR") : ""}`,
                      href: `/cal?event=${ev.id}`,
                      icon: Calendar,
                      date: ev.start_time,
                    });
                  });
              } catch {
                /* skip calendar */
              }
            }
            return allEvents.slice(0, 5);
          } catch {
            return [] as CrossAppResult[];
          }
        }),

        // ── 4. Drive files (nodes) ────────────────────────────────────
        import("@/lib/api/drive").then(async ({ driveApi }) => {
          try {
            const nodes = await driveApi.listNodes();
            const items = (Array.isArray(nodes) ? nodes : [])
              .filter((n) => n.name?.toLowerCase().includes(q))
              .slice(0, 5);
            return items.map(
              (n): CrossAppResult => ({
                id: `drive-${n.id}`,
                category: "file",
                title: n.name,
                subtitle: `Fichiers - ${n.node_type}${n.size ? " - " + formatSize(n.size) : ""}`,
                href:
                  n.node_type === "folder"
                    ? `/drive?folder=${n.id}`
                    : `/drive?file=${n.id}`,
                icon: HardDrive,
                date: n.updated_at,
              }),
            );
          } catch {
            // Fallback to storage search API
            try {
              const { searchApi: storageSearchApi } =
                await import("@/lib/api/storage");
              const res = await storageSearchApi.quickSearch(query, 5);
              const files = res.data?.results || [];
              return files.map(
                (f): CrossAppResult => ({
                  id: `file-${f.bucket}-${f.key}`,
                  category: "file",
                  title: f.filename,
                  subtitle: `Fichiers - ${f.bucket}/${f.key}`,
                  href: `/drive?bucket=${f.bucket}&file=${encodeURIComponent(f.key)}`,
                  icon: HardDrive,
                }),
              );
            } catch {
              return [] as CrossAppResult[];
            }
          }
        }),

        // ── 5. Documents (text, sheets, slides) ──────────────────────
        import("@/lib/api/docs").then(async ({ docsApi }) => {
          try {
            // The docs service doesn't have a search endpoint,
            // so we list templates and designs, and also fetch via
            // the drive nodes of type document/spreadsheet/presentation
            const items: CrossAppResult[] = [];

            // Try listing designs which have names
            try {
              const designsRes = await docsApi.listDesigns();
              const raw = designsRes.data;
              const designs = Array.isArray(raw)
                ? raw
                : ((raw as { data?: unknown[] })?.data ?? []);
              (Array.isArray(designs) ? designs : [])
                .filter((d: { name?: string }) =>
                  d.name?.toLowerCase().includes(q),
                )
                .slice(0, 3)
                .forEach(
                  (d: { id: string; name?: string; created_at?: string }) => {
                    items.push({
                      id: `doc-design-${d.id}`,
                      category: "document",
                      title: d.name || "Design",
                      subtitle: "Documents - Design",
                      href: `/docs/${d.id}`,
                      icon: FileText,
                      date: d.created_at,
                    });
                  },
                );
            } catch {
              /* skip designs */
            }

            // Try listing templates
            try {
              const templatesRes = await docsApi.listTemplates();
              const templates = templatesRes.data || [];
              (Array.isArray(templates) ? templates : [])
                .filter((t: { name?: string }) =>
                  t.name?.toLowerCase().includes(q),
                )
                .slice(0, 2)
                .forEach(
                  (t: { id: string; name?: string; created_at?: string }) => {
                    items.push({
                      id: `doc-tpl-${t.id}`,
                      category: "document",
                      title: t.name || "Template",
                      subtitle: "Documents - Modèle",
                      href: `/docs?template=${t.id}`,
                      icon: FileText,
                      date: t.created_at,
                    });
                  },
                );
            } catch {
              /* skip templates */
            }

            return items.slice(0, 5);
          } catch {
            return [] as CrossAppResult[];
          }
        }),

        // ── 6. Mail ───────────────────────────────────────────────────
        import("@/lib/api/mail").then(async ({ mailApi }) => {
          try {
            const res = await mailApi.searchEmails({ q: query, limit: 5 });
            const emails = res.data || [];
            return (Array.isArray(emails) ? emails : []).map(
              (e: {
                id: string;
                subject?: string;
                sender_name?: string;
                sender?: string;
                snippet?: string;
                received_at?: string;
                created_at?: string;
              }): CrossAppResult => ({
                id: `mail-${e.id}`,
                category: "email",
                title: e.subject || "(Sans objet)",
                subtitle: `Emails - ${e.sender_name || e.sender || ""}${e.snippet ? " - " + e.snippet.slice(0, 50) : ""}`,
                href: `/mail?id=${e.id}`,
                icon: Mail,
                date: e.received_at || e.created_at,
              }),
            );
          } catch {
            return [] as CrossAppResult[];
          }
        }),

        // ── 7. Tasks (calendar tasks) ─────────────────────────────────
        import("@/lib/api/calendar").then(async ({ calendarApi, tasksApi }) => {
          try {
            const calendarsRes = await calendarApi.listCalendars();
            const calendars = calendarsRes.data || [];
            if (calendars.length === 0) return [] as CrossAppResult[];
            const calId = calendars[0].id;
            const tasksRes = await tasksApi.listTasks(calId);
            const raw = tasksRes.data;
            const tasks = Array.isArray(raw)
              ? raw
              : ((raw as { data?: unknown[] })?.data ?? []);
            return (Array.isArray(tasks) ? tasks : [])
              .filter(
                (t: { title?: string; description?: string }) =>
                  t.title?.toLowerCase().includes(q) ||
                  t.description?.toLowerCase().includes(q),
              )
              .slice(0, 5)
              .map(
                (t: {
                  id: string;
                  title?: string;
                  due_date?: string;
                  created_at?: string;
                }): CrossAppResult => ({
                  id: `task-${t.id}`,
                  category: "task",
                  title: t.title || "Tâche",
                  subtitle: `Tâches${t.due_date ? " - Échéance: " + new Date(t.due_date).toLocaleDateString("fr-FR") : ""}`,
                  href: `/tasks?id=${t.id}`,
                  icon: CheckSquare,
                  date: t.due_date || t.created_at,
                }),
              );
          } catch {
            return [] as CrossAppResult[];
          }
        }),

        // ── 8. Chat messages ──────────────────────────────────────────
        import("@/lib/api/chat").then(async ({ chatApi }) => {
          try {
            const channelsRes = await chatApi.getChannels();
            const channels = channelsRes.data || [];
            const allMessages: CrossAppResult[] = [];

            // Search across first few channels
            for (const ch of (Array.isArray(channels) ? channels : []).slice(
              0,
              5,
            )) {
              try {
                const msgs = await chatApi.searchMessages(ch.id, query);
                const messages = msgs.data || [];
                (Array.isArray(messages) ? messages : [])
                  .slice(0, 3)
                  .forEach(
                    (m: {
                      id: string;
                      content?: string;
                      created_at?: string;
                    }) => {
                      allMessages.push({
                        id: `chat-${m.id}`,
                        category: "chat",
                        title: (m.content || "").slice(0, 80) || "Message",
                        subtitle: `Messages - #${ch.name || "canal"}`,
                        href: `/chat?channel=${ch.id}&message=${m.id}`,
                        icon: MessageCircle,
                        date: m.created_at,
                      });
                    },
                  );
              } catch {
                /* skip channel */
              }
            }
            return allMessages.slice(0, 5);
          } catch {
            return [] as CrossAppResult[];
          }
        }),

        // ── 9. Keep notes ─────────────────────────────────────────────
        import("@/lib/api/keep").then(async ({ keepApi }) => {
          try {
            const data = await keepApi.fetchAll();
            const notes = data.notes || [];
            return notes
              .filter(
                (n) =>
                  !n.isTrashed &&
                  (n.title?.toLowerCase().includes(q) ||
                    n.content?.toLowerCase().includes(q)),
              )
              .slice(0, 5)
              .map(
                (n): CrossAppResult => ({
                  id: `note-${n.id}`,
                  category: "note",
                  title: n.title || "Note sans titre",
                  subtitle: `Notes${n.content ? " - " + n.content.slice(0, 50) : ""}`,
                  href: `/keep?note=${n.id}`,
                  icon: StickyNote,
                  date: n.updatedAt || n.createdAt,
                }),
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
      setIsSearching(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return { results, isSearching };
}

/** Format byte size for display */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// ── Group results by category ──────────────────────────────────────────────

function groupByCategory(
  results: CrossAppResult[],
): Record<string, CrossAppResult[]> {
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

  const { results: crossAppResults, isSearching } = useCrossAppSearch(
    isOpen ? query : "",
  );
  const grouped = React.useMemo(
    () => groupByCategory(crossAppResults),
    [crossAppResults],
  );

  const executeAIAction = async () => {
    close();
    setIsExecuting(true);
    const loadingToast = toast.loading(`Exécution de : "${query}"...`);
    try {
      const res = await fetch("/api/v1/ai/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: query,
          context_id: pageContext.activeContext,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Succès (${Math.round(data.confidence * 100)}% confiant)`,
          {
            description: data.result_message,
            id: loadingToast,
          },
        );
      } else {
        toast.error("Échec de l'action", {
          description: data.result_message,
          id: loadingToast,
        });
      }
    } catch (e) {
      toast.error("Erreur", {
        description: "Impossible de contacter l'orchestrateur IA",
        id: loadingToast,
      });
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
                <p className="text-sm text-muted-foreground">
                  Searching across apps...
                </p>
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
              <CommandItem
                onSelect={() => {
                  close();
                  router.push(`/chat?q=${encodeURIComponent(query)}`);
                }}
              >
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
                  <span className="text-muted-foreground">
                    Searching across all apps...
                  </span>
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
                          <span className="font-medium text-sm truncate">
                            {item.title}
                          </span>
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
