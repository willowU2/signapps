"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface HistoryEntry {
  path: string;
  title: string;
  visitedAt: string;
}

const HISTORY_KEY = "signapps-recent-history";
const MAX_ENTRIES = 10;

export function useRecentHistory() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname === "/") return;
    try {
      const history: HistoryEntry[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const filtered = history.filter(h => h.path !== pathname);
      filtered.unshift({ path: pathname, title: document.title || pathname, visitedAt: new Date().toISOString() });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, MAX_ENTRIES)));
    } catch {}
  }, [pathname]);
}

export function RecentHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { setEntries(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]")); } catch {}
  }, [open]);

  if (entries.length === 0) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-2 rounded hover:bg-accent transition-colors text-muted-foreground" title="Historique recent">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-popover border rounded-lg shadow-xl z-50 py-1">
          <p className="px-3 py-1 text-xs font-medium text-muted-foreground">Recemment consulte</p>
          {entries.slice(0, MAX_ENTRIES).map((e, i) => (
            <Link key={i} href={e.path} onClick={() => setOpen(false)} className="block px-3 py-1.5 text-sm hover:bg-accent transition-colors truncate">
              {e.title || e.path}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
