"use client";

import { useEffect, useState } from "react";
import { Activity, AlertCircle } from "lucide-react";

interface ServiceStatus {
  name: string;
  port: number;
  isHealthy: boolean;
  lastCheck: Date;
}

const SERVICES = [
  { name: "Identity", port: 3001 },
  { name: "Storage", port: 3004 },
  { name: "AI", port: 3005 },
  { name: "Docs", port: 3010 },
  { name: "Calendar", port: 3011 },
  { name: "Mail", port: 3012 },
  { name: "Scheduler", port: 3007 },
  { name: "Metrics", port: 3008 },
  { name: "Chat", port: 3020 },
];

export function HealthDashboard() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize services with stub data
  useEffect(() => {
    const initialServices: ServiceStatus[] = SERVICES.map((service) => ({
      ...service,
      isHealthy: Math.random() > 0.2, // 80% healthy by default
      lastCheck: new Date(),
    }));
    setServices(initialServices);
    setIsLoading(false);
  }, []);

  // Auto-refresh every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      setServices((prev) =>
        prev.map((service) => ({
          ...service,
          isHealthy: Math.random() > 0.1, // Simulate health check
          lastCheck: new Date(),
        }))
      );
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const healthyCount = services.filter((s) => s.isHealthy).length;

  if (isLoading) {
    return <div className="text-center text-gray-500">Loading services...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Services Health</h2>
        </div>
        <div className="text-sm text-gray-600">
          {healthyCount} of {services.length} services healthy
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <div
            key={service.port}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Service Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{service.name}</h3>
                <p className="text-sm text-gray-500">Port {service.port}</p>
              </div>

              {/* Status Dot */}
              <div
                className={`h-3 w-3 rounded-full ${
                  service.isHealthy
                    ? "bg-green-500 shadow-md shadow-green-500/50"
                    : "bg-red-500 shadow-md shadow-red-500/50"
                }`}
                title={service.isHealthy ? "Healthy" : "Unhealthy"}
              />
            </div>

            {/* Status Badge */}
            <div className="mt-3 flex items-center gap-2">
              {!service.isHealthy && (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <span
                className={`text-xs font-medium ${
                  service.isHealthy
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {service.isHealthy ? "Healthy" : "Unhealthy"}
              </span>
            </div>

            {/* Last Check Time */}
            <div className="mt-2 border-t border-gray-100 pt-2">
              <p className="text-xs text-gray-500">
                Last check: {formatTime(service.lastCheck)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
