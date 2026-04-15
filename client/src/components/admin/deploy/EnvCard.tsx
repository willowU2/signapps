"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EnvStatus, EnvHealth } from "@/lib/api/deploy";

interface Props {
  status: EnvStatus;
  health: EnvHealth | null;
  onDeploy: () => void;
  onRollback: () => void;
  onToggleMaintenance: (enable: boolean) => void;
}

/**
 * Card showing one environment's current version, health, and action buttons.
 */
export function EnvCard({
  status,
  health,
  onDeploy,
  onRollback,
  onToggleMaintenance,
}: Props) {
  const healthy =
    health !== null && health.total > 0 && health.healthy === health.total;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg capitalize">{status.env}</CardTitle>
        {health && (
          <Badge variant={healthy ? "default" : "destructive"}>
            {health.healthy}/{health.total} healthy
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Version actuelle</p>
          <p className="font-mono">{status.current_version ?? "—"}</p>
        </div>
        {status.deployed_at && (
          <div>
            <p className="text-sm text-muted-foreground">Déployée le</p>
            <p className="text-sm">
              {new Date(status.deployed_at).toLocaleString()}
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" onClick={onDeploy}>
            Déployer…
          </Button>
          <Button size="sm" variant="outline" onClick={onRollback}>
            Rollback
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggleMaintenance(true)}
          >
            Maintenance ON
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggleMaintenance(false)}
          >
            Maintenance OFF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
