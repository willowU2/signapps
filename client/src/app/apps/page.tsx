'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, RefreshCw, Settings2 } from 'lucide-react';
import { storeApi } from '@/lib/api';
import type { StoreApp } from '@/lib/api';
import { AppCard } from '@/components/apps/app-card';
import { InstallDialog } from '@/components/apps/install-dialog';
import { SourceManager } from '@/components/apps/source-manager';

export default function AppsPage() {
  const [apps, setApps] = useState<StoreApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Dialogs
  const [installApp, setInstallApp] = useState<StoreApp | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const fetchApps = async (params?: { search?: string; category?: string }) => {
    try {
      const res = await storeApi.listApps(params);
      setApps(res.data);
    } catch {
      // Silently fail – store may not be loaded yet
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchApps().finally(() => setLoading(false));
  }, []);

  // Extract unique categories from tags
  const categories = useMemo(() => {
    const tagCounts = new Map<string, number>();
    apps.forEach((app) => {
      app.tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag]) => tag);
  }, [apps]);

  // Client-side filtering
  const filteredApps = useMemo(() => {
    let result = apps;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (app) =>
          app.name.toLowerCase().includes(q) ||
          app.description.toLowerCase().includes(q) ||
          app.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (activeCategory !== 'all') {
      const cat = activeCategory.toLowerCase();
      result = result.filter((app) =>
        app.tags.some((t) => t.toLowerCase() === cat)
      );
    }

    return result;
  }, [apps, search, activeCategory]);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await storeApi.refreshAll();
      await fetchApps();
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
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
              {apps.length} apps available
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSourcesOpen(true)}>
              <Settings2 className="mr-2 h-4 w-4" />
              Sources
            </Button>
            <Button variant="outline" onClick={handleRefreshAll} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search apps..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory('all')}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* App Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredApps.map((app) => (
            <AppCard
              key={`${app.source_id}-${app.id}`}
              app={app}
              onInstall={setInstallApp}
            />
          ))}
        </div>

        {filteredApps.length === 0 && !loading && (
          <div className="py-12 text-center text-muted-foreground">
            {search || activeCategory !== 'all'
              ? 'No apps match your filters'
              : 'No apps available. Try refreshing sources.'}
          </div>
        )}

        {/* Install Dialog */}
        <InstallDialog
          app={installApp}
          open={!!installApp}
          onOpenChange={(open) => {
            if (!open) setInstallApp(null);
          }}
          onInstalled={() => {
            setInstallApp(null);
          }}
        />

        {/* Source Manager */}
        <SourceManager
          open={sourcesOpen}
          onOpenChange={setSourcesOpen}
          onSourcesChanged={() => fetchApps()}
        />
      </div>
    </AppLayout>
  );
}
