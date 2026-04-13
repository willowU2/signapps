"use client";

/**
 * Storage Usage widget — self-contained.
 * Shows real storage usage from quota API + bucket count.
 */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HardDrive, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { storageApi, quotasApi } from "@/lib/api/storage";
import type { WidgetRenderProps } from "@/lib/dashboard/types";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function WidgetStorageUsage({
  widget,
}: Partial<WidgetRenderProps> = {}) {
  const { data, isLoading } = useQuery({
    queryKey: ["widget-storage-usage"],
    queryFn: async () => {
      const [bucketsRes, quotaRes] = await Promise.allSettled([
        storageApi.listBuckets(),
        quotasApi.getMyQuota(),
      ]);

      const bucketCount =
        bucketsRes.status === "fulfilled"
          ? (bucketsRes.value.data?.length ?? 0)
          : 0;
      const usedBytes =
        quotaRes.status === "fulfilled"
          ? (quotaRes.value.data?.storage?.used ?? 0)
          : 0;
      const limitBytes =
        quotaRes.status === "fulfilled"
          ? (quotaRes.value.data?.storage?.limit ?? 0)
          : 0;
      const percentage =
        quotaRes.status === "fulfilled"
          ? (quotaRes.value.data?.storage?.percentage ?? 0)
          : 0;
      const fileCount =
        quotaRes.status === "fulfilled"
          ? (quotaRes.value.data?.files?.used ?? 0)
          : 0;

      return { bucketCount, usedBytes, limitBytes, percentage, fileCount };
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

  const usedBytes = data?.usedBytes ?? 0;
  const limitBytes = data?.limitBytes ?? 0;
  const percentage = data?.percentage ?? 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-primary" />
          Stockage
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <HardDrive className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{formatBytes(usedBytes)}</p>
            <p className="text-xs text-muted-foreground">
              {limitBytes > 0
                ? `${Math.round(percentage)}% de ${formatBytes(limitBytes)}`
                : `${data?.fileCount ?? 0} fichier${(data?.fileCount ?? 0) !== 1 ? "s" : ""}`}
              {" · "}
              {data?.bucketCount ?? 0} bucket
              {(data?.bucketCount ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0 gap-1">
          <Link href="/drive">
            Ouvrir
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
