"use client";

import { useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import { storageApi } from "@/lib/api/storage";

interface QuotaInfo {
  used: number;
  total: number;
  byType: { type: string; size: number; count: number }[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 o";
  const k = 1024;
  const sizes = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const TYPE_COLORS: Record<string, string> = {
  document: "bg-blue-500",
  image: "bg-green-500",
  video: "bg-purple-500",
  audio: "bg-yellow-500",
  archive: "bg-orange-500",
  other: "bg-gray-400",
};

export function StorageQuota() {
  const [quota, setQuota] = useState<QuotaInfo>({
    used: 0,
    total: 5 * 1024 * 1024 * 1024,
    byType: [],
  });

  useEffect(() => {
    storageApi
      .getQuota?.()
      .then((res: { data: QuotaInfo }) => setQuota(res.data))
      .catch(() => {
        // Fallback: estimate from files
      });
  }, []);

  const pct =
    quota.total > 0 ? Math.min(100, (quota.used / quota.total) * 100) : 0;
  const pctColor =
    pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-primary";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Stockage</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatBytes(quota.used)} utilisés</span>
          <span>{formatBytes(quota.total)}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full ${pctColor} transition-all duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {formatBytes(quota.total - quota.used)} disponible
        </p>
      </div>

      {quota.byType.length > 0 && (
        <div className="space-y-1 pt-1">
          {quota.byType.map((t) => (
            <div key={t.type} className="flex items-center gap-2 text-xs">
              <div
                className={`h-2 w-2 rounded-full ${TYPE_COLORS[t.type] || TYPE_COLORS.other}`}
              />
              <span className="flex-1 capitalize">{t.type}</span>
              <span className="text-muted-foreground">
                {formatBytes(t.size)}
              </span>
              <span className="text-muted-foreground">({t.count})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
