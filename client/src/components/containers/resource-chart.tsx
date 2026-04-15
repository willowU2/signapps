"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, MemoryStick, HardDrive } from "lucide-react";

interface ResourceData {
  name: string;
  cpu_pct: number;
  mem_mb: number;
  mem_limit_mb: number;
  disk_mb: number;
}

function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full ${color} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ContainerResourceChart({
  containers,
}: {
  containers: ResourceData[];
}) {
  return (
    <div className="space-y-3">
      {containers.map((c) => (
        <Card key={c.name} className="p-3">
          <p className="font-medium text-sm mb-2">{c.name}</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <Cpu className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="w-10">CPU</span>
              <ProgressBar value={c.cpu_pct} max={100} color="bg-blue-500" />
              <span className="w-12 text-right text-muted-foreground">
                {c.cpu_pct.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <MemoryStick className="h-3.5 w-3.5 text-purple-500 shrink-0" />
              <span className="w-10">RAM</span>
              <ProgressBar
                value={c.mem_mb}
                max={c.mem_limit_mb}
                color="bg-purple-500"
              />
              <span className="w-12 text-right text-muted-foreground">
                {c.mem_mb}M
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <HardDrive className="h-3.5 w-3.5 text-orange-500 shrink-0" />
              <span className="w-10">Disk</span>
              <ProgressBar value={c.disk_mb} max={1024} color="bg-orange-500" />
              <span className="w-12 text-right text-muted-foreground">
                {c.disk_mb}M
              </span>
            </div>
          </div>
        </Card>
      ))}
      {containers.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aucun container actif
        </p>
      )}
    </div>
  );
}
