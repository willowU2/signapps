'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Package } from 'lucide-react';
import type { StoreApp } from '@/lib/api';

interface AppCardProps {
  app: StoreApp;
  onInstall: (app: StoreApp) => void;
}

export function AppCard({ app, onInstall }: AppCardProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
            {app.icon && !imgError ? (
              <Image
                src={app.icon}
                alt={app.name}
                width={48}
                height={48}
                className="h-12 w-12 object-contain"
                onError={() => setImgError(true)}
                unoptimized
              />
            ) : (
              <Package className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold leading-tight">{app.name}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {app.description}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {app.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {app.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{app.tags.length - 3}
            </Badge>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="truncate text-xs text-muted-foreground">
            {app.source_name}
          </span>
          <Button size="sm" onClick={() => onInstall(app)}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Install
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
