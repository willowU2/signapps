"use client";

import { useState } from "react";

interface ServiceNode {
  id: string;
  name: string;
  status: "running" | "degraded" | "stopped";
  version: string;
  connections: string[];
}

interface Connection {
  from: string;
  to: string;
  latency: number;
}

const SAMPLE_SERVICES: ServiceNode[] = [
  { id: "api", name: "API Gateway", status: "running", version: "1.2.0", connections: ["auth", "data", "cache"] },
  { id: "auth", name: "Auth Service", status: "running", version: "1.1.5", connections: ["db"] },
  { id: "data", name: "Data Service", status: "running", version: "2.0.1", connections: ["db", "cache"] },
  { id: "cache", name: "Cache Layer", status: "degraded", version: "1.0.3", connections: [] },
  { id: "db", name: "Database", status: "running", version: "5.7", connections: [] },
];

const SAMPLE_CONNECTIONS: Connection[] = [
  { from: "api", to: "auth", latency: 12 },
  { from: "api", to: "data", latency: 25 },
  { from: "api", to: "cache", latency: 5 },
  { from: "auth", to: "db", latency: 8 },
  { from: "data", to: "db", latency: 15 },
  { from: "data", to: "cache", latency: 3 },
];

function getStatusColor(status: string) {
  switch (status) {
    case "running":
      return "bg-green-100 text-green-700 border-green-300";
    case "degraded":
      return "bg-amber-100 text-amber-700 border-amber-300";
    case "stopped":
      return "bg-red-100 text-red-700 border-red-300";
    default:
      return "bg-gray-100 text-gray-700 border-gray-300";
  }
}

function getLatencyColor(latency: number) {
  if (latency < 10) return "text-green-600";
  if (latency < 30) return "text-yellow-600";
  return "text-red-600";
}

export function ServiceMesh() {
  const [selectedService, setSelectedService] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Service Mesh</h2>
        <p className="text-gray-600">Monitor services and inter-service communication</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Graph */}
        <div className="lg:col-span-2 border rounded-lg p-6 bg-white">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Graph</h3>
          <div className="flex flex-wrap gap-4 items-center justify-center min-h-96 bg-gray-50 rounded p-4">
            {SAMPLE_SERVICES.map((service) => (
              <button
                key={service.id}
                onClick={() => setSelectedService(service.id)}
                className={`p-4 rounded-lg border-2 font-medium transition-all ${getStatusColor(service.status)} ${
                  selectedService === service.id ? "ring-2 ring-blue-500 ring-offset-2" : ""
                }`}
              >
                <div className="font-semibold text-sm">{service.name}</div>
                <div className="text-xs mt-1 opacity-75">v{service.version}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Connections & Details */}
        <div className="space-y-4">
          <div className="border rounded-lg p-4 bg-white">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Service Status</h3>
            <div className="space-y-2">
              {SAMPLE_SERVICES.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedService(service.id)}
                >
                  <span className="text-sm font-medium text-gray-900">{service.name}</span>
                  <div className={`w-3 h-3 rounded-full ${service.status === "running" ? "bg-green-500" : service.status === "degraded" ? "bg-amber-500" : "bg-red-500"}`} />
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-white">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Latency</h3>
            <div className="space-y-2 text-sm">
              {SAMPLE_CONNECTIONS.slice(0, 5).map((conn, idx) => {
                const fromService = SAMPLE_SERVICES.find((s) => s.id === conn.from);
                const toService = SAMPLE_SERVICES.find((s) => s.id === conn.to);
                return (
                  <div key={idx} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                    <span className="text-gray-700">
                      {fromService?.name} → {toService?.name}
                    </span>
                    <span className={`font-mono font-semibold ${getLatencyColor(conn.latency)}`}>
                      {conn.latency}ms
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Running</p>
          <p className="text-2xl font-bold text-green-600">
            {SAMPLE_SERVICES.filter((s) => s.status === "running").length}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Degraded</p>
          <p className="text-2xl font-bold text-amber-600">
            {SAMPLE_SERVICES.filter((s) => s.status === "degraded").length}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Stopped</p>
          <p className="text-2xl font-bold text-red-600">
            {SAMPLE_SERVICES.filter((s) => s.status === "stopped").length}
          </p>
        </div>
      </div>
    </div>
  );
}
