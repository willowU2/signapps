'use client';

/**
 * Storage Usage widget — self-contained.
 * Shows storage bucket count and usage overview.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { HardDrive } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { storageApi } from '@/lib/api/storage';
import type { WidgetRenderProps } from '@/lib/dashboard/types';

export function WidgetStorageUsage({ widget }: Partial<WidgetRenderProps> = {}) {
  const { data, isLoading } = useQuery({
    queryKey: ['widget-storage-usage'],
    queryFn: async () => {
      try {
        const res = await storageApi.listBuckets();
        const buckets = res.data || [];
        return { bucketCount: buckets.length, buckets };
      } catch {
        return { bucketCount: 0, buckets: [] };
      }
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary" />
            Stockage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-primary" />
          Stockage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <HardDrive className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{data?.bucketCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">bucket{(data?.bucketCount ?? 0) !== 1 ? 's' : ''} actif{(data?.bucketCount ?? 0) !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
