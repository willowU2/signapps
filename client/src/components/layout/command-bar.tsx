"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Search,
  FileText,
  Mail,
  User,
  Mic,
  Monitor,
  Calendar,
  LayoutDashboard,
  Building2,
  FolderOpen,
  Plus,
  CheckSquare,
  File,
  MessageSquare,
  HardDrive,
  Settings,
  Shield,
  Users,
  Clock,
  UserPlus,
  Video,
  Star,
  History,
  Pencil,
  BookOpen,
  Upload,
  StickyNote,
  Contact,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { useEntityStore } from "@/stores/entity-hub-store";
import { useUIStore } from "@/lib/store";
import { useCommandBarStore } from "@/stores/command-bar-store";
import { logActivity } from "@/hooks/use-activity-tracker";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// ---------------------------------------------------------------------------
// Federated search result type
// ---------------------------------------------------------------------------
interface FederatedResult {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  href: string;
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

/** Format byte size for display */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// ---------------------------------------------------------------------------
// Federated search hook — queries all modules in parallel
// ---------------------------------------------------------------------------
function useFederatedSearch(query: string) {
  const [results, setResults] = React.useState<FederatedResult[]>([]);
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

      const searchFns: Promise<FederatedResult[]>[] = [
        // 1. Identity users
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
                (u): FederatedResult => ({
                  id: `user-${u.id}`,
                  category: "user",
                  title: u.display_name || u.username || "",
                  subtitle: [u.email, u.department].filter(Boolean).join(" - "),
                  href: `/workforce?user=${u.id}`,
                  date: u.last_login,
                }),
              );
          } catch {
            return [];
          }
        }),

        // 2. Contacts
        import("@/lib/api/contacts").then(async ({ contactsApi }) => {
          try {
            const res = await contactsApi.list();
            const contacts = res.data || [];
            return contacts
              .filter(
                (c: {
                  first_name?: string;
                  last_name?: string;
                  email?: string;
                  company?: string;
                  organization?: string;
                }) =>
                  c.first_name?.toLowerCase().includes(q) ||
                  c.last_name?.toLowerCase().includes(q) ||
                  c.email?.toLowerCase().includes(q) ||
                  c.company?.toLowerCase().includes(q) ||
                  c.organization?.toLowerCase().includes(q),
              )
              .slice(0, 5)
              .map(
                (c: {
                  id: string;
                  first_name?: string;
                  last_name?: string;
                  email?: string;
                  organization?: string;
                  company?: string;
                }): FederatedResult => ({
                  id: `contact-${c.id}`,
                  category: "contact",
                  title: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
                  subtitle: [c.email, c.organization || c.company]
                    .filter(Boolean)
                    .join(" - "),
                  href: `/contacts?id=${c.id}`,
                }),
              );
          } catch {
            return [];
          }
        }),

        // 3. Calendar events
        import("@/lib/api/calendar").then(async ({ calendarApi }) => {
          try {
            const calendarsRes = await calendarApi.listCalendars();
            const calendars = calendarsRes.data || [];
            const now = new Date();
            const futureEnd = new Date(
              now.getTime() + 365 * 24 * 60 * 60 * 1000,
            );
            const allEvents: FederatedResult[] = [];
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
                      date: ev.start_time,
                    });
                  });
              } catch {
                /* skip calendar */
              }
            }
            return allEvents.slice(0, 5);
          } catch {
            return [];
          }
        }),

        // 4. Drive files
        import("@/lib/api/drive").then(async ({ driveApi }) => {
          try {
            const nodes = await driveApi.listNodes();
            return (Array.isArray(nodes) ? nodes : [])
              .filter((n) => n.name?.toLowerCase().includes(q))
              .slice(0, 5)
              .map(
                (n): FederatedResult => ({
                  id: `drive-${n.id}`,
                  category: "file",
                  title: n.name,
                  subtitle: `Fichiers - ${n.node_type}${n.size ? " - " + formatSize(n.size) : ""}`,
                  href:
                    n.node_type === "folder"
                      ? `/drive?folder=${n.id}`
                      : `/drive?file=${n.id}`,
                  date: n.updated_at,
                }),
              );
          } catch {
            try {
              const { searchApi: storageSearchApi } =
                await import("@/lib/api/storage");
              const res = await storageSearchApi.quickSearch(query, 5);
              const files = res.data?.results || [];
              return files.map(
                (f): FederatedResult => ({
                  id: `file-${f.bucket}-${f.key}`,
                  category: "file",
                  title: f.filename,
                  subtitle: `Fichiers - ${f.bucket}/${f.key}`,
                  href: `/drive?bucket=${f.bucket}&file=${encodeURIComponent(f.key)}`,
                }),
              );
            } catch {
              return [];
            }
          }
        }),

        // 5. Documents
        import("@/lib/api/docs").then(async ({ docsApi }) => {
          try {
            const items: FederatedResult[] = [];
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
                      date: d.created_at,
                    });
                  },
                );
            } catch {
              /* skip designs */
            }
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
                      date: t.created_at,
                    });
                  },
                );
            } catch {
              /* skip templates */
            }
            return items.slice(0, 5);
          } catch {
            return [];
          }
        }),

        // 6. Mail
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
              }): FederatedResult => ({
                id: `mail-${e.id}`,
                category: "email",
                title: e.subject || "(Sans objet)",
                subtitle: `Emails - ${e.sender_name || e.sender || ""}${e.snippet ? " - " + e.snippet.slice(0, 50) : ""}`,
                href: `/mail?id=${e.id}`,
                date: e.received_at || e.created_at,
              }),
            );
          } catch {
            return [];
          }
        }),

        // 7. Tasks
        import("@/lib/api/calendar").then(async ({ calendarApi, tasksApi }) => {
          try {
            const calendarsRes = await calendarApi.listCalendars();
            const calendars = calendarsRes.data || [];
            if (calendars.length === 0) return [];
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
                }): FederatedResult => ({
                  id: `task-${t.id}`,
                  category: "task",
                  title: t.title || "Tâche",
                  subtitle: `Tâches${t.due_date ? " - Échéance: " + new Date(t.due_date).toLocaleDateString("fr-FR") : ""}`,
                  href: `/tasks?id=${t.id}`,
                  date: t.due_date || t.created_at,
                }),
              );
          } catch {
            return [];
          }
        }),

        // 8. Chat messages
        import("@/lib/api/chat").then(async ({ chatApi }) => {
          try {
            const channelsRes = await chatApi.getChannels();
            const channels = channelsRes.data || [];
            const allMessages: FederatedResult[] = [];
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
            return [];
          }
        }),

        // 9. Keep notes
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
                (n): FederatedResult => ({
                  id: `note-${n.id}`,
                  category: "note",
                  title: n.title || "Note sans titre",
                  subtitle: `Notes${n.content ? " - " + n.content.slice(0, 50) : ""}`,
                  href: `/keep?note=${n.id}`,
                  date: n.updatedAt || n.createdAt,
                }),
              );
          } catch {
            return [];
          }
        }),
      ];

      const settled = await Promise.allSettled(searchFns);
      const allResults: FederatedResult[] = [];
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

/** Group federated results by category */
function groupByCategory(
  results: FederatedResult[],
): Record<string, FederatedResult[]> {
  const groups: Record<string, FederatedResult[]> = {};
  results.forEach((r) => {
    if (!groups[r.category]) groups[r.category] = [];
    groups[r.category].push(r);
  });
  return groups;
}

// ---------------------------------------------------------------------------
// Navigation items: all primary app pages
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    shortcut: "⌘D",
  },
  { label: "Docs", icon: FileText, href: "/docs" },
  { label: "Sheets", icon: FileText, href: "/sheets" },
  { label: "Slides", icon: FileText, href: "/slides" },
  { label: "Calendar", icon: Calendar, href: "/calendar" },
  { label: "Mail", icon: Mail, href: "/mail" },
  { label: "Chat", icon: MessageSquare, href: "/chat" },
  { label: "Drive", icon: HardDrive, href: "/drive" },
  { label: "Tasks", icon: CheckSquare, href: "/tasks" },
  { label: "Projects", icon: FolderOpen, href: "/projects" },
  { label: "Meet", icon: Video, href: "/meet" },
  { label: "Contacts", icon: User, href: "/contacts" },
  { label: "App Store", icon: Monitor, href: "/apps" },
  { label: "Containers", icon: Monitor, href: "/containers" },
  { label: "AI Assistant", icon: MessageSquare, href: "/ai" },
  { label: "Settings", icon: Settings, href: "/settings", shortcut: "⌘," },
  { label: "Admin", icon: Shield, href: "/admin" },
  { label: "Users", icon: Users, href: "/users" },
] as const;

// ---------------------------------------------------------------------------
// Action items: quick-create shortcuts
// ---------------------------------------------------------------------------
const ACTION_ITEMS = [
  { label: "Nouveau document", icon: FileText, href: "/docs?new=true" },
  { label: "Nouvel email", icon: Mail, href: "/mail?compose=true" },
  { label: "Nouveau contact", icon: UserPlus, href: "/contacts?new=true" },
  { label: "Nouvelle tâche", icon: CheckSquare, action: "createTask" },
  { label: "Nouvelle réunion", icon: Video, href: "/meet?new=true" },
  { label: "Nouveau tableur", icon: FileText, href: "/sheets?new=true" },
  { label: "Nouvelle note", icon: Pencil, href: "/keep?new=true" },
  { label: "Upload fichier", icon: Upload, href: "/drive?upload=true" },
] as const;

// ---------------------------------------------------------------------------
// CommandBar
// ---------------------------------------------------------------------------
export function CommandBar() {
  const router = useRouter();
  const { isOpen: open, setOpen, toggle, recentItems } = useCommandBarStore();
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { results: federatedResults, isSearching: isLoading } =
    useFederatedSearch(open ? debouncedQuery : "");
  const grouped = React.useMemo(
    () => groupByCategory(federatedResults),
    [federatedResults],
  );

  // Register Cmd+K / Ctrl+K global shortcut
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [toggle]);

  // Reset query when closed
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const runCommand = React.useCallback(
    (command: () => void) => {
      setOpen(false);
      command();
    },
    [setOpen],
  );

  const { workspaces, projects, setSelectedWorkspace } = useEntityStore();
  const {
    setCreateWorkspaceModalOpen,
    setCreateProjectModalOpen,
    setCreateTaskModalOpen,
  } = useUIStore();

  if (!open) return null;

  const itemCls =
    "flex items-center px-3 py-2.5 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors text-sm text-foreground data-[selected=true]:bg-accent/50 data-[selected=true]:text-accent-foreground";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-background/40 backdrop-blur-sm transition-all"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-card/60 backdrop-blur-2xl rounded-2xl shadow-premium border border-border/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Global Command Menu" className="w-full">
          {/* Search input */}
          <div
            className="flex items-center border-b border-border/50 px-3"
            cmdk-input-wrapper=""
          >
            <Search className="mr-2 h-5 w-5 shrink-0 opacity-50" />
            <Command.Input
              autoFocus
              placeholder="Type a command or search everywhere..."
              className="flex h-14 w-full rounded-md bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
              value={query}
              onValueChange={setQuery}
            />
            {/* Keyboard hint */}
            <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0 ml-2">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[420px] overflow-y-auto overflow-x-hidden p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              Aucun résultat trouvé.
            </Command.Empty>

            {/* Live federated search results — grouped by module */}
            {isLoading &&
              debouncedQuery.length > 0 &&
              federatedResults.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recherche fédérée en cours...
                </div>
              )}

            {Object.entries(grouped).map(([category, items]) => {
              const CategoryIcon = CATEGORY_ICONS[category] || FileText;
              return (
                <Command.Group
                  key={category}
                  heading={CATEGORY_LABELS[category] || category}
                  className="text-xs font-semibold text-muted-foreground px-2 py-2"
                >
                  {items.map((r) => (
                    <Command.Item
                      key={r.id}
                      value={`${r.title} ${r.subtitle} ${category}`}
                      onSelect={() => {
                        logActivity(
                          "search",
                          query,
                          `Navigated to ${category}: ${r.title}`,
                        );
                        runCommand(() => router.push(r.href));
                      }}
                      className={itemCls}
                    >
                      <CategoryIcon className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col items-start overflow-hidden">
                        <span className="truncate w-full">{r.title}</span>
                        <span className="text-xs text-muted-foreground truncate w-full">
                          {r.subtitle}
                        </span>
                      </div>
                      {r.date && (
                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                          {new Date(r.date).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            })}

            {/* Deep search shortcut – always visible when user has typed a query */}
            {debouncedQuery.length > 0 && (
              <Command.Group
                heading="Recherche avancée"
                className="text-xs font-semibold text-muted-foreground px-2 py-2"
              >
                <Command.Item
                  value={`search documents ai ${debouncedQuery}`}
                  onSelect={() =>
                    runCommand(() => {
                      logActivity("search", debouncedQuery, "AI deep search");
                      router.push(
                        `/ai/search?q=${encodeURIComponent(debouncedQuery)}`,
                      );
                    })
                  }
                  className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary text-foreground hover:bg-primary/10 hover:text-primary"
                >
                  <BookOpen className="mr-3 h-4 w-4 shrink-0" />
                  <span>
                    Rechercher &laquo;{debouncedQuery}&raquo; dans les documents
                    (IA)...
                  </span>
                </Command.Item>
              </Command.Group>
            )}

            {/* Navigation */}
            <Command.Group
              heading="Navigation"
              className="text-xs font-semibold text-muted-foreground px-2 py-2"
            >
              {NAV_ITEMS.map((item) => (
                <Command.Item
                  key={item.href}
                  value={item.label}
                  onSelect={() => {
                    logActivity("navigated", item.label, item.href);
                    runCommand(() => router.push(item.href));
                  }}
                  className={itemCls}
                >
                  <item.icon className="mr-3 h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                  {"shortcut" in item && item.shortcut && (
                    <kbd className="ml-auto text-[10px] text-muted-foreground tracking-widest">
                      {item.shortcut}
                    </kbd>
                  )}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Separator className="h-px bg-border/50 my-2 mx-4" />

            {/* Actions */}
            <Command.Group
              heading="Actions"
              className="text-xs font-semibold text-muted-foreground px-2 py-2"
            >
              {ACTION_ITEMS.map((item) => (
                <Command.Item
                  key={item.label}
                  value={item.label}
                  onSelect={() => {
                    logActivity("created", item.label, "Via command bar");
                    if ("action" in item && item.action === "createTask") {
                      runCommand(() => setCreateTaskModalOpen(true));
                    } else if ("href" in item) {
                      runCommand(() => router.push(item.href));
                    }
                  }}
                  className={itemCls}
                >
                  <item.icon className="mr-3 h-4 w-4 shrink-0 text-primary" />
                  <span>{item.label}</span>
                  <Plus className="ml-auto h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Separator className="h-px bg-border/50 my-2 mx-4" />

            {/* Recent files from store */}
            {recentItems.length > 0 && (
              <Command.Group
                heading="Recent Files"
                className="text-xs font-semibold text-muted-foreground px-2 py-2"
              >
                {recentItems.slice(0, 5).map((item, idx) => {
                  const block = item.block;
                  const title = block.title || block.id;
                  return (
                    <Command.Item
                      key={`recent-${block.id || idx}`}
                      value={`recent ${title}`}
                      onSelect={() =>
                        runCommand(() =>
                          router.push(`/storage?preview=${block.id}`),
                        )
                      }
                      className={itemCls}
                    >
                      <History className="mr-3 h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{title}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {/* Workspaces */}
            {workspaces.length > 0 && (
              <Command.Group
                heading="Workspaces"
                className="text-xs font-semibold text-muted-foreground px-2 py-2 mt-2"
              >
                {workspaces.map((w) => (
                  <Command.Item
                    key={`workspace-${w.id}`}
                    value={`workspace ${w.name}`}
                    onSelect={() =>
                      runCommand(() => {
                        setSelectedWorkspace(w.id);
                        router.push("/dashboard");
                      })
                    }
                    className={itemCls}
                  >
                    <Building2 className="mr-3 h-4 w-4 shrink-0" />
                    <span>Switch to {w.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Projects */}
            {projects.length > 0 && (
              <Command.Group
                heading="Projects"
                className="text-xs font-semibold text-muted-foreground px-2 py-2 mt-2"
              >
                {projects.map((p) => (
                  <Command.Item
                    key={`proj-${p.id}`}
                    value={`project ${p.name}`}
                    onSelect={() =>
                      runCommand(() => router.push(`/projects/${p.id}`))
                    }
                    className={itemCls}
                  >
                    <FolderOpen className="mr-3 h-4 w-4 shrink-0" />
                    <span>Go to {p.name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Separator className="h-px bg-border/50 my-2 mx-4" />

            {/* Quick actions (workspace/project creation) */}
            <Command.Group
              heading="Quick Actions"
              className="text-xs font-semibold text-muted-foreground px-2 py-2 mt-2"
            >
              <Command.Item
                value="create workspace"
                onSelect={() =>
                  runCommand(() => setCreateWorkspaceModalOpen(true))
                }
                className={itemCls}
              >
                <Plus className="mr-3 h-4 w-4 shrink-0" />
                <span>Create Workspace...</span>
              </Command.Item>
              <Command.Item
                value="create project"
                onSelect={() =>
                  runCommand(() => setCreateProjectModalOpen(true))
                }
                className={itemCls}
              >
                <FolderOpen className="mr-3 h-4 w-4 shrink-0" />
                <span>Create Project...</span>
              </Command.Item>
              <Command.Item
                value="create task"
                onSelect={() => runCommand(() => setCreateTaskModalOpen(true))}
                className={itemCls}
              >
                <CheckSquare className="mr-3 h-4 w-4 shrink-0" />
                <span>Create Task...</span>
              </Command.Item>
            </Command.Group>

            <Command.Separator className="h-px bg-border/50 my-2 mx-4" />

            {/* AI / System */}
            <Command.Group
              heading="AI & System"
              className="text-xs font-semibold text-muted-foreground px-2 py-2"
            >
              <Command.Item
                value="ai assistant ask"
                onSelect={() => runCommand(() => router.push("/chat"))}
                className="flex items-center px-3 py-2.5 rounded-lg cursor-pointer transition-colors text-sm data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary text-foreground hover:bg-primary/10 hover:text-primary"
              >
                <Mic className="mr-3 h-4 w-4 shrink-0" />
                <span>Ask AI Assistant...</span>
              </Command.Item>
              <Command.Item
                value="system settings"
                onSelect={() => runCommand(() => router.push("/settings"))}
                className={itemCls}
              >
                <Monitor className="mr-3 h-4 w-4 shrink-0" />
                <span>System Settings</span>
              </Command.Item>
            </Command.Group>
          </Command.List>

          {/* Footer hint */}
          <div className="border-t border-border/50 px-3 py-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>
              <kbd className="font-sans">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="font-sans">↵</kbd> select
            </span>
            <span>
              <kbd className="font-sans">Esc</kbd> close
            </span>
            <span className="ml-auto opacity-60">Cmd+K to reopen</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
