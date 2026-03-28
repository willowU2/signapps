'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowRight, Grid } from 'lucide-react';
import { APP_REGISTRY, APP_CATEGORIES, AppEntry } from '@/lib/app-registry';
import { cn } from '@/lib/utils';
import * as LucideIcons from 'lucide-react';
import SpotlightCard from '@/components/ui/spotlight-card';

function DynIcon({ name, className }: { name: string; className?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (LucideIcons as any)[name] as React.ComponentType<{ className?: string }> | undefined;
  if (!Icon) return <LucideIcons.Grid className={className} />;
  return <Icon className={className} />;
}

function LocalAppCard({ app }: { app: AppEntry }) {
  const router = useRouter();
  
  return (
    <SpotlightCard 
      className="group cursor-pointer p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md h-full"
      onClick={() => router.push(app.href)}
    >
      <div className="flex flex-col h-full justify-between">
        <div className="flex items-start gap-4">
          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/60", app.color)}>
             <DynIcon name={app.icon} className="h-6 w-6 shrink-0" />
          </div>
          <div className="flex-1 space-y-1.5 pt-1">
            <h3 className="font-semibold leading-none tracking-tight">{app.label}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">{app.description}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Badge variant="secondary" className="text-[10px] font-normal">{app.category}</Badge>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-all group-hover:opacity-100">
            <ArrowRight className="h-3 w-3 shrink-0" />
          </div>
        </div>
      </div>
    </SpotlightCard>
  );
}

export default function AllAppsPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredApps = useMemo(() => {
    let result = APP_REGISTRY;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (app) =>
          app.label.toLowerCase().includes(q) ||
          app.description.toLowerCase().includes(q) ||
          app.category.toLowerCase().includes(q)
      );
    }

    if (activeCategory !== 'all') {
      const cat = activeCategory;
      result = result.filter((app) => app.category === cat);
    }

    return result;
  }, [search, activeCategory]);

  const isGroupedView = !search && activeCategory === 'all';

  const groupedByCategory = useMemo(() => {
    if (!isGroupedView) return new Map<string, AppEntry[]>();
    const groups = new Map<string, AppEntry[]>();
    for (const app of APP_REGISTRY) {
      if (!groups.has(app.category)) {
        groups.set(app.category, []);
      }
      groups.get(app.category)!.push(app);
    }
    return groups;
  }, [isGroupedView]);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Toutes les Applications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Lancez vos applications intelligentes depuis votre portail centralisé.
            </p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher une application..."
              className="pl-9 h-10 w-full rounded-lg"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Categories Badges */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory('all')}
            className="rounded-full"
          >
            Toutes
          </Button>
          {APP_CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className="rounded-full"
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Applications Grid */}
        {isGroupedView ? (
          <div className="space-y-10 pb-10">
            {APP_CATEGORIES.map((category) => {
              const categoryApps = groupedByCategory.get(category) || [];
              if (categoryApps.length === 0) return null;
              
              return (
                <div key={category} className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                       {category}
                      <span className="flex h-5 items-center justify-center rounded-full bg-muted px-2 text-[11px] font-medium text-muted-foreground">
                        {categoryApps.length}
                      </span>
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {categoryApps.map((app) => (
                      <LocalAppCard key={app.id} app={app} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pb-10">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredApps.map((app) => (
                <LocalAppCard key={app.id} app={app} />
              ))}
            </div>

            {filteredApps.length === 0 && (
              <div className="py-24 text-center">
                <Grid className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold">Aucune application trouvée</h3>
                <p className="text-muted-foreground mt-1">Essayez de modifier votre recherche.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
