"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cpu, DollarSign, Zap, Clock } from "lucide-react";
import { getClient, ServiceName } from "@/lib/api/factory";

interface InferenceCost {
  model: string;
  total_requests: number;
  total_tokens: number;
  avg_latency_ms: number;
  estimated_cost: number;
}

interface CostSummary {
  models: InferenceCost[];
  total_cost: number;
  total_requests: number;
}

export function AiCostTracker() {
  const [data, setData] = useState<CostSummary>({
    models: [],
    total_cost: 0,
    total_requests: 0,
  });

  useEffect(() => {
    const client = getClient(ServiceName.AI);
    client
      .get<CostSummary>("/ai/costs")
      .then((res) => setData((prev) => res.data || prev))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-3 text-center">
            <Zap className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
            <p className="text-xl font-bold">{data.total_requests}</p>
            <p className="text-[10px] text-muted-foreground">Requêtes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 text-center">
            <Cpu className="h-5 w-5 mx-auto text-blue-500 mb-1" />
            <p className="text-xl font-bold">{data.models.length}</p>
            <p className="text-[10px] text-muted-foreground">Modèles</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <p className="text-xl font-bold">
              {data.total_cost === 0
                ? "Gratuit"
                : `$${data.total_cost.toFixed(2)}`}
            </p>
            <p className="text-[10px] text-muted-foreground">Coût estimé</p>
          </CardContent>
        </Card>
      </div>

      {data.models.length > 0 && (
        <div className="space-y-2">
          {data.models.map((m) => (
            <div
              key={m.model}
              className="flex items-center gap-3 p-2 rounded-lg border text-sm"
            >
              <Badge variant="secondary" className="font-mono text-xs">
                {m.model}
              </Badge>
              <span className="text-muted-foreground">
                {m.total_requests} req
              </span>
              <span className="text-muted-foreground">
                {(m.total_tokens / 1000).toFixed(0)}K tokens
              </span>
              <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                {m.avg_latency_ms}ms
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
