"use client";

import { useEffect, useState } from "react";
import { Zap, Bug, Wrench, BookOpen } from "lucide-react";

interface ChangelogEntry {
  id: string;
  type: "feat" | "fix" | "chore" | "docs";
  description: string;
  date: Date;
  version: string;
}

export function ChangelogViewer() {
  const [entries, setEntries] = useState<Map<string, ChangelogEntry[]>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize with mock changelog data grouped by version
    const mockEntries: ChangelogEntry[] = [
      {
        id: "1",
        type: "feat",
        description: "OAuth2 provider support for enterprise SSO",
        date: new Date(Date.now() - 5 * 60000),
        version: "2.4.1",
      },
      {
        id: "2",
        type: "fix",
        description: "Improve S3 compatibility layer",
        date: new Date(Date.now() - 25 * 60000),
        version: "2.4.1",
      },
      {
        id: "3",
        type: "chore",
        description: "Update TypeScript to 5.5",
        date: new Date(Date.now() - 2 * 3600000),
        version: "2.4.1",
      },
      {
        id: "4",
        type: "feat",
        description: "Real-time message encryption in Chat Service",
        date: new Date(Date.now() - 6 * 3600000),
        version: "2.4.0",
      },
      {
        id: "5",
        type: "fix",
        description: "Calendar sync issue with recurring events",
        date: new Date(Date.now() - 24 * 3600000),
        version: "2.4.0",
      },
      {
        id: "6",
        type: "docs",
        description: "Add API documentation for v2",
        date: new Date(Date.now() - 48 * 3600000),
        version: "2.4.0",
      },
      {
        id: "7",
        type: "feat",
        description: "Optimize model inference pipeline",
        date: new Date(Date.now() - 72 * 3600000),
        version: "2.3.5",
      },
      {
        id: "8",
        type: "fix",
        description: "Memory leak in background task scheduler",
        date: new Date(Date.now() - 96 * 3600000),
        version: "2.3.5",
      },
    ];

    // Group by version
    const grouped = new Map<string, ChangelogEntry[]>();
    mockEntries.forEach((entry) => {
      if (!grouped.has(entry.version)) {
        grouped.set(entry.version, []);
      }
      grouped.get(entry.version)!.push(entry);
    });

    // Sort versions (descending)
    const sorted = new Map(
      [...grouped.entries()].sort((a, b) =>
        b[0].localeCompare(a[0], undefined, { numeric: true })
      )
    );

    setEntries(sorted);
    setIsLoading(false);
  }, []);

  const getTypeIcon = (type: ChangelogEntry["type"]) => {
    switch (type) {
      case "feat":
        return <Zap className="w-4 h-4 text-blue-500" />;
      case "fix":
        return <Bug className="w-4 h-4 text-red-500" />;
      case "chore":
        return <Wrench className="w-4 h-4 text-gray-500" />;
      case "docs":
        return <BookOpen className="w-4 h-4 text-green-500" />;
    }
  };

  const getTypeBadgeClass = (type: ChangelogEntry["type"]) => {
    switch (type) {
      case "feat":
        return "bg-blue-100 text-blue-800";
      case "fix":
        return "bg-red-100 text-red-800";
      case "chore":
        return "bg-gray-100 text-gray-800";
      case "docs":
        return "bg-green-100 text-green-800";
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading changelog...</div>;
  }

  if (entries.size === 0) {
    return <div className="text-center py-8 text-gray-500">No changelog entries</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <BookOpen className="w-5 h-5" />
        <h2 className="text-lg font-semibold">Changelog</h2>
      </div>

      {Array.from(entries.entries()).map(([version, versionEntries]) => (
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
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeClass(
                        entry.type
                      )}`}
                    >
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
      ))}
    </div>
  );
}
