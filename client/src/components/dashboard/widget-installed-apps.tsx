"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowUpRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useContainers } from "@/hooks/use-containers";
import { getContainerUrl } from "@/lib/utils";
import { storeApi } from "@/lib/api";
import type { StoreApp } from "@/lib/api";
import TiltedCard from "@/components/ui/tilted-card";

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
    storeApi
      .listApps()
      .then((res) => {
        const map = new Map<string, string>();
        for (const app of (res.data || []) as StoreApp[]) {
          if (app.icon) {
            map.set(app.name.toLowerCase(), app.icon);
            // Also map by image base name for fallback matching
            const imgBase = app.image
              ?.split(":")[0]
              ?.split("/")
              .pop()
              ?.toLowerCase();
            if (imgBase) map.set(imgBase, app.icon);
          }
        }
        setIconMap(map);
      })
      .catch(() => {});
  }, []);

  const installedApps = containers.filter(
    (c) => !c.is_system && c.state === "running",
  );

  // Find icon for a container by matching app_name or image name
  const getIcon = (appName?: string, image?: string): string | undefined => {
    if (appName) {
      const icon = iconMap.get(appName.toLowerCase());
      if (icon) return icon;
    }
    if (image) {
      const imgBase = image.split(":")[0].split("/").pop()?.toLowerCase();
      if (imgBase) return iconMap.get(imgBase);
    }
    return undefined;
  };

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border/50 bg-gradient-to-br from-background to-muted/20 relative shadow-sm">
      <div className="absolute inset-0 bg-grid-white/5 opacity-[0.02] pointer-events-none" />
      <CardHeader className="flex flex-row items-center justify-between shrink-0 relative z-10 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
          <Package className="h-5 w-5 text-foreground" />
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
      <CardContent className="flex-1 relative z-10">
        {installedApps.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {installedApps.map((app) => {
              const url = getContainerUrl(app.portMappings);
              const icon = getIcon(app.app_name, app.image);
              const Wrapper = url ? "a" : "div";
              const linkProps = url
                ? {
                    href: url,
                    target: "_blank" as const,
                    rel: "noopener noreferrer",
                  }
                : {};
              return (
                <TiltedCard
                  key={app.id}
                  containerHeight="88px"
                  containerWidth="100%"
                  imageHeight="100%"
                  imageWidth="100%"
                  rotateAmplitude={12}
                  scaleOnHover={1.02}
                  showMobileWarning={false}
                  showTooltip={false}
                  displayOverlayContent={true}
                  overlayContent={
                    <Wrapper
                      {...linkProps}
                      className="w-full h-full relative flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/50 p-3 transition-colors duration-300 hover:border-primary/40 overflow-hidden shadow-sm hover:shadow-md cursor-pointer"
                    >
                      {/* Background base */}
                      <div className="absolute inset-0 bg-background/80 z-0 pointer-events-none" />

                      {/* Soft gradient */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent z-0 pointer-events-none" />

                      <div className="relative z-10 flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 shadow-sm border border-primary/10">
                          <AppIcon iconUrl={icon} name={app.name} />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="truncate font-semibold text-sm tracking-tight text-foreground">
                            {app.app_name || app.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {app.image.split(":")[0].split("/").pop()}
                          </p>
                        </div>
                      </div>

                      <div className="relative z-10 shrink-0">
                        {url ? (
                          <div className="bg-background/80 backdrop-blur-sm rounded-full p-1.5 border border-border/50 shadow-sm flex items-center gap-1 hover:bg-accent transition-colors">
                            <ExternalLink className="h-3.5 w-3.5 text-foreground" />
                          </div>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase font-semibold text-muted-foreground bg-background/50"
                          >
                            Internal
                          </Badge>
                        )}
                      </div>
                    </Wrapper>
                  }
                />
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
