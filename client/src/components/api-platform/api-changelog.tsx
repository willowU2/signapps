"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  GitCommit,
  Search,
  AlertTriangle,
  Plus,
  RefreshCw,
  Minus,
} from "lucide-react";

interface ChangeEntry {
  id: string;
  version: string;
  date: string;
  service: string;
  type: "breaking" | "feature" | "fix" | "deprecation";
  endpoint?: string;
  description: string;
}

const CHANGELOG: ChangeEntry[] = [
  {
    id: "1",
    version: "v1.5.0",
    date: "2025-03-20",
    service: "identity",
    type: "feature",
    endpoint: "POST /api/v1/auth/passkey",
    description: "Added passkey/WebAuthn authentication support",
  },
  {
    id: "2",
    version: "v1.5.0",
    date: "2025-03-20",
    service: "storage",
    type: "feature",
    endpoint: "GET /api/v1/files/{id}/preview",
    description: "New document preview endpoint for PDF and images",
  },
  {
    id: "3",
    version: "v1.4.0",
    date: "2025-03-10",
    service: "identity",
    type: "breaking",
    endpoint: "POST /api/v1/auth/login",
    description: "Response now returns `access_token` instead of `token` field",
  },
  {
    id: "4",
    version: "v1.4.0",
    date: "2025-03-10",
    service: "mail",
    type: "deprecation",
    endpoint: "GET /api/v1/mail/inbox/messages",
    description: "Deprecated — use /api/v1/mail/messages?folder=INBOX instead",
  },
  {
    id: "5",
    version: "v1.3.2",
    date: "2025-02-28",
    service: "calendar",
    type: "fix",
    endpoint: "PUT /api/v1/events/{id}",
    description:
      "Fixed timezone handling for recurring events in DST transition",
  },
  {
    id: "6",
    version: "v1.3.0",
    date: "2025-02-15",
    service: "ai",
    type: "feature",
    endpoint: "POST /api/v1/ai/embed",
    description: "Added text embedding endpoint for semantic search",
  },
  {
    id: "7",
    version: "v1.3.0",
    date: "2025-02-15",
    service: "storage",
    type: "breaking",
    endpoint: "POST /api/v1/upload",
    description:
      "Max file size reduced to 100MB; use multipart for larger files",
  },
  {
    id: "8",
    version: "v1.2.0",
    date: "2025-01-30",
    service: "containers",
    type: "feature",
    endpoint: "GET /api/v1/containers/{id}/logs/stream",
    description: "Real-time log streaming via SSE",
  },
];

const TYPE_CONFIG = {
  breaking: {
    label: "Breaking",
    icon: AlertTriangle,
    color: "bg-red-100 text-red-700 border-red-200",
  },
  feature: {
    label: "Feature",
    icon: Plus,
    color: "bg-green-100 text-green-700 border-green-200",
  },
  fix: {
    label: "Fix",
    icon: RefreshCw,
    color: "bg-blue-100 text-blue-700 border-blue-200",
  },
  deprecation: {
    label: "Deprecated",
    icon: Minus,
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
};

export function ApiChangelog() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | ChangeEntry["type"]>(
    "all",
  );

  const filtered = CHANGELOG.filter((c) => {
    const matchSearch =
      !search ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.service.includes(search.toLowerCase()) ||
      (c.endpoint || "").includes(search.toLowerCase());
    const matchType = typeFilter === "all" || c.type === typeFilter;
    return matchSearch && matchType;
  });

  const versions = Array.from(new Set(filtered.map((c) => c.version)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitCommit className="h-5 w-5 text-primary" />
          API Changelog
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="pl-8 h-8 text-sm"
            />
          </div>
          <div className="flex gap-1">
            {(
              ["all", "breaking", "feature", "fix", "deprecation"] as const
            ).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-muted hover:bg-accent"}`}
              >
                {t === "all" ? "All" : TYPE_CONFIG[t].label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {versions.map((version) => {
            const entries = filtered.filter((c) => c.version === version);
            const hasBreaking = entries.some((e) => e.type === "breaking");
            return (
              <div key={version}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant={hasBreaking ? "destructive" : "default"}
                    className="font-mono"
                  >
                    {version}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {entries[0]?.date}
                  </span>
                  {hasBreaking && (
                    <Badge variant="destructive" className="text-[10px]">
                      Breaking changes
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5 pl-4 border-l-2 border-muted">
                  {entries.map((entry) => {
                    const TypeIcon = TYPE_CONFIG[entry.type].icon;
                    return (
                      <div key={entry.id} className="flex items-start gap-2">
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] border font-medium mt-0.5 ${TYPE_CONFIG[entry.type].color}`}
                        >
                          {TYPE_CONFIG[entry.type].label}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="secondary"
                              className="text-[10px] font-normal"
                            >
                              {entry.service}
                            </Badge>
                            {entry.endpoint && (
                              <code className="text-[10px] font-mono text-muted-foreground">
                                {entry.endpoint}
                              </code>
                            )}
                          </div>
                          <p className="text-xs mt-0.5">{entry.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
