"use client";

import { useEffect, useState } from "react";
import { Zap, Bug, Wrench, BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

interface ChangelogEntry {
  id: string;
  type: "feat" | "fix" | "chore" | "docs";
  description: string;
  date: Date;
  version: string;
}

const STORAGE_KEY = "signapps_changelog";
const schedulerClient = getClient(ServiceName.SCHEDULER);

function loadEntriesFromStorage(): ChangelogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((e: ChangelogEntry) => ({ ...e, date: new Date(e.date) }));
  } catch {
    return [];
  }
}

function saveEntriesToStorage(entries: ChangelogEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function mapEntryFromApi(e: any): ChangelogEntry {
  return {
    id: e.id ?? crypto.randomUUID(),
    type: ["feat","fix","chore","docs"].includes(e.type) ? e.type : "feat",
    description: e.description ?? e.message ?? "",
    date: new Date(e.date ?? e.created_at ?? Date.now()),
    version: e.version ?? "1.0.0",
  };
}

export function ChangelogViewer() {
  const [entries, setEntries] = useState<Map<string, ChangelogEntry[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formVersion, setFormVersion] = useState("1.0.0");
  const [formType, setFormType] = useState<ChangelogEntry["type"]>("feat");
  const [formDesc, setFormDesc] = useState("");

  const groupAndSort = (list: ChangelogEntry[]) => {
    const grouped = new Map<string, ChangelogEntry[]>();
    list.forEach((entry) => {
      if (!grouped.has(entry.version)) grouped.set(entry.version, []);
      grouped.get(entry.version)!.push(entry);
    });
    return new Map(
      [...grouped.entries()].sort((a, b) =>
        b[0].localeCompare(a[0], undefined, { numeric: true })
      )
    );
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await schedulerClient.get<any[]>('/devops/changelog');
        const list = (res.data ?? []).map(mapEntryFromApi);
        saveEntriesToStorage(list);
        setEntries(groupAndSort(list));
      } catch {
        const list = loadEntriesFromStorage();
        setEntries(groupAndSort(list));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleAddEntry = async () => {
    if (!formDesc.trim() || !formVersion.trim()) return;
    const newEntry: ChangelogEntry = {
      id: crypto.randomUUID(),
      type: formType,
      description: formDesc.trim(),
      date: new Date(),
      version: formVersion.trim(),
    };
    const allEntries = loadEntriesFromStorage();
    const updated = [newEntry, ...allEntries];
    saveEntriesToStorage(updated);
    setEntries(groupAndSort(updated));
    setShowForm(false);
    setFormDesc("");
    toast.success("Entrée de changelog ajoutée");
    try {
      await schedulerClient.post('/devops/changelog', {
        version: newEntry.version,
        type: newEntry.type,
        description: newEntry.description,
      });
    } catch {
      // localStorage already updated
    }
  };

  const getTypeIcon = (type: ChangelogEntry["type"]) => {
    switch (type) {
      case "feat": return <Zap className="w-4 h-4 text-blue-500" />;
      case "fix": return <Bug className="w-4 h-4 text-red-500" />;
      case "chore": return <Wrench className="w-4 h-4 text-gray-500" />;
      case "docs": return <BookOpen className="w-4 h-4 text-green-500" />;
    }
  };

  const getTypeBadgeClass = (type: ChangelogEntry["type"]) => {
    switch (type) {
      case "feat": return "bg-blue-100 text-blue-800";
      case "fix": return "bg-red-100 text-red-800";
      case "chore": return "bg-gray-100 text-gray-800";
      case "docs": return "bg-green-100 text-green-800";
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  if (isLoading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Changelog</h2>
        </div>
        {showForm ? (
          <div className="flex gap-2 flex-wrap">
            <Input value={formVersion} onChange={(e) => setFormVersion(e.target.value)} placeholder="1.0.0" className="w-24 h-8 text-sm" />
            <select value={formType} onChange={(e) => setFormType(e.target.value as ChangelogEntry["type"])} className="border rounded px-2 h-8 text-sm">
              {["feat","fix","chore","docs"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Description" className="w-48 h-8 text-sm" onKeyDown={(e) => e.key === "Enter" && handleAddEntry()} />
            <Button size="sm" onClick={handleAddEntry}>Enregistrer</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Entry
          </Button>
        )}
      </div>

      {entries.size === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No changelog entries yet. Add one to get started.</p>
        </div>
      ) : (
        Array.from(entries.entries()).map(([version, versionEntries]) => (
          <div key={version} className="border-l-2 border-blue-500 pl-6">
            <h3 className="text-base font-semibold mb-4">Version {version}</h3>
            <div className="space-y-3">
              {versionEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 pb-3 border-b border-gray-200 last:border-b-0"
                >
                  <div className="flex-shrink-0 mt-1">{getTypeIcon(entry.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeClass(entry.type)}`}>
                        {entry.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{entry.description}</p>
                  </div>
                  <div className="flex-shrink-0 text-xs text-gray-500 whitespace-nowrap ml-4">
                    {formatDate(entry.date)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
