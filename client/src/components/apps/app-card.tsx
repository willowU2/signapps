'use client';

import { SpinnerInfinity } from 'spinners-react';


import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Package, ArrowUpCircle, CheckCircle2, Layers, ExternalLink } from 'lucide-react';
import type { StoreApp } from '@/lib/api';
import { containersApi } from '@/lib/api';
import { toast } from 'sonner';
import SpotlightCard from '@/components/ui/spotlight-card';

interface AppCardProps {
  app: StoreApp;
  onInstall: (app: StoreApp) => void;
  onDetail: (app: StoreApp) => void;
  installedContainerId?: string;
  containerUrl?: string | null;
  onUpdated?: () => void;
}

export function AppCard({ app, onInstall, onDetail, installedContainerId, containerUrl, onUpdated }: AppCardProps) {
  const [imgError, setImgError] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleUpdate = async () => {
    if (!installedContainerId) return;
    setUpdating(true);
    try {
      await containersApi.update(installedContainerId);
      toast.success(`${app.name} updated`);
      onUpdated?.();
    } catch {
      toast.error(`Impossible de mettre à jour ${app.name}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <SpotlightCard className="group flex flex-col overflow-hidden transition-shadow hover:shadow-md h-full">
      <CardContent
        className="flex flex-1 cursor-pointer flex-col gap-3 p-4"
        onClick={() => onDetail(app)}
      >
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
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold leading-tight">{app.name}</h3>
              {installedContainerId && (
                <Badge variant="outline" className="shrink-0 text-xs bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Installed
                </Badge>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {app.description}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {app.tags.slice(0, 3).map((tag, i) => (
            <Badge key={`${tag}-${i}`} variant="secondary" className="text-xs">
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
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-xs text-muted-foreground">
              {app.source_name}
            </span>
            {(app.duplicate_count ?? 0) > 1 && (
              <Badge variant="outline" className="shrink-0 text-xs">
                <Layers className="mr-1 h-3 w-3" />
                {app.duplicate_count} sources
              </Badge>
            )}
          </div>
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {installedContainerId && containerUrl && (
              <Button
                size="sm"
                variant="default"
                asChild
              >
                <a href={containerUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  Open
                </a>
              </Button>
            )}
            {installedContainerId && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleUpdate}
                disabled={updating}
              >
                {updating ? (
                  <SpinnerInfinity size={24} secondaryColor="rgba(128,128,128,0.2)" color="currentColor" speed={120} className="mr-1 h-3.5 w-3.5 " />
                ) : (
                  <ArrowUpCircle className="mr-1 h-3.5 w-3.5" />
                )}
                Update
              </Button>
            )}
            {!installedContainerId && (
              <Button size="sm" onClick={() => onInstall(app)}>
                <Download className="mr-1 h-3.5 w-3.5" />
                Install
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </SpotlightCard>
  );
}
