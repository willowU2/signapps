"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, RotateCcw, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

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
const schedulerClient = getClient(ServiceName.SCHEDULER);

function loadDeploysFromStorage(): Deploy[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((d: Deploy) => ({ ...d, deployTime: new Date(d.deployTime) }));
  } catch {
    return [];
  }
}

function saveDeploysToStorage(deploys: Deploy[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deploys));
}

function mapDeployFromApi(d: any): Deploy {
  return {
    id: d.id ?? crypto.randomUUID(),
    serviceName: d.service_name ?? d.service ?? "",
    version: d.version ?? "1.0.0",
    deployTime: new Date(d.deployed_at ?? d.created_at ?? Date.now()),
    status: (["success","failed","rollback"].includes(d.status) ? d.status : "success") as Deploy["status"],
    commitMessage: d.commit_message ?? d.message ?? "",
    author: d.author ?? d.deployed_by ?? "Unknown",
  };
}

export function DeployNotification() {
  const [deploys, setDeploys] = useState<Deploy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formService, setFormService] = useState("");
  const [formVersion, setFormVersion] = useState("1.0.0");
  const [formMessage, setFormMessage] = useState("feat: update");
  const [formStatus, setFormStatus] = useState<Deploy["status"]>("success");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await schedulerClient.get<any[]>('/devops/deployments');
        const loaded = (res.data ?? []).map(mapDeployFromApi);
        setDeploys(loaded);
        saveDeploysToStorage(loaded);
      } catch {
        setDeploys(loadDeploysFromStorage());
      } finally {
        setIsLoading(false);
      }
    };
    load();
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

  const handleAddDeploy = async () => {
    if (!formService.trim()) return;
    const newDeploy: Deploy = {
      id: crypto.randomUUID(),
      serviceName: formService.trim(),
      version: formVersion || "1.0.0",
      deployTime: new Date(),
      status: formStatus,
      commitMessage: formMessage || "feat: update",
      author: "You",
    };
    const updated = [newDeploy, ...deploys];
    setDeploys(updated);
    saveDeploysToStorage(updated);
    setShowForm(false);
    setFormService("");
    toast.success(`Deploy for ${formService} recorded`);
    try {
      await schedulerClient.post('/devops/deployments', {
        service_name: newDeploy.serviceName,
        version: newDeploy.version,
        status: newDeploy.status,
        commit_message: newDeploy.commitMessage,
      });
    } catch {
      // localStorage already updated
    }
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
        {showForm ? (
          <div className="flex gap-2 flex-wrap">
            <Input value={formService} onChange={(e) => setFormService(e.target.value)} placeholder="Service name" className="h-8 text-sm w-36" autoFocus />
            <Input value={formVersion} onChange={(e) => setFormVersion(e.target.value)} placeholder="1.0.0" className="h-8 text-sm w-20" />
            <Input value={formMessage} onChange={(e) => setFormMessage(e.target.value)} placeholder="Commit message" className="h-8 text-sm w-40" />
            <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as Deploy["status"])} className="border rounded px-2 h-8 text-sm">
              {(["success","failed","rollback"] as const).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Button size="sm" onClick={handleAddDeploy}>Enregistrer</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Record Deploy
          </Button>
        )}
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
