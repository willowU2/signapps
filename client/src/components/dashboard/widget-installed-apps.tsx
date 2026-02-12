'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, ArrowUpRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useContainers } from '@/hooks/use-containers';
import { getContainerUrl } from '@/lib/utils';

export function WidgetInstalledApps() {
  const { data: containers = [] } = useContainers();

  const installedApps = containers.filter(
    (c) => c.is_managed && !c.is_system && c.state === 'running',
  );

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Installed Apps
        </CardTitle>
        <Link href="/containers">
          <Button variant="ghost" size="sm">
            View all containers
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {installedApps.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {installedApps.map((app) => {
              const url = getContainerUrl(app.portMappings);
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{app.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{app.image.split(':')[0].split('/').pop()}</p>
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
