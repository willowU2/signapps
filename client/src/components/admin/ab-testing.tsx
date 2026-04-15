"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

interface Experiment {
  id: string;
  name: string;
  variants: {
    name: string;
    percentage: number;
    conversions: number;
  }[];
  status: "running" | "completed";
  winner?: string;
  startDate: Date;
  endDate?: Date;
}

const STORAGE_KEY = "signapps_ab_experiments";
const metricsClient = getClient(ServiceName.METRICS);

function loadExperimentsFromStorage(): Experiment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((e: Experiment) => ({
      ...e,
      startDate: new Date(e.startDate),
      endDate: e.endDate ? new Date(e.endDate) : undefined,
    }));
  } catch {
    return [];
  }
}

function saveExperimentsToStorage(experiments: Experiment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(experiments));
}

function mapExperimentFromApi(e: any): Experiment {
  return {
    id: e.id,
    name: e.name,
    variants: (e.variants ?? []).map((v: any) => ({
      name: v.name,
      percentage: v.traffic_percentage ?? v.percentage ?? 50,
      conversions: v.conversions ?? 0,
    })),
    status: e.status === "active" ? "running" : (e.status ?? "running"),
    winner: e.winner_variant,
    startDate: new Date(e.created_at ?? e.start_date ?? Date.now()),
    endDate: e.ended_at ? new Date(e.ended_at) : undefined,
  };
}

const getStatusBadge = (status: "running" | "completed"): string => {
  return status === "running"
    ? "bg-blue-100 text-blue-700"
    : "bg-green-100 text-green-700";
};

const getStatusText = (status: "running" | "completed"): string => {
  return status === "running" ? "Running" : "Completed";
};

const getWinnerPercentage = (
  variants: Experiment["variants"],
  winner?: string,
): { [key: string]: number } => {
  if (!winner) return {};

  const winnerVariant = variants.find((v) => v.name === winner);
  if (!winnerVariant) return {};

  const totalConversions = variants.reduce((sum, v) => sum + v.conversions, 0);
  const winnerConversions = winnerVariant.conversions;

  return {
    improvement:
      ((winnerConversions - totalConversions / variants.length) /
        (totalConversions / variants.length)) *
      100,
  };
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function ABTesting() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await metricsClient.get<any[]>("/experiments");
        const loaded = (res.data ?? []).map(mapExperimentFromApi);
        setExperiments(loaded);
        saveExperimentsToStorage(loaded);
      } catch {
        setExperiments(loadExperimentsFromStorage());
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleNewExperiment = async () => {
    const name = newName.trim() || `Experiment ${experiments.length + 1}`;
    const exp: Experiment = {
      id: crypto.randomUUID(),
      name,
      variants: [
        { name: "Control (A)", percentage: 50, conversions: 0 },
        { name: "Variant (B)", percentage: 50, conversions: 0 },
      ],
      status: "running",
      startDate: new Date(),
    };
    const updated = [exp, ...experiments];
    setExperiments(updated);
    saveExperimentsToStorage(updated);
    setNewName("");
    setShowForm(false);
    toast.success(`Experiment "${exp.name}" created`);
    try {
      await metricsClient.post("/experiments", {
        name: exp.name,
        variants: exp.variants.map((v) => ({
          name: v.name,
          traffic_percentage: v.percentage,
        })),
      });
    } catch {
      // localStorage has it
    }
  };

  if (isLoading) {
    return (
      <div className="text-center text-muted-foreground">Chargement...</div>
    );
  }

  const runningCount = experiments.filter((e) => e.status === "running").length;
  const completedCount = experiments.filter(
    (e) => e.status === "completed",
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">A/B Testing</h2>
        </div>
        <div className="space-x-6 text-sm text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">
              {runningCount}
            </span>{" "}
            running
          </span>
          <span>
            <span className="font-semibold text-foreground">
              {completedCount}
            </span>{" "}
            completed
          </span>
        </div>
        {showForm ? (
          <div className="flex gap-2">
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="Experiment name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNewExperiment()}
              autoFocus
            />
            <Button
              onClick={handleNewExperiment}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              Créer
            </Button>
            <Button
              onClick={() => {
                setShowForm(false);
                setNewName("");
              }}
              size="sm"
              variant="ghost"
            >
              Annuler
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Experiment
          </Button>
        )}
      </div>

      {/* Experiments List */}
      <div className="space-y-4">
        {experiments.map((experiment) => (
          <div
            key={experiment.id}
            className="rounded-lg border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {experiment.name}
                </h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDate(experiment.startDate)}
                    {experiment.endDate &&
                      ` - ${formatDate(experiment.endDate)}`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                    experiment.status,
                  )}`}
                >
                  {getStatusText(experiment.status)}
                </span>

                {experiment.winner && (
                  <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                    ✓ Winner: {experiment.winner}
                  </span>
                )}
              </div>
            </div>

            {/* Variants */}
            <div className="space-y-3">
              {experiment.variants.map((variant, idx) => {
                const totalConversions = experiment.variants.reduce(
                  (sum, v) => sum + v.conversions,
                  0,
                );
                const conversionRate = (
                  (variant.conversions / totalConversions) *
                  100
                ).toFixed(1);

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">
                        {variant.name}
                      </span>
                      <span className="text-muted-foreground">
                        {variant.conversions.toLocaleString()} conversions
                        {experiment.winner === variant.name && (
                          <span className="ml-2 text-yellow-600 font-semibold">
                            🏆
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            experiment.winner === variant.name
                              ? "bg-yellow-500"
                              : "bg-blue-500"
                          }`}
                          style={{ width: `${conversionRate}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {variant.percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
