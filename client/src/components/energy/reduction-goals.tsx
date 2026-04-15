"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Calendar, Plus } from "lucide-react";
import { useState } from "react";

interface Goal {
  id: string;
  name: string;
  targetPercent: number;
  currentPercent: number;
  deadline: string;
  trend: "up" | "down" | "stable";
}

interface ReductionGoalsProps {
  goals?: Goal[];
  onAddGoal?: (goal: Omit<Goal, "id">) => void;
}

export function ReductionGoals({
  goals = [
    {
      id: "1",
      name: "Efficacité Énergétique",
      targetPercent: 20,
      currentPercent: 12,
      deadline: "2024-12-31",
      trend: "down",
    },
    {
      id: "2",
      name: "Énergie Renouvelable",
      targetPercent: 30,
      currentPercent: 18,
      deadline: "2025-06-30",
      trend: "up",
    },
    {
      id: "3",
      name: "Réduction Déplacements",
      targetPercent: 15,
      currentPercent: 8,
      deadline: "2024-09-30",
      trend: "stable",
    },
  ],
  onAddGoal,
}: ReductionGoalsProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    targetPercent: 0,
    currentPercent: 0,
    deadline: "",
  });

  const handleAddGoal = () => {
    if (formData.name && formData.targetPercent) {
      onAddGoal?.({
        name: formData.name,
        targetPercent: formData.targetPercent,
        currentPercent: formData.currentPercent,
        deadline: formData.deadline,
        trend: "stable",
      });
      setFormData({
        name: "",
        targetPercent: 0,
        currentPercent: 0,
        deadline: "",
      });
      setShowForm(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-5 w-5 text-green-600" />;
      case "down":
        return <TrendingDown className="h-5 w-5 text-red-600" />;
      default:
        return <div className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case "up":
        return "Amélioration";
      case "down":
        return "À améliorer";
      default:
        return "Stable";
    }
  };

  const daysRemaining = (deadline: string) => {
    const end = new Date(deadline);
    const today = new Date();
    const days = Math.ceil(
      (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return days;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Objectifs de Réduction</h2>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gap-2"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Ajouter un Objectif
        </Button>
      </div>

      {/* Add Goal Form */}
      {showForm && (
        <Card className="border-blue-200 bg-blue-50 p-6">
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Nom de l'objectif"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full rounded border px-3 py-2"
            />
            <div className="grid gap-4 md:grid-cols-3">
              <input
                type="number"
                placeholder="Cible %"
                value={formData.targetPercent}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    targetPercent: Number(e.target.value),
                  })
                }
                className="rounded border px-3 py-2"
              />
              <input
                type="number"
                placeholder="Actuel %"
                value={formData.currentPercent}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    currentPercent: Number(e.target.value),
                  })
                }
                className="rounded border px-3 py-2"
              />
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) =>
                  setFormData({ ...formData, deadline: e.target.value })
                }
                className="rounded border px-3 py-2"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddGoal} className="flex-1">
                Créer
              </Button>
              <Button
                onClick={() => setShowForm(false)}
                variant="outline"
                className="flex-1"
              >
                Annuler
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Goals Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {goals.map((goal) => {
          const progress = (goal.currentPercent / goal.targetPercent) * 100;
          const days = daysRemaining(goal.deadline);

          return (
            <Card key={goal.id} className="p-5">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold">{goal.name}</h3>
                  <Badge
                    className={`gap-1 ${
                      goal.trend === "up"
                        ? "bg-green-100 text-green-800"
                        : goal.trend === "down"
                          ? "bg-red-100 text-red-800"
                          : "bg-muted text-gray-800"
                    }`}
                  >
                    {getTrendIcon(goal.trend)}
                    {getTrendLabel(goal.trend)}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progression</span>
                    <span className="font-bold">
                      {goal.currentPercent}% / {goal.targetPercent}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {days > 0 ? (
                    <span>{days} jours restants</span>
                  ) : (
                    <span className="font-semibold text-red-600">Dépassé</span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
