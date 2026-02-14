'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, ArrowUpRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useContainers } from '@/hooks/use-containers';
import { getContainerUrl } from '@/lib/utils';
import { storeApi } from '@/lib/api';
import type { StoreApp } from '@/lib/api';

function AppIcon({ iconUrl, name }: { iconUrl?: string; name: string }) {
  const [error, setError] = useState(false);

  if (!iconUrl || error) {
    return <Package className="h-5 w-5 text-primary" />;
  }

  return (
    <Image
      src={iconUrl}
      alt={name}
      width={40}
      height={40}
      className="h-full w-full object-contain"
      onError={() => setError(true)}
      unoptimized
    />
  );
}

export function WidgetInstalledApps() {
  const { data: containers = [] } = useContainers();
  const [iconMap, setIconMap] = useState<Map<string, string>>(new Map());

  // Load store apps to build app_name → icon mapping
  useEffect(() => {
    storeApi.listApps().then((res) => {
      const map = new Map<string, string>();
      for (const app of (res.data || []) as StoreApp[]) {
        if (app.icon) {
          map.set(app.name.toLowerCase(), app.icon);
          // Also map by image base name for fallback matching
          const imgBase = app.image?.split(':')[0]?.split('/').pop()?.toLowerCase();
          if (imgBase) map.set(imgBase, app.icon);
        }
      }
      setIconMap(map);
    }).catch(() => {});
  }, []);

  const installedApps = containers.filter(
    (c) => c.is_managed && !c.is_system && c.state === 'running',
  );

  // Find icon for a container by matching app_name or image name
  const getIcon = (appName?: string, image?: string): string | undefined => {
    if (appName) {
      const icon = iconMap.get(appName.toLowerCase());
      if (icon) return icon;
    }
    if (image) {
      const imgBase = image.split(':')[0].split('/').pop()?.toLowerCase();
      if (imgBase) return iconMap.get(imgBase);
    }
    return undefined;
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Installed Apps
          {installedApps.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {installedApps.length}
            </Badge>
          )}
        </CardTitle>
        <Link href="/containers">
          <Button variant="ghost" size="sm">
            View all containers
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="flex-1">
        {installedApps.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {installedApps.map((app) => {
              const url = getContainerUrl(app.portMappings);
              const icon = getIcon(app.app_name, app.image);
              const Wrapper = url ? 'a' : 'div';
              const linkProps = url
                ? { href: url, target: '_blank' as const, rel: 'noopener noreferrer' }
                : {};
              return (
                <Wrapper
                  key={app.id}
                  {...linkProps}
                  className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10">
                    <AppIcon iconUrl={icon} name={app.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">
                      {app.app_name || app.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {app.image.split(':')[0].split('/').pop()}
                    </p>
                  </div>
                  {url ? (
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-xs">No port</Badge>
                  )}
                </Wrapper>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">No running apps</p>
            <Link href="/apps">
              <Button variant="link" size="sm" className="mt-2">
                Browse App Store
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
