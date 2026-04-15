"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  RefreshCw,
  Settings2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { storeApi, containersApi } from "@/lib/api";
import type { StoreApp } from "@/lib/api";
import type { ContainerInfo, InstallResponse } from "@/lib/api/containers";
import type { ContainerPortMapping } from "@/hooks/use-containers";
import { getContainerUrl } from "@/lib/utils";
import { CardGridSkeleton } from "@/components/ui/skeleton-loader";
import { AppCard } from "@/components/apps/app-card";
import { InstallDialog } from "@/components/apps/install-dialog";
import { AppDetailDialog } from "@/components/apps/app-detail-dialog";
import { SourceManager } from "@/components/apps/source-manager";
import { CustomAppDialog } from "@/components/apps/custom-app-dialog";
import { Plus } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";

const PAGE_SIZE = 24;

// Map image name to container info for installed detection + URL
interface InstalledContainer {
  id: string;
  image: string;
  portMappings: ContainerPortMapping[];
  state: string;
}

export default function AppsPage() {
  usePageTitle("Applications");
  const [apps, setApps] = useState<StoreApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [installedMap, setInstalledMap] = useState<
    Map<string, InstalledContainer>
  >(new Map());
  const [page, setPage] = useState(1);

  // Dialogs
  const [installApp, setInstallApp] = useState<StoreApp | null>(null);
  const [detailApp, setDetailApp] = useState<StoreApp | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [customAppOpen, setCustomAppOpen] = useState(false);

  const fetchApps = async (params?: { search?: string; category?: string }) => {
    try {
      const res = await storeApi.listApps(params?.category, params?.search);
      setApps(res.data);
    } catch {
      // Silently fail – store may not be loaded yet
    }
  };

  const fetchInstalledContainers = useCallback(async () => {
    try {
      const res = await containersApi.list();
      const map = new Map<string, InstalledContainer>();
      for (const c of (res.data || []) as (ContainerInfo & {
        docker_info?: InstallResponse["docker_info"];
      })[]) {
        const appId = c.labels?.["signapps.app.id"];
        const imgBase = (c.image as string).split(":")[0].toLowerCase();
        const portMappings: ContainerPortMapping[] = (
          c.docker_info?.ports || []
        )
          .filter((p: { host_port?: number }) => p.host_port)
          .map(
            (p: {
              host_port: number;
              container_port: number;
              protocol?: string;
            }) => ({
              host: p.host_port,
              container: p.container_port,
              protocol: p.protocol || "tcp",
            }),
          );
        const state: string = c.docker_info?.state || "unknown";

        map.set(appId || imgBase, {
          id: c.id,
          image: c.image,
          portMappings,
          state,
        });
      }
      setInstalledMap(map);
    } catch {
      // ignore
    }
  }, []);

  // Find installed container id for a store app by matching app.id or image
  const getInstalledId = useCallback(
    (app: StoreApp): string | undefined => {
      let id = installedMap.get(app.id)?.id;
      if (!id && app.image) {
        const imgBase = app.image.split(":")[0].toLowerCase();
        id = installedMap.get(imgBase)?.id;
      }
      return id;
    },
    [installedMap],
  );

  // Get URL for an installed app
  const getInstalledUrl = useCallback(
    (app: StoreApp): string | null => {
      let container = installedMap.get(app.id);
      if (!container && app.image) {
        const imgBase = app.image.split(":")[0].toLowerCase();
        container = installedMap.get(imgBase);
      }
      if (!container || container.state !== "running") return null;
      return getContainerUrl(container.portMappings);
    },
    [installedMap],
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchApps(), fetchInstalledContainers()]).finally(() =>
      setLoading(false),
    );
  }, [fetchInstalledContainers]);

  // Reset page when search/category changes
  useEffect(() => {
    setPage(1);
  }, [search, activeCategory]);

  // Deduplicate apps by name (keep first occurrence per name)
  const deduplicatedApps = useMemo(() => {
    const seen = new Set<string>();
    return apps.filter((app) => {
      const key = app.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [apps]);

  // Extract unique categories from tags
  const categories = useMemo(() => {
    const tagCounts = new Map<string, number>();
    deduplicatedApps.forEach((app) => {
      app.tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag]) => tag);
  }, [deduplicatedApps]);

  // Client-side filtering
  const filteredApps = useMemo(() => {
    let result = deduplicatedApps;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (app) =>
          app.name.toLowerCase().includes(q) ||
          app.description.toLowerCase().includes(q) ||
          app.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    if (activeCategory !== "all") {
      const cat = activeCategory.toLowerCase();
      result = result.filter((app) =>
        app.tags.some((t) => t.toLowerCase() === cat),
      );
    }

    return result;
  }, [deduplicatedApps, search, activeCategory]);

  // Determine if we should show grouped view (no search, no category filter)
  const isGroupedView = !search && activeCategory === "all";

  // Group apps by their first tag (category) for the grouped view
  const groupedByCategory = useMemo(() => {
    if (!isGroupedView) return new Map<string, StoreApp[]>();
    const groups = new Map<string, StoreApp[]>();
    for (const app of deduplicatedApps) {
      const cat = app.tags[0] || "Other";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(app);
    }
    // Sort categories by count (descending) to show most populated first
    return new Map(
      Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length),
    );
  }, [deduplicatedApps, isGroupedView]);

  const GROUPED_PREVIEW_SIZE = 4;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredApps.length / PAGE_SIZE));
  const paginatedApps = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredApps.slice(start, start + PAGE_SIZE);
  }, [filteredApps, page]);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await storeApi.refreshAll();
      await Promise.all([fetchApps(), fetchInstalledContainers()]);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">App Store</h1>
          </div>
          <CardGridSkeleton
            count={8}
            className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">App Store</h1>
            <p className="text-sm text-muted-foreground">
              {filteredApps.length} application
              {filteredApps.length !== 1 ? "s" : ""}
              {totalPages > 1 && ` (page ${page}/${totalPages})`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="default" onClick={() => setCustomAppOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter une app
            </Button>
            <Button variant="outline" onClick={() => setSourcesOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Sources
            </Button>
            <Button
              variant="outline"
              onClick={handleRefreshAll}
              disabled={refreshing}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Actualiser
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory("all")}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Grouped view: show apps by category with preview rows */}
        {isGroupedView ? (
          <div className="space-y-8">
            {Array.from(groupedByCategory.entries()).map(
              ([category, categoryApps]) => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                      {category}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        ({categoryApps.length})
                      </span>
                    </h2>
                    {categoryApps.length > GROUPED_PREVIEW_SIZE && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveCategory(category)}
                      >
                        View all
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {categoryApps
                      .slice(0, GROUPED_PREVIEW_SIZE)
                      .map((app, idx) => (
                        <AppCard
                          key={`grouped-${category}-${app.source_id}-${app.id}-${idx}`}
                          app={app}
                          onInstall={setInstallApp}
                          onDetail={setDetailApp}
                          installedContainerId={getInstalledId(app)}
                          containerUrl={getInstalledUrl(app)}
                          onUpdated={fetchInstalledContainers}
                        />
                      ))}
                  </div>
                </div>
              ),
            )}

            {apps.length === 0 && (
              <div className="py-12 text-center text-muted-foreground">
                No apps available. Try refreshing sources.
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Flat grid with pagination */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedApps.map((app, idx) => (
                <AppCard
                  key={`flat-${app.source_id}-${app.id}-${app.name}-${idx}`}
                  app={app}
                  onInstall={setInstallApp}
                  onDetail={setDetailApp}
                  installedContainerId={getInstalledId(app)}
                  containerUrl={getInstalledUrl(app)}
                  onUpdated={fetchInstalledContainers}
                />
              ))}
            </div>

            {filteredApps.length === 0 && !loading && (
              <div className="py-12 text-center text-muted-foreground">
                No apps match your filters
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}

        {/* Detail Dialog */}
        <AppDetailDialog
          app={detailApp}
          open={!!detailApp}
          onOpenChange={(open) => {
            if (!open) setDetailApp(null);
          }}
          onInstall={(app) => {
            setDetailApp(null);
            setInstallApp(app);
          }}
        />

        {/* Install Dialog */}
        <InstallDialog
          app={installApp}
          open={!!installApp}
          onOpenChange={(open) => {
            if (!open) setInstallApp(null);
          }}
          onInstalled={() => {
            setInstallApp(null);
            fetchInstalledContainers();
          }}
        />

        {/* Custom App Dialog */}
        <CustomAppDialog
          open={customAppOpen}
          onOpenChange={setCustomAppOpen}
          onInstalled={fetchInstalledContainers}
        />

        {/* Source Manager */}
        <SourceManager
          open={sourcesOpen}
          onOpenChange={setSourcesOpen}
          onSourcesChanged={() => {
            fetchApps();
            fetchInstalledContainers();
          }}
        />
      </div>
    </AppLayout>
  );
}
