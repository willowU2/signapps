"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useDashboardData } from "@/hooks/use-dashboard";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function WidgetNetworkTraffic() {
  const { data: dashboardData } = useDashboardData();

  return (
    <div className="grid h-full gap-4 md:grid-cols-2">
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
            <ArrowUpRight className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Outbound Traffic</p>
            <p className="text-2xl font-bold">
              {formatBytes(dashboardData?.networkTx || 0)}
            </p>
            <p className="text-xs text-muted-foreground">Since boot</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
            <ArrowDownRight className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Inbound Traffic</p>
            <p className="text-2xl font-bold">
              {formatBytes(dashboardData?.networkRx || 0)}
            </p>
            <p className="text-xs text-muted-foreground">Since boot</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
