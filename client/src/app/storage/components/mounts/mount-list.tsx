"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, HardDrive, Network } from "lucide-react";
import type { MountPoint } from "@/lib/api";

interface MountListProps {
  mounts: MountPoint[];
  loading?: boolean;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function MountList({ mounts, loading }: MountListProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Points de montage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Points de montage ({mounts.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {mounts.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <FolderOpen className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>Aucun point de montage détecté</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mounts.map((mount, index) => (
              <div key={index} className="rounded-lg border p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {mount.is_network ? (
                      <Network className="h-5 w-5 text-blue-500" />
                    ) : mount.is_removable ? (
                      <HardDrive className="h-5 w-5 text-orange-500" />
                    ) : (
                      <FolderOpen className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">{mount.mount_point}</p>
                      <p className="text-sm text-muted-foreground">
                        {mount.device}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{mount.file_system}</Badge>
                    {mount.is_removable && (
                      <Badge variant="outline">Amovible</Badge>
                    )}
                    {mount.is_network && (
                      <Badge variant="outline">Réseau</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">
                      {formatBytes(mount.used_bytes)} utilisé sur{" "}
                      {formatBytes(mount.total_bytes)}
                    </span>
                    <span
                      className={
                        (mount.usage_percent ?? 0) > 90 ? "text-red-500" : ""
                      }
                    >
                      {(mount.usage_percent ?? 0).toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    value={mount.usage_percent ?? 0}
                    className={`h-2 ${(mount.usage_percent ?? 0) > 90 ? "bg-red-100" : ""}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
