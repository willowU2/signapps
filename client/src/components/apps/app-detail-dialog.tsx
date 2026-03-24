'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  Download,
  ExternalLink,
  Server,
  Cpu,
  Layers,
} from 'lucide-react';
import { storeApi } from '@/lib/api';
import type { StoreApp, AppDetails } from '@/lib/api';

interface AppDetailDialogProps {
  app: StoreApp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: (app: StoreApp) => void;
}

export function AppDetailDialog({
  app,
  open,
  onOpenChange,
  onInstall,
}: AppDetailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<AppDetails | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!app || !open) return;
    setLoading(true);
    setDetails(null);
    setImgError(false);

    storeApi
      .getAppDetails(app.source_id, app.id)
      .then((res) => setDetails(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [app, open]);

  if (!app) return null;

  const services = details?.config.services || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
              {app.icon && !imgError ? (
                <Image
                  src={app.icon}
                  alt={app.name}
                  width={64}
                  height={64}
                  className="h-16 w-16 object-contain"
                  onError={() => setImgError(true)}
                  unoptimized
                />
              ) : (
                <Package className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl">{app.name}</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {app.description}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {app.tags.map((tag, idx) => (
                  <Badge key={`${tag}-${idx}`} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </DialogHeader>

        {loading && (
          <div className="space-y-3 py-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {!loading && (
          <div className="space-y-5">
            {/* Architectures */}
            {app.supported_architectures.length > 0 && (
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Architectures:</span>
                {app.supported_architectures.map((arch) => (
                  <Badge key={arch} variant="outline" className="text-xs">
                    {arch}
                  </Badge>
                ))}
              </div>
            )}

            {/* Long description */}
            {app.long_description && (
              <div className="rounded-lg border p-4">
                <p className="whitespace-pre-wrap text-sm">
                  {app.long_description}
                </p>
              </div>
            )}

            {/* Services */}
            {services.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">
                    Services ({services.length})
                  </h4>
                </div>
                <div className="rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium">Name</th>
                        <th className="px-3 py-2 text-left font-medium">Image</th>
                        <th className="px-3 py-2 text-right font-medium">Ports</th>
                        <th className="px-3 py-2 text-right font-medium">Env</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((svc) => (
                        <tr key={svc.service_name} className="border-b last:border-0">
                          <td className="px-3 py-2 font-mono text-xs">
                            {svc.service_name}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {svc.image}
                          </td>
                          <td className="px-3 py-2 text-right text-xs">
                            {svc.ports.length > 0
                              ? svc.ports.map((p) => `${p.host}:${p.container}`).join(', ')
                              : '-'}
                          </td>
                          <td className="px-3 py-2 text-right text-xs">
                            {svc.environment.length || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Other sources */}
            {(app.duplicate_count ?? 0) > 1 && app.other_sources && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">
                    Available from {app.duplicate_count} sources
                  </h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default" className="text-xs">
                    {app.source_name}
                  </Badge>
                  {app.other_sources.map((src) => (
                    <Badge
                      key={src.source_id}
                      variant="outline"
                      className="text-xs"
                    >
                      {src.source_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Repository link */}
            {app.repository && (
              <a
                href={app.repository}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Repository
              </a>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => onInstall(app)}>
            <Download className="mr-2 h-4 w-4" />
            Install
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
