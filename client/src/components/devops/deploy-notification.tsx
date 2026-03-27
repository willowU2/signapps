"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, RotateCcw, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Deploy {
  id: string;
  serviceName: string;
  version: string;
  deployTime: Date;
  status: "success" | "failed" | "rollback";
  commitMessage: string;
  author: string;
}

const STORAGE_KEY = "signapps_deploys";

function loadDeploys(): Deploy[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((d: Deploy) => ({ ...d, deployTime: new Date(d.deployTime) }));
  } catch {
    return [];
  }
}

function saveDeploys(deploys: Deploy[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deploys));
}

export function DeployNotification() {
  const [deploys, setDeploys] = useState<Deploy[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setDeploys(loadDeploys());
    setIsLoading(false);
  }, []);

  const getStatusIcon = (status: Deploy["status"]) => {
    switch (status) {
      case "success": return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed": return <XCircle className="w-5 h-5 text-red-500" />;
      case "rollback": return <RotateCcw className="w-5 h-5 text-orange-500" />;
    }
  };

  const getStatusBadgeClass = (status: Deploy["status"]) => {
    switch (status) {
      case "success": return "bg-green-100 text-green-800";
      case "failed": return "bg-red-100 text-red-800";
      case "rollback": return "bg-orange-100 text-orange-800";
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

  const handleAddDeploy = () => {
    const serviceName = window.prompt("Service name:");
    if (!serviceName?.trim()) return;
    const version = window.prompt("Version (e.g. 1.0.0):", "1.0.0") || "1.0.0";
    const commitMessage = window.prompt("Commit message:", "feat: update") || "feat: update";
    const statusInput = window.prompt("Status (success/failed/rollback):", "success") || "success";
    const status = ["success", "failed", "rollback"].includes(statusInput)
      ? (statusInput as Deploy["status"])
      : "success";
    const newDeploy: Deploy = {
      id: crypto.randomUUID(),
      serviceName: serviceName.trim(),
      version,
      deployTime: new Date(),
      status,
      commitMessage,
      author: "You",
    };
    const updated = [newDeploy, ...deploys];
    setDeploys(updated);
    saveDeploys(updated);
    toast.success(`Deploy for ${serviceName} recorded`);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading deploys...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Recent Deployments</h2>
        </div>
        <Button size="sm" onClick={handleAddDeploy}>
          <Plus className="w-4 h-4 mr-2" />
          Record Deploy
        </Button>
      </div>

      {deploys.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No deployments recorded yet.</p>
        </div>
      ) : (
        deploys.map((deploy) => (
          <div key={deploy.id} className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-base">{deploy.serviceName}</h3>
                <p className="text-sm text-gray-500">{deploy.version}</p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(deploy.status)}
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(deploy.status)}`}>
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
        ))
      )}
    </div>
  );
}
