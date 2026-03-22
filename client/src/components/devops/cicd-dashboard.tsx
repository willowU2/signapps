"use client";

import { useEffect, useState } from "react";
import { GitBranch, Clock, Zap } from "lucide-react";

interface PipelineCard {
  id: string;
  repoName: string;
  branch: string;
  status: "success" | "failed" | "running";
  duration: number; // in seconds
  lastRunTime: Date;
}

const MOCK_PIPELINES: PipelineCard[] = [
  {
    id: "1",
    repoName: "signapps-platform",
    branch: "main",
    status: "success",
    duration: 145,
    lastRunTime: new Date(Date.now() - 3600000),
  },
  {
    id: "2",
    repoName: "signapps-platform",
    branch: "develop",
    status: "running",
    duration: 67,
    lastRunTime: new Date(Date.now() - 600000),
  },
  {
    id: "3",
    repoName: "ai-service",
    branch: "feature/nlp",
    status: "failed",
    duration: 89,
    lastRunTime: new Date(Date.now() - 1800000),
  },
  {
    id: "4",
    repoName: "identity-service",
    branch: "main",
    status: "success",
    duration: 123,
    lastRunTime: new Date(Date.now() - 7200000),
  },
  {
    id: "5",
    repoName: "storage-service",
    branch: "refactor/db",
    status: "success",
    duration: 156,
    lastRunTime: new Date(Date.now() - 10800000),
  },
  {
    id: "6",
    repoName: "scheduler-service",
    branch: "main",
    status: "running",
    duration: 45,
    lastRunTime: new Date(Date.now() - 300000),
  },
];

const getStatusColor = (
  status: "success" | "failed" | "running"
): string => {
  switch (status) {
    case "success":
      return "bg-green-500 shadow-green-500/50";
    case "failed":
      return "bg-red-500 shadow-red-500/50";
    case "running":
      return "bg-yellow-500 shadow-yellow-500/50";
  }
};

const getStatusText = (status: "success" | "failed" | "running"): string => {
  switch (status) {
    case "success":
      return "Success";
    case "failed":
      return "Failed";
    case "running":
      return "Running";
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

  useEffect(() => {
    setPipelines(MOCK_PIPELINES);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPipelines((prev) =>
        prev.map((pipeline) => {
          if (pipeline.status === "running") {
            return {
              ...pipeline,
              duration: pipeline.duration + 1,
            };
          }
          return pipeline;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return <div className="text-center text-gray-500">Loading pipelines...</div>;
  }

  const runningCount = pipelines.filter((p) => p.status === "running").length;
  const failedCount = pipelines.filter((p) => p.status === "failed").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">CI/CD Pipelines</h2>
        </div>
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
      </div>

      {/* Pipeline Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pipelines.map((pipeline) => (
          <div
            key={pipeline.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Header with status dot */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">
                  {pipeline.repoName}
                </h3>
                <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                  <GitBranch className="h-3 w-3" />
                  {pipeline.branch}
                </div>
              </div>
              <div
                className={`h-3 w-3 rounded-full shadow-md ${getStatusColor(
                  pipeline.status
                )}`}
                title={getStatusText(pipeline.status)}
              />
            </div>

            {/* Status Badge */}
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

            {/* Duration and Last Run */}
            <div className="border-t border-gray-100 pt-3 space-y-2 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Duration: {formatDuration(pipeline.duration)}
              </div>
              <div className="text-xs text-gray-500">
                Last run: {formatRelativeTime(pipeline.lastRunTime)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
