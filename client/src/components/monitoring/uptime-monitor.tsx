"use client";

import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ServiceStatus {
  name: string;
  status: "up" | "degraded" | "down";
  uptime30d: number;
  responseTime: number;
  lastChecked: string;
  history: number[];
}

export function UptimeMonitor() {
  const [services, setServices] = useState<ServiceStatus[]>([]);

  // Mock data initialization
  useEffect(() => {
    const mockServices: ServiceStatus[] = [
      {
        name: "API Gateway",
        status: "up",
        uptime30d: 99.95,
        responseTime: 45,
        lastChecked: new Date(Date.now() - 30000).toISOString(),
        history: [99.98, 99.95, 99.92, 99.98, 99.95],
      },
      {
        name: "Auth Service",
        status: "up",
        uptime30d: 99.87,
        responseTime: 78,
        lastChecked: new Date(Date.now() - 45000).toISOString(),
        history: [99.85, 99.87, 99.82, 99.87, 99.89],
      },
      {
        name: "Database",
        status: "up",
        uptime30d: 99.99,
        responseTime: 12,
        lastChecked: new Date(Date.now() - 15000).toISOString(),
        history: [99.99, 99.99, 99.98, 99.99, 99.99],
      },
      {
        name: "Email Service",
        status: "degraded",
        uptime30d: 98.45,
        responseTime: 245,
        lastChecked: new Date(Date.now() - 60000).toISOString(),
        history: [98.5, 98.45, 98.3, 98.45, 98.52],
      },
      {
        name: "Search Service",
        status: "up",
        uptime30d: 99.92,
        responseTime: 156,
        lastChecked: new Date(Date.now() - 25000).toISOString(),
        history: [99.90, 99.92, 99.88, 99.92, 99.94],
      },
      {
        name: "Cache Layer",
        status: "up",
        uptime30d: 99.98,
        responseTime: 5,
        lastChecked: new Date(Date.now() - 35000).toISOString(),
        history: [99.99, 99.98, 99.97, 99.98, 99.99],
      },
    ];
    setServices(mockServices);
  }, []);

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
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            Healthy
          </Badge>
        );
      case "degraded":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            Degraded
          </Badge>
        );
      case "down":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            Down
          </Badge>
        );
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

  const Sparkline = ({ data }: { data: number[] }) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const height = 30;

    return (
      <svg width="80" height={height} className="mx-auto">
        <polyline
          points={data
            .map(
              (val, idx) =>
                `${(idx / (data.length - 1)) * 80},${
                  height -
                  ((val - min) / range) * (height - 4) -
                  2
                }`
            )
            .join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-blue-400"
        />
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
      {services.map((service) => (
        <Card
          key={service.name}
          className="p-4 border border-gray-200 hover:shadow-lg transition"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{service.name}</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Last checked{" "}
                  {Math.round(
                    (Date.now() - new Date(service.lastChecked).getTime()) /
                      1000
                  )}
                  s ago
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

            <div className="bg-gray-50 rounded p-3">
              <p className="text-xs text-gray-600 mb-2">Response Time</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-xl font-bold ${getResponseTimeColor(service.responseTime)}`}>
                  {service.responseTime}
                </span>
                <span className="text-xs text-gray-500">ms</span>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-600 mb-2">History (30d)</p>
              <Sparkline data={service.history} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
