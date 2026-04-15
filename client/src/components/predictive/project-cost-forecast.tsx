import React from "react";
import { AlertTriangle, Briefcase } from "lucide-react";

interface Project {
  id: string;
  name: string;
  plannedBudget: number;
  predictedCost: number;
  spent: number;
  confidence: number;
  status: "on-track" | "warning" | "overrun";
}

export const ProjectCostForecast: React.FC = () => {
  const projects: Project[] = [
    {
      id: "1",
      name: "Website Redesign",
      plannedBudget: 50000,
      predictedCost: 48000,
      spent: 32000,
      confidence: 92,
      status: "on-track",
    },
    {
      id: "2",
      name: "API Integration",
      plannedBudget: 75000,
      predictedCost: 78000,
      spent: 52000,
      confidence: 85,
      status: "warning",
    },
    {
      id: "3",
      name: "Mobile App Dev",
      plannedBudget: 120000,
      predictedCost: 138000,
      spent: 95000,
      confidence: 88,
      status: "overrun",
    },
    {
      id: "4",
      name: "Data Migration",
      plannedBudget: 40000,
      predictedCost: 41500,
      spent: 28500,
      confidence: 90,
      status: "on-track",
    },
  ];

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "on-track":
        return "bg-green-100 text-green-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      case "overrun":
        return "bg-red-100 text-red-800";
      default:
        return "bg-muted text-gray-800";
    }
  };

  const getStatusBadge = (status: string): string => {
    switch (status) {
      case "on-track":
        return "bg-green-500 text-white";
      case "warning":
        return "bg-yellow-500 text-white";
      case "overrun":
        return "bg-red-600 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const totalPlanned = projects.reduce((sum, p) => sum + p.plannedBudget, 0);
  const totalPredicted = projects.reduce((sum, p) => sum + p.predictedCost, 0);
  const totalSpent = projects.reduce((sum, p) => sum + p.spent, 0);
  const overrunProjects = projects.filter((p) => p.status === "overrun");

  return (
    <div className="p-6 bg-card rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Briefcase className="w-5 h-5 text-purple-500" />
        Project Cost Forecast
      </h2>

      {overrunProjects.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-900">Budget Alert</p>
            <p className="text-xs text-red-700">
              {overrunProjects.length} project(s) have cost overrun risk
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3">
        {projects.map((project) => {
          const variance = project.predictedCost - project.plannedBudget;
          const variancePercent = (
            (variance / project.plannedBudget) *
            100
          ).toFixed(1);
          const maxBudget = Math.max(
            project.plannedBudget,
            project.predictedCost,
          );

          return (
            <div
              key={project.id}
              className={`p-4 border rounded-lg ${getStatusColor(project.status)}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-foreground">
                    {project.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Confidence: {project.confidence}%
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${getStatusBadge(project.status)}`}
                >
                  {project.status.replace("-", " ").toUpperCase()}
                </span>
              </div>

              <div className="relative mb-3">
                <div className="flex gap-1 h-6">
                  <div className="flex-1 bg-gray-200 rounded-l overflow-hidden relative">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${(project.spent / maxBudget) * 100}%` }}
                    />
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-r overflow-hidden relative">
                    <div
                      className="h-full bg-orange-500"
                      style={{
                        width: `${((project.predictedCost - project.spent) / maxBudget) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Spent</p>
                  <p className="font-bold text-foreground">
                    ${(project.spent / 1000).toFixed(0)}k
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Planned</p>
                  <p className="font-bold text-foreground">
                    ${(project.plannedBudget / 1000).toFixed(0)}k
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Predicted</p>
                  <p
                    className={`font-bold ${variance > 0 ? "text-red-600" : "text-green-600"}`}
                  >
                    ${(project.predictedCost / 1000).toFixed(0)}k
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Variance</p>
                  <p
                    className={`font-bold ${variance > 0 ? "text-red-600" : "text-green-600"}`}
                  >
                    {variance > 0 ? "+" : ""}
                    {variancePercent}%
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-muted-foreground">Total Planned</p>
            <p className="text-lg font-bold text-blue-600">
              ${(totalPlanned / 1000).toFixed(0)}k
            </p>
          </div>
          <div className="p-3 bg-orange-50 rounded-lg">
            <p className="text-xs text-muted-foreground">Total Predicted</p>
            <p className="text-lg font-bold text-orange-600">
              ${(totalPredicted / 1000).toFixed(0)}k
            </p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <p className="text-xs text-muted-foreground">Total Spent</p>
            <p className="text-lg font-bold text-purple-600">
              ${(totalSpent / 1000).toFixed(0)}k
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
