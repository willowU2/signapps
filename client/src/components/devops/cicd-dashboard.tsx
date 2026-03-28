"use client";

import { useEffect, useState } from "react";
import { GitBranch, Clock, Zap, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

interface PipelineCard {
  id: string;
  repoName: string;
  branch: string;
  status: "success" | "failed" | "running";
  duration: number;
  lastRunTime: Date;
}

const STORAGE_KEY = "signapps_pipelines";
const schedulerClient = getClient(ServiceName.SCHEDULER);

function loadPipelinesFromStorage(): PipelineCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((p: PipelineCard) => ({ ...p, lastRunTime: new Date(p.lastRunTime) }));
  } catch {
    return [];
  }
}

function savePipelinesToStorage(pipelines: PipelineCard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pipelines));
}

function mapPipelineFromApi(p: any): PipelineCard {
  return {
    id: p.id ?? crypto.randomUUID(),
    repoName: p.name ?? p.repo_name ?? p.repository ?? "",
    branch: p.branch ?? "main",
    status: (["success","failed","running"].includes(p.status) ? p.status : "running") as PipelineCard["status"],
    duration: p.duration_seconds ?? p.duration ?? 0,
    lastRunTime: new Date(p.last_run_at ?? p.created_at ?? Date.now()),
  };
}

const getStatusColor = (status: "success" | "failed" | "running"): string => {
  switch (status) {
    case "success": return "bg-green-500 shadow-green-500/50";
    case "failed": return "bg-red-500 shadow-red-500/50";
    case "running": return "bg-yellow-500 shadow-yellow-500/50";
  }
};

const getStatusText = (status: "success" | "failed" | "running"): string => {
  switch (status) {
    case "success": return "Success";
    case "failed": return "Failed";
    case "running": return "Running";
  }
};

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
};

const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

export function CICDDashboard() {
  const [pipelines, setPipelines] = useState<PipelineCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formRepo, setFormRepo] = useState("");
  const [formBranch, setFormBranch] = useState("main");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await schedulerClient.get<any[]>('/devops/pipelines');
        const loaded = (res.data ?? []).map(mapPipelineFromApi);
        setPipelines(loaded);
        savePipelinesToStorage(loaded);
      } catch {
        setPipelines(loadPipelinesFromStorage());
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPipelines((prev) => {
        const updated = prev.map((pipeline) =>
          pipeline.status === "running"
            ? { ...pipeline, duration: pipeline.duration + 1 }
            : pipeline
        );
        savePipelinesToStorage(updated);
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAddPipeline = async () => {
    if (!formRepo.trim()) return;
    const newPipeline: PipelineCard = {
      id: crypto.randomUUID(),
      repoName: formRepo.trim(),
      branch: formBranch || "main",
      status: "running",
      duration: 0,
      lastRunTime: new Date(),
    };
    const updated = [newPipeline, ...pipelines];
    setPipelines(updated);
    savePipelinesToStorage(updated);
    setShowForm(false);
    setFormRepo("");
    setFormBranch("main");
    toast.success(`Pipeline for ${formRepo} started`);
    try {
      await schedulerClient.post('/devops/pipelines', {
        name: newPipeline.repoName,
        branch: newPipeline.branch,
      });
    } catch {
      // localStorage already updated
    }
  };

  const handleMarkStatus = async (id: string, status: "success" | "failed") => {
    const updated = pipelines.map((p) =>
      p.id === id ? { ...p, status } : p
    );
    setPipelines(updated);
    savePipelinesToStorage(updated);
    try {
      await schedulerClient.put(`/devops/pipelines/${id}`, { status });
    } catch {
      // localStorage already updated
    }
  };

  if (isLoading) {
    return <div className="text-center text-gray-500">Loading pipelines...</div>;
  }

  const runningCount = pipelines.filter((p) => p.status === "running").length;
  const failedCount = pipelines.filter((p) => p.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">CI/CD Pipelines</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="space-x-4 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
              {runningCount} running
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500"></span>
              {failedCount} failed
            </span>
          </div>
          {showForm ? (
            <div className="flex gap-2">
              <Input value={formRepo} onChange={(e) => setFormRepo(e.target.value)} placeholder="Repository name" className="h-8 text-sm w-40" autoFocus />
              <Input value={formBranch} onChange={(e) => setFormBranch(e.target.value)} placeholder="branch" className="h-8 text-sm w-24" />
              <Button size="sm" onClick={handleAddPipeline}>Start</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Pipeline
            </Button>
          )}
        </div>
      </div>

      {pipelines.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No pipelines yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pipelines.map((pipeline) => (
            <div
              key={pipeline.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{pipeline.repoName}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                    <GitBranch className="h-3 w-3" />
                    {pipeline.branch}
                  </div>
                </div>
                <div
                  className={`h-3 w-3 rounded-full shadow-md ${getStatusColor(pipeline.status)}`}
                  title={getStatusText(pipeline.status)}
                />
              </div>

              <div
                className={`inline-block px-2 py-1 rounded text-xs font-medium mb-3 ${
                  pipeline.status === "success"
                    ? "bg-green-100 text-green-700"
                    : pipeline.status === "failed"
                    ? "bg-red-100 text-red-700"
                    : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {getStatusText(pipeline.status)}
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-2 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Duration: {formatDuration(pipeline.duration)}
                </div>
                <div className="text-xs text-gray-500">
                  Last run: {formatRelativeTime(pipeline.lastRunTime)}
                </div>
                {pipeline.status === "running" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleMarkStatus(pipeline.id, "success")}
                      className="text-xs text-green-600 hover:underline"
                    >
                      Mark success
                    </button>
                    <button
                      onClick={() => handleMarkStatus(pipeline.id, "failed")}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Mark failed
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
