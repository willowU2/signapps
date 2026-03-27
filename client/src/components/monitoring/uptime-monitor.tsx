"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { metricsApi } from "@/lib/api";

interface ServiceStatus {
  name: string;
  status: "up" | "degraded" | "down";
  uptime30d: number;
  responseTime: number;
  lastChecked: string;
  history: number[];
}

const SERVICES = [
  { name: "Metrics Service", endpoint: metricsApi.health },
];

export function UptimeMonitor() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkServices = useCallback(async () => {
    setIsRefreshing(true);
    const results: ServiceStatus[] = [];

    for (const svc of SERVICES) {
      const start = Date.now();
      try {
        await svc.endpoint();
        const responseTime = Date.now() - start;
        const status: "up" | "degraded" | "down" =
          responseTime > 1000 ? "degraded" : "up";
        results.push({
          name: svc.name,
          status,
          uptime30d: 100,
          responseTime,
          lastChecked: new Date().toISOString(),
          history: [100],
        });
      } catch {
        results.push({
          name: svc.name,
          status: "down",
          uptime30d: 0,
          responseTime: 0,
          lastChecked: new Date().toISOString(),
          history: [0],
        });
      }
    }

    setServices(results);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    checkServices();
    const interval = setInterval(checkServices, 60000);
    return () => clearInterval(interval);
  }, [checkServices]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "up":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "degraded":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "down":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "up":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Healthy</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Degraded</Badge>;
      case "down":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Down</Badge>;
      default:
        return null;
    }
  };

  const getResponseTimeColor = (ms: number) => {
    if (ms < 50) return "text-green-600";
    if (ms < 150) return "text-blue-600";
    if (ms < 300) return "text-yellow-600";
    return "text-red-600";
  };

  if (services.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={checkServices} disabled={isRefreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <Card key={service.name} className="p-4 border border-gray-200 hover:shadow-lg transition">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{service.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Last checked{" "}
                    {Math.round((Date.now() - new Date(service.lastChecked).getTime()) / 1000)}s ago
                  </p>
                </div>
                {getStatusIcon(service.status)}
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-xs text-gray-600">Uptime (30d)</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {service.uptime30d.toFixed(2)}%
                  </p>
                </div>
                {getStatusBadge(service.status)}
              </div>

              {service.responseTime > 0 && (
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-xs text-gray-600 mb-2">Response Time</p>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-xl font-bold ${getResponseTimeColor(service.responseTime)}`}>
                      {service.responseTime}
                    </span>
                    <span className="text-xs text-gray-500">ms</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
