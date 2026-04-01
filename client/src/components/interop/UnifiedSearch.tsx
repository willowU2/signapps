"use client";

/**
 * Feature 15: Mail search → also search in task descriptions and event notes
 * Feature 16: Email → extract action items as tasks (AI)
 */

import { useState, useCallback, useRef } from "react";
import {
  Search,
  CheckSquare,
  CalendarDays,
  Mail,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchApi } from "@/lib/api-mail";
import { toast } from "sonner";
import { interopStore } from "@/lib/interop/store";

interface SearchResult {
  id: string;
  module: "mail" | "task" | "event";
  title: string;
  excerpt?: string;
  date?: string;
  href: string;
}

const MODULE_ICON: Record<string, React.ReactNode> = {
  mail: <Mail className="h-3.5 w-3.5 text-blue-500" />,
  task: <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />,
  event: <CalendarDays className="h-3.5 w-3.5 text-purple-500" />,
};

async function searchAll(q: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  await Promise.allSettled([
    // Mail
    searchApi.search({ q, limit: 5 }).then((emails) => {
      (Array.isArray(emails) ? emails : []).forEach((e) =>
        results.push({
          id: e.id,
          module: "mail",
          title: e.subject || "(Sans objet)",
          excerpt: e.snippet,
          date: e.received_at,
          href: "/mail",
        }),
      );
    }),
    // Tasks — best-effort
    (async () => {
      const API =
        process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1";
      const calsRes = await fetch(`${API}/calendars`, {
        credentials: "include",
      });
      if (!calsRes.ok) return;
      const cals = await calsRes.json();
      const calId = (cals.data ?? cals)?.[0]?.id;
      if (!calId) return;
      const res = await fetch(
        `${API}/calendars/${calId}/tasks?q=${encodeURIComponent(q)}&limit=5`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = await res.json();
      (data.data ?? data ?? []).forEach((t: Record<string, unknown>) =>
        results.push({
          id: t.id as string,
          module: "task",
          title: t.title as string,
          excerpt: t.description as string | undefined,
          date: t.due_date as string | undefined,
          href: "/tasks",
        }),
      );
    })(),
    // Events — best-effort
    (async () => {
      const API =
        process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1";
      const calsRes = await fetch(`${API}/calendars`, {
        credentials: "include",
      });
      if (!calsRes.ok) return;
      const cals = await calsRes.json();
      const calId = (cals.data ?? cals)?.[0]?.id;
      if (!calId) return;
      const res = await fetch(
        `${API}/calendars/${calId}/events?q=${encodeURIComponent(q)}&limit=5`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const data = await res.json();
      (data.data ?? data ?? []).forEach((e: Record<string, unknown>) =>
        results.push({
          id: e.id as string,
          module: "event",
          title: e.title as string,
          excerpt: e.notes as string | undefined,
          date: e.start_time as string | undefined,
          href: "/cal",
        }),
      );
    })(),
  ]);
  return results.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

interface Props {
  className?: string;
  placeholder?: string;
}

export function UnifiedSearchBar({
  className,
  placeholder = "Rechercher dans tous les modules…",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((q: string) => {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const r = await searchAll(q);
      setResults(r);
      setOpen(true);
      setLoading(false);
    }, 400);
  }, []);

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9 pr-4"
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full z-50 rounded-lg border border-border shadow-lg bg-background overflow-hidden max-h-80 overflow-y-auto">
          {results.map((r) => (
            <a
              key={`${r.module}-${r.id}`}
              href={r.href}
              className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors text-sm"
            >
              <span className="mt-0.5 shrink-0">{MODULE_ICON[r.module]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{r.title}</p>
                {r.excerpt && (
                  <p className="text-xs text-muted-foreground truncate">
                    {r.excerpt}
                  </p>
                )}
              </div>
              {r.date && (
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {new Date(r.date).toLocaleDateString("fr-FR")}
                </span>
              )}
            </a>
          ))}
        </div>
      )}
      {open && results.length === 0 && !loading && query.trim() && (
        <div className="absolute top-full mt-1 w-full z-50 rounded-lg border border-border shadow-lg bg-background px-3 py-4 text-center text-sm text-muted-foreground">
          Aucun résultat pour « {query} »
        </div>
      )}
    </div>
  );
}

/** Feature 16: Extract action items from email body */
export async function extractActionItems(
  emailBody: string,
  emailId: string,
  calendarId: string,
): Promise<number> {
  // Simple heuristic: lines starting with action verbs or "TODO:" / "Action:" / "•"
  const lines = emailBody
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 5);
  const actionPatterns = [
    /^(TODO|Action|À faire|Veuillez|Please|Merci de|Rappel)[:\s]/i,
    /^[-•*]\s+\w{3,}/,
  ];
  const actionItems = lines
    .filter((l) => actionPatterns.some((p) => p.test(l)))
    .slice(0, 5);

  if (actionItems.length === 0) return 0;

  const API =
    process.env.NEXT_PUBLIC_CALENDAR_API || "http://localhost:3011/api/v1";
  let created = 0;
  for (const item of actionItems) {
    try {
      const res = await fetch(`${API}/calendars/${calendarId}/tasks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.replace(/^[-•*]\s+/, ""),
          priority: 1,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        interopStore.addLink({
          sourceType: "mail",
          sourceId: emailId,
          sourceTitle: "Email",
          targetType: "task",
          targetId: d.id,
          targetTitle: item,
          relation: "extracted_action",
        });
        created++;
      }
    } catch {
      /* best-effort */
    }
  }
  return created;
}
