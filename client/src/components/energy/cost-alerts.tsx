"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, CheckCircle } from "lucide-react";
import { useState } from "react";

interface Alert {
  id: string;
  label: string;
  threshold: number;
  current: number;
  unit: string;
}

interface CostAlertsProps {
  alerts?: Alert[];
  onThresholdChange?: (alertId: string, newThreshold: number) => void;
}

export function CostAlerts({
  alerts = [
    { id: "1", label: "Électricité", threshold: 500, current: 450, unit: "€" },
    { id: "2", label: "Gaz", threshold: 200, current: 210, unit: "€" },
    { id: "3", label: "Eau", threshold: 100, current: 85, unit: "€" },
  ],
  onThresholdChange,
}: CostAlertsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  const getStatus = (current: number, threshold: number) => {
    const percentage = (current / threshold) * 100;
    if (percentage >= 100) return "critical";
    if (percentage >= 80) return "warning";
    return "ok";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical":
        return "bg-red-100 text-red-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-green-100 text-green-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "critical":
        return <AlertCircle className="h-4 w-4" />;
      case "warning":
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const handleEditThreshold = (alertId: string, current: number) => {
    setEditingId(alertId);
    setEditValue(current);
  };

  const handleSaveThreshold = (alertId: string) => {
    onThresholdChange?.(alertId, editValue);
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Alertes Coûts</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {alerts.map((alert) => {
          const status = getStatus(alert.current, alert.threshold);
          const percentage = Math.round((alert.current / alert.threshold) * 100);

          return (
            <Card key={alert.id} className="p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{alert.label}</h3>
                  <Badge className={`gap-1 ${getStatusColor(status)}`}>
                    {getStatusIcon(status)}
                    {status === "critical"
                      ? "Critique"
                      : status === "warning"
                        ? "Alerte"
                        : "OK"}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Consommation</span>
                    <span className="font-bold">
                      {alert.current} {alert.unit}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        status === "critical"
                          ? "bg-red-500"
                          : status === "warning"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>

                {editingId === alert.id ? (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(Number(e.target.value))}
                      className="flex-1 rounded border px-2 py-1 text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSaveThreshold(alert.id)}
                    >
                      Enregistrer
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Seuil: {alert.threshold} {alert.unit}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        handleEditThreshold(alert.id, alert.threshold)
                      }
                    >
                      Modifier
                    </Button>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  {percentage}% du seuil
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
