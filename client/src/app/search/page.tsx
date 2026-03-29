"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  Search,
  FileText,
  Mail,
  Users,
  CalendarDays,
  CheckSquare,
  HardDrive,
  ArrowRight,
  X,
  Clock,
  Loader2,
} from "lucide-react";
import { getClient, ServiceName } from "@/lib/api/factory";
import { storageApi } from "@/lib/api/storage";
import { schedulerApi } from "@/lib/api";
import { calendarApi } from "@/lib/api/calendar";
import { fetchOmniSearch } from "@/lib/api/search";

// ─── Types ───────────────────────────────────────────────────────────────────

type ModuleType =
  | "all"
  | "documents"
  | "emails"
  | "contacts"
  | "events"
  | "tasks"
  | "files";

interface SearchResult {
  id: string;
  module: ModuleType;
  title: string;
  subtitle?: string;
  snippet?: string;
  icon: ModuleType;
  url: string;
  date?: string;
  meta?: Record<string, string>;
}

interface ModuleConfig {
  key: ModuleType;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const MODULE_CONFIG: ModuleConfig[] = [
  {
    key: "documents",
    label: "Documents",
    icon: <FileText className="h-4 w-4" />,
    color: "text-blue-500",
  },
  {
    key: "emails",
    label: "Emails",
    icon: <Mail className="h-4 w-4" />,
    color: "text-red-500",
  },
  {
    key: "contacts",
    label: "Contacts",
    icon: <Users className="h-4 w-4" />,
    color: "text-green-500",
  },
  {
    key: "events",
    label: "Calendrier",
    icon: <CalendarDays className="h-4 w-4" />,
    color: "text-purple-500",
  },
  {
    key: "tasks",
    label: "Taches",
    icon: <CheckSquare className="h-4 w-4" />,
    color: "text-amber-500",
  },
  {
    key: "files",
    label: "Fichiers",
    icon: <HardDrive className="h-4 w-4" />,
    color: "text-cyan-500",
  },
];

// ─── Data fetching helpers ───────────────────────────────────────────────────

async function searchContacts(query: string): Promise<SearchResult[]> {
  try {
    const client = getClient(ServiceName.CONTACTS);
    const res = await client.get<
      Array<{
        id: string;
        name: string;
        email: string;
        company?: string;
        phone?: string;
      }>
    >("/contacts");
    const contacts = res.data ?? [];
    const q = query.toLowerCase();
    return contacts
      .filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q)
      )
      .map((c) => ({
        id: c.id,
        module: "contacts" as ModuleType,
        title: c.name,
        subtitle: c.email,
        snippet: c.company ? `Entreprise: ${c.company}` : undefined,
        icon: "contacts" as ModuleType,
        url: `/contacts`,
        meta: c.phone ? { phone: c.phone } : undefined,
      }));
  } catch {
    return [];
  }
}

async function searchEmails(query: string): Promise<SearchResult[]> {
  try {
    const client = getClient(ServiceName.MAIL);
    const res = await client.get<{
      messages: Array<{
        id: string;
        message_id?: string;
        subject: string;
        from_address: string;
        date?: string;
        snippet?: string;
      }>;
    }>("/messages", { params: { search: query, limit: 20 } });
    const messages = res.data?.messages ?? [];
    return messages.map((m) => ({
      id: m.id || m.message_id || "",
      module: "emails" as ModuleType,
      title: m.subject || "(sans sujet)",
      subtitle: m.from_address,
      snippet: m.snippet,
      icon: "emails" as ModuleType,
      url: `/mail`,
      date: m.date,
    }));
  } catch {
    return [];
  }
}

async function searchEvents(query: string): Promise<SearchResult[]> {
  try {
    const calendarsRes = await calendarApi.listCalendars();
    const calendars = calendarsRes.data || [];
    if (calendars.length === 0) return [];

    const now = new Date();
    const start = new Date(now.getFullYear() - 1, 0, 1);
    const end = new Date(now.getFullYear() + 1, 11, 31);
    const eventsRes = await calendarApi.listEvents(calendars[0].id, start, end);
    const events = (eventsRes.data || []) as Array<{
      id: string;
      title: string;
      description?: string;
      start_time: string;
      location?: string;
    }>;
    const q = query.toLowerCase();
    return events
      .filter(
        (e) =>
          e.title?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q)
      )
      .map((e) => ({
        id: e.id,
        module: "events" as ModuleType,
        title: e.title,
        subtitle: e.location,
        snippet: e.description?.substring(0, 120),
        icon: "events" as ModuleType,
        url: `/calendar`,
        date: e.start_time,
      }));
  } catch {
    return [];
  }
}

async function searchTasks(query: string): Promise<SearchResult[]> {
  try {
    const res = await schedulerApi.listJobs();
    const jobs = (res.data || []) as Array<{
      id: string;
      name: string;
      description?: string;
      cron_expression: string;
      enabled: boolean;
      last_status?: string;
    }>;
    const q = query.toLowerCase();
    return jobs
      .filter(
        (j) =>
          j.name?.toLowerCase().includes(q) ||
          j.description?.toLowerCase().includes(q)
      )
      .map((j) => ({
        id: j.id,
        module: "tasks" as ModuleType,
        title: j.name,
        subtitle: j.cron_expression,
        snippet: j.description,
        icon: "tasks" as ModuleType,
        url: `/scheduler`,
        meta: {
          status: j.enabled ? "actif" : "inactif",
          last: j.last_status || "-",
        },
      }));
  } catch {
    return [];
  }
}

async function searchFiles(query: string): Promise<SearchResult[]> {
  try {
    const res = await storageApi.listFiles("default", "");
    const files = (res.data?.objects || []) as Array<{
      id?: string;
      key: string;
      name?: string;
      size?: number;
      mime_type?: string;
      is_directory?: boolean;
    }>;
    const q = query.toLowerCase();
    return files
      .filter((f) => {
        const name = f.name || f.key?.split("/").pop() || "";
        return name.toLowerCase().includes(q);
      })
      .map((f) => {
        const name = f.name || f.key?.split("/").pop() || "";
        const sizeStr = f.size
          ? f.size > 1048576
            ? `${(f.size / 1048576).toFixed(1)} Mo`
            : `${(f.size / 1024).toFixed(1)} Ko`
          : "";
        return {
          id: f.id || f.key,
          module: "files" as ModuleType,
          title: name,
          subtitle: f.mime_type || "",
          snippet: sizeStr ? `Taille: ${sizeStr}` : undefined,
          icon: "files" as ModuleType,
          url: `/drive`,
        };
      });
  } catch {
    return [];
  }
}

async function searchDocuments(query: string): Promise<SearchResult[]> {
  // Try the omni search API for documents
  try {
    const omniResults = await fetchOmniSearch(query, 20);
    return omniResults.results
      .filter(
        (r) =>
          r.entity_type === "document" ||
          r.entity_type === "doc" ||
          r.entity_type === "file"
      )
      .map((r) => ({
        id: r.id,
        module: "documents" as ModuleType,
        title: r.title,
        snippet: r.snippet,
        icon: "documents" as ModuleType,
        url: r.url || `/docs`,
        date: r.updated_at,
      }));
  } catch {
    // Fallback: search docs API directly
    try {
      const client = getClient(ServiceName.DOCS);
      const res = await client.get<
        Array<{
          id: string;
          title: string;
          content?: string;
          updated_at?: string;
        }>
      >("/documents", { params: { search: query, limit: 20 } });
      const docs = Array.isArray(res.data) ? res.data : [];
      const q = query.toLowerCase();
      return docs
        .filter(
          (d) =>
            d.title?.toLowerCase().includes(q) ||
            d.content?.toLowerCase().includes(q)
        )
        .map((d) => ({
          id: d.id,
          module: "documents" as ModuleType,
          title: d.title || "Sans titre",
          snippet: d.content?.substring(0, 120),
          icon: "documents" as ModuleType,
          url: `/docs/${d.id}`,
          date: d.updated_at,
        }));
    } catch {
      return [];
    }
  }
}

// ─── Module icon component ───────────────────────────────────────────────────

function ModuleIcon({
  module,
  className,
}: {
  module: ModuleType;
  className?: string;
}) {
  const config = MODULE_CONFIG.find((m) => m.key === module);
  if (!config) return <Search className={className} />;
  return (
    <span className={config.color}>
      {config.icon}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  usePageTitle("Recherche avancee");
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<ModuleType>("all");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Update URL when query changes
  useEffect(() => {
    if (debouncedQuery) {
      const url = new URL(window.location.href);
      url.searchParams.set("q", debouncedQuery);
      window.history.replaceState({}, "", url.toString());
    }
  }, [debouncedQuery]);

  // Search all modules in parallel
  const {
    data: results = [],
    isLoading,
    isFetching,
  } = useQuery<SearchResult[]>({
    queryKey: ["global-search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.trim().length < 2) return [];

      const [docs, emails, contacts, events, tasks, files] =
        await Promise.allSettled([
          searchDocuments(debouncedQuery),
          searchEmails(debouncedQuery),
          searchContacts(debouncedQuery),
          searchEvents(debouncedQuery),
          searchTasks(debouncedQuery),
          searchFiles(debouncedQuery),
        ]);

      const all: SearchResult[] = [
        ...(docs.status === "fulfilled" ? docs.value : []),
        ...(emails.status === "fulfilled" ? emails.value : []),
        ...(contacts.status === "fulfilled" ? contacts.value : []),
        ...(events.status === "fulfilled" ? events.value : []),
        ...(tasks.status === "fulfilled" ? tasks.value : []),
        ...(files.status === "fulfilled" ? files.value : []),
      ];

      return all;
    },
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  // Group by module
  const grouped = useMemo(() => {
    const map: Record<ModuleType, SearchResult[]> = {
      all: [],
      documents: [],
      emails: [],
      contacts: [],
      events: [],
      tasks: [],
      files: [],
    };
    for (const r of results) {
      map[r.module]?.push(r);
    }
    return map;
  }, [results]);

  // Module counts
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const mod of MODULE_CONFIG) {
      c[mod.key] = grouped[mod.key]?.length || 0;
    }
    c["all"] = results.length;
    return c;
  }, [grouped, results]);

  // Filtered results for active tab
  const displayResults = useMemo(() => {
    if (activeTab === "all") return results;
    return grouped[activeTab] || [];
  }, [activeTab, results, grouped]);

  const handleNavigate = (result: SearchResult) => {
    router.push(result.url);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Search className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Recherche avancee
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Recherchez dans tous les modules de la plateforme.
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            className="pl-10 pr-10 h-12 text-lg"
            placeholder="Rechercher des documents, emails, contacts, evenements, taches, fichiers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1"
              onClick={() => {
                setQuery("");
                setDebouncedQuery("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {isFetching && (
            <Loader2 className="absolute right-12 top-3.5 h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Results */}
        {debouncedQuery.trim().length < 2 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">
                Tapez au moins 2 caracteres pour lancer la recherche
              </h3>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Utilisez Ctrl+K pour un acces rapide a la recherche depuis
                n&apos;importe quelle page.
              </p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ModuleType)}
          >
            <div className="overflow-x-auto pb-1">
              <TabsList className="inline-flex w-auto">
                <TabsTrigger value="all" className="text-xs sm:text-sm gap-1.5">
                  Tous
                  <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1">
                    {counts["all"]}
                  </Badge>
                </TabsTrigger>
                {MODULE_CONFIG.map((mod) => (
                  <TabsTrigger
                    key={mod.key}
                    value={mod.key}
                    className="text-xs sm:text-sm gap-1.5"
                  >
                    <span className={mod.color}>{mod.icon}</span>
                    <span className="hidden sm:inline">{mod.label}</span>
                    <Badge
                      variant="secondary"
                      className="ml-1 h-5 min-w-[20px] px-1"
                    >
                      {counts[mod.key]}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Tab content for all tabs */}
            <TabsContent value={activeTab} className="mt-4">
              {displayResults.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <h3 className="text-lg font-medium text-muted-foreground">
                      Aucun resultat
                    </h3>
                    <p className="text-sm text-muted-foreground/60 mt-1">
                      Aucun resultat pour &quot;{debouncedQuery}&quot;
                      {activeTab !== "all" && (
                        <>
                          {" "}
                          dans{" "}
                          {MODULE_CONFIG.find((m) => m.key === activeTab)
                            ?.label || activeTab}
                        </>
                      )}
                      . Essayez un autre terme.
                    </p>
                  </CardContent>
                </Card>
              ) : activeTab === "all" ? (
                // Grouped view for "all" tab
                <div className="space-y-6">
                  {MODULE_CONFIG.filter((mod) => (grouped[mod.key]?.length || 0) > 0).map(
                    (mod) => (
                      <div key={mod.key}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className={mod.color}>{mod.icon}</span>
                          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            {mod.label}
                          </h2>
                          <Badge variant="outline" className="ml-1">
                            {grouped[mod.key]?.length}
                          </Badge>
                          {(grouped[mod.key]?.length || 0) > 5 && (
                            <Button
                              variant="link"
                              size="sm"
                              className="ml-auto text-xs"
                              onClick={() => setActiveTab(mod.key)}
                            >
                              Voir tout
                              <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {grouped[mod.key]?.slice(0, 5).map((result) => (
                            <ResultCard
                              key={`${result.module}-${result.id}`}
                              result={result}
                              onClick={() => handleNavigate(result)}
                              formatDate={formatDate}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                // Flat list for specific module tab
                <div className="space-y-2">
                  {displayResults.map((result) => (
                    <ResultCard
                      key={`${result.module}-${result.id}`}
                      result={result}
                      onClick={() => handleNavigate(result)}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}

// ─── Result Card ─────────────────────────────────────────────────────────────

function ResultCard({
  result,
  onClick,
  formatDate,
}: {
  result: SearchResult;
  onClick: () => void;
  formatDate: (d?: string) => string | null;
}) {
  const dateStr = formatDate(result.date);

  return (
    <Card
      className="cursor-pointer border-border/50 transition-all hover:border-primary/30 hover:shadow-sm hover:bg-muted/30 active:scale-[0.995]"
      onClick={onClick}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <ModuleIcon module={result.module} className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{result.title}</p>
            {dateStr && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Clock className="h-3 w-3" />
                {dateStr}
              </span>
            )}
          </div>
          {result.subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {result.subtitle}
            </p>
          )}
          {result.snippet && (
            <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">
              {result.snippet}
            </p>
          )}
          {result.meta && (
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {Object.entries(result.meta).map(([key, value]) => (
                <Badge key={key} variant="secondary" className="text-xs">
                  {value}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
      </CardContent>
    </Card>
  );
}
