"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

interface UpstreamServer {
  id: string;
  host: string;
  port: number;
  weight: number;
  healthStatus: "healthy" | "degraded" | "down";
  responseTime: number;
}

const SAMPLE_SERVERS: UpstreamServer[] = [
  { id: "s1", host: "worker-1.local", port: 8080, weight: 100, healthStatus: "healthy", responseTime: 45 },
  { id: "s2", host: "worker-2.local", port: 8080, weight: 80, healthStatus: "healthy", responseTime: 62 },
  { id: "s3", host: "worker-3.local", port: 8080, weight: 60, healthStatus: "degraded", responseTime: 180 },
  { id: "s4", host: "worker-4.local", port: 8080, weight: 0, healthStatus: "down", responseTime: 0 },
];

function getHealthColor(status: string) {
  switch (status) {
    case "healthy":
      return "bg-green-100 text-green-700";
    case "degraded":
      return "bg-amber-100 text-amber-700";
    case "down":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function LoadBalancer() {
  const [servers, setServers] = useState<UpstreamServer[]>(SAMPLE_SERVERS);

  const updateWeight = (id: string, newWeight: number) => {
    setServers(
      servers.map((s) =>
        s.id === id ? { ...s, weight: Math.max(0, Math.min(100, newWeight)) } : s
      )
    );
  };

  const totalWeight = servers.reduce((sum, s) => sum + s.weight, 0);
  const healthyCount = servers.filter((s) => s.healthStatus === "healthy").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Load Balancer</h2>
          <p className="text-gray-600">Manage upstream servers and load distribution</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Server
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Servers</p>
          <p className="text-2xl font-bold text-blue-600">{servers.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Healthy</p>
          <p className="text-2xl font-bold text-green-600">{healthyCount}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Weight</p>
          <p className="text-2xl font-bold text-purple-600">{totalWeight}</p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Host</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Port</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-900">Health</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-900">Response Time</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Weight</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {servers.map((server) => (
                <tr key={server.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-900">{server.host}</td>
                  <td className="px-4 py-3 text-gray-700">{server.port}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${getHealthColor(server.healthStatus)}`}>
                      {server.healthStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-gray-900">{server.responseTime}ms</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={server.weight}
                        onChange={(e) => updateWeight(server.id, parseInt(e.target.value))}
                        className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="w-10 text-right font-semibold text-gray-900">{server.weight}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button className="p-1 hover:bg-red-100 rounded text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900 font-medium">
          Weight Distribution: Adjust weights to control traffic routing. Servers with weight 0 are excluded from load balancing.
        </p>
      </div>
    </div>
  );
}
