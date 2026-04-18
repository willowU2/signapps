"use client";

/**
 * All Applications widget — self-contained.
 * Shows a searchable, categorized grid of all applications (for pinning).
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Grid, ChevronDown, ChevronUp, Pin } from "lucide-react";
import { APP_CATEGORIES, type AppEntry } from "@/lib/app-registry";
import { useAppRegistry } from "@/hooks/use-app-registry";
import { usePinnedAppsStore } from "@/lib/store";
import { cn } from "@/lib/utils";
// AQ-PERF: lazy-load each lucide icon individually (kebab-case name)
// rather than pulling the whole barrel into the dashboard bundle.
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import type { WidgetRenderProps } from "@/lib/dashboard/types";

const LUCIDE_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function AppIcon({ name, className }: { name: string; className?: string }) {
  const kebab = name
    .replace(/([A-Z])/g, "-$1")
    .replace(/^-/, "")
    .toLowerCase();
  if (!LUCIDE_NAME_RE.test(kebab)) {
    return <Grid className={className} />;
  }
  return (
    <DynamicIcon
      name={kebab as IconName}
      className={className}
      fallback={() => <Grid className={className} />}
    />
  );
}

export function WidgetAllApps({ widget }: Partial<WidgetRenderProps> = {}) {
  const router = useRouter();
  const { apps: appRegistry } = useAppRegistry();
  const { pinApp, pinnedApps } = usePinnedAppsStore();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filteredBySearch = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return appRegistry.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    );
  }, [search, appRegistry]);

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleDragStart = (e: React.DragEvent, app: AppEntry) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        href: app.href,
        icon: app.icon,
        label: app.label,
        color: app.color,
      }),
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Grid className="h-4 w-4 text-primary" />
          Toutes les applications ({appRegistry.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 space-y-3 p-3 pt-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8"
          />
        </div>
        <ScrollArea className="flex-1 h-full">
          {filteredBySearch ? (
            filteredBySearch.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                Aucune application trouvée
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {filteredBySearch.map((app) => (
                  <AppTile
                    key={app.id}
                    app={app}
                    onDragStart={handleDragStart}
                    pinApp={pinApp}
                    pinnedApps={pinnedApps}
                    router={router}
                  />
                ))}
              </div>
            )
          ) : (
            APP_CATEGORIES.map((cat) => {
              const apps = appRegistry.filter((a) => a.category === cat);
              const isCollapsed = collapsed[cat];
              return (
                <div key={cat} className="mb-2">
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="mb-1.5 flex w-full items-center gap-2 text-left"
                  >
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {cat}
                    </h3>
                    <span className="text-xs text-muted-foreground/60">
                      ({apps.length})
                    </span>
                    <div className="ml-auto text-muted-foreground/60">
                      {isCollapsed ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronUp className="h-3.5 w-3.5" />
                      )}
                    </div>
                  </button>
                  {!isCollapsed && (
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {apps.map((app) => (
                        <AppTile
                          key={app.id}
                          app={app}
                          onDragStart={handleDragStart}
                          pinApp={pinApp}
                          pinnedApps={pinnedApps}
                          router={router}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function AppTile({
  app,
  onDragStart,
  pinApp,
  pinnedApps,
  router,
}: {
  app: AppEntry;
  onDragStart: (e: React.DragEvent, app: AppEntry) => void;
  pinApp: (p: {
    href: string;
    icon: string;
    label: string;
    color: string;
  }) => void;
  pinnedApps: { href: string }[];
  router: ReturnType<typeof useRouter>;
}) {
  const isPinned = pinnedApps.some((p) => p.href === app.href);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, app)}
      onClick={() => router.push(app.href)}
      className="group relative flex cursor-pointer flex-col items-start gap-1.5 rounded-lg border border-border bg-card p-2 transition-all duration-200 hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex w-full items-start justify-between gap-1">
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted",
            app.color,
          )}
        >
          <AppIcon name={app.icon} className="h-3.5 w-3.5" />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            pinApp({
              href: app.href,
              icon: app.icon,
              label: app.label,
              color: app.color,
            });
          }}
          className={cn(
            "shrink-0 rounded p-0.5 text-muted-foreground transition-all",
            isPinned
              ? "text-primary opacity-100"
              : "opacity-0 hover:bg-muted group-hover:opacity-100",
          )}
        >
          <Pin className="h-2.5 w-2.5" />
        </button>
      </div>
      <p className="text-xs font-medium leading-tight truncate w-full">
        {app.label}
      </p>
    </div>
  );
}
