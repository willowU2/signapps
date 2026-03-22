"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, RotateCcw, Clock } from "lucide-react";

interface Deploy {
  id: string;
  serviceName: string;
  version: string;
  deployTime: Date;
  status: "success" | "failed" | "rollback";
  commitMessage: string;
  author: string;
}

export function DeployNotification() {
  const [deploys, setDeploys] = useState<Deploy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize with mock data
    const mockDeploys: Deploy[] = [
      {
        id: "1",
        serviceName: "Identity Service",
        version: "2.4.1",
        deployTime: new Date(Date.now() - 5 * 60000),
        status: "success",
        commitMessage: "feat: Add OAuth2 provider support",
        author: "Alice Chen",
      },
      {
        id: "2",
        serviceName: "Storage Service",
        version: "1.8.0",
        deployTime: new Date(Date.now() - 25 * 60000),
        status: "success",
        commitMessage: "fix: Improve S3 compatibility layer",
        author: "Bob Martinez",
      },
      {
        id: "3",
        serviceName: "AI Service",
        version: "3.1.2",
        deployTime: new Date(Date.now() - 2 * 3600000),
        status: "rollback",
        commitMessage: "perf: Optimize model inference pipeline",
        author: "Carol Zhang",
      },
      {
        id: "4",
        serviceName: "Calendar Service",
        version: "1.2.5",
        deployTime: new Date(Date.now() - 6 * 3600000),
        status: "failed",
        commitMessage: "chore: Update dependencies",
        author: "David Lee",
      },
      {
        id: "5",
        serviceName: "Chat Service",
        version: "4.0.3",
        deployTime: new Date(Date.now() - 24 * 3600000),
        status: "success",
        commitMessage: "feat: Real-time message encryption",
        author: "Eve Johnson",
      },
    ];
    setDeploys(mockDeploys);
    setIsLoading(false);
  }, []);

  const getStatusIcon = (status: Deploy["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "rollback":
        return <RotateCcw className="w-5 h-5 text-orange-500" />;
    }
  };

  const getStatusBadgeClass = (status: Deploy["status"]) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "rollback":
        return "bg-orange-100 text-orange-800";
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading deploys...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="w-5 h-5" />
        <h2 className="text-lg font-semibold">Recent Deployments</h2>
      </div>

      {deploys.map((deploy) => (
        <div
          key={deploy.id}
          className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-base">{deploy.serviceName}</h3>
              <p className="text-sm text-gray-500">{deploy.version}</p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(deploy.status)}
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
                  deploy.status
                )}`}
              >
                {deploy.status.charAt(0).toUpperCase() + deploy.status.slice(1)}
              </span>
            </div>
          </div>

          <div className="mb-3 pb-3 border-b border-gray-200">
            <p className="text-sm text-gray-700">{deploy.commitMessage}</p>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{deploy.author}</span>
            <span>{formatTime(deploy.deployTime)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
