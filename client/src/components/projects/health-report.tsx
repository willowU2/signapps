"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, XCircle, Plus } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type RAGStatus = "red" | "amber" | "green";

interface HealthMetric {
  id: string;
  name: string;
  value: string;
  target: string;
  status: RAGStatus;
  trend: "up" | "down" | "stable";
  comment: string;
}

interface HealthReport {
  overall: RAGStatus;
  lastUpdated: string;
  summary: string;
  metrics: HealthMetric[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RAG_CONFIG: Record<RAGStatus, { label: string; color: string; icon: React.ReactNode; bg: string }> = {
  green: { label: "Vert", color: "text-green-700", bg: "bg-green-100", icon: <CheckCircle className="size-4" /> },
  amber: { label: "Ambre", color: "text-amber-700", bg: "bg-amber-100", icon: <AlertTriangle className="size-4" /> },
  red: { label: "Rouge", color: "text-red-700", bg: "bg-red-100", icon: <XCircle className="size-4" /> },
};

const INITIAL_REPORT: HealthReport = {
  overall: "amber",
  lastUpdated: new Date().toISOString(),
  summary: "Le projet avance avec quelques risques sur le planning. Le budget est sous contrôle.",
  metrics: [
    { id: "1", name: "Planning", value: "85%", target: "90%", status: "amber", trend: "down", comment: "2 tâches en retard" },
    { id: "2", name: "Budget", value: "€45k", target: "€60k", status: "green", trend: "stable", comment: "Dans les limites" },
    { id: "3", name: "Qualité", value: "92%", target: "90%", status: "green", trend: "up", comment: "Tests au vert" },
    { id: "4", name: "Risques", value: "3 actifs", target: "0", status: "red", trend: "up", comment: "1 risque élevé identifié" },
    { id: "5", name: "Satisfaction", value: "4.2/5", target: "4.0/5", status: "green", trend: "up", comment: "Client satisfait" },
  ],
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function RAGBadge({ status, size = "md" }: { status: RAGStatus; size?: "sm" | "md" | "lg" }) {
  const cfg = RAG_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center gap-1 font-semibold rounded-full px-2 py-0.5",
      cfg.bg, cfg.color,
      size === "sm" && "text-xs", size === "md" && "text-sm", size === "lg" && "text-base px-3 py-1",
    )}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp className="size-4 text-green-600" />;
  if (trend === "down") return <TrendingDown className="size-4 text-red-600" />;
  return <Minus className="size-4 text-muted-foreground" />;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function HealthReport() {
  const [report, setReport] = useState<HealthReport>(INITIAL_REPORT);
  const [editingId, setEditingId] = useState<string | null>(null);

  const updateMetric = (id: string, key: keyof HealthMetric, value: string) => {
    setReport((p) => ({
      ...p,
      metrics: p.metrics.map((m) => m.id === id ? { ...m, [key]: value } : m),
    }));
  };

  const addMetric = () => {
    const m: HealthMetric = {
      id: crypto.randomUUID(), name: "Nouvelle métrique", value: "—", target: "—",
      status: "green", trend: "stable", comment: "",
    };
    setReport((p) => ({ ...p, metrics: [...p.metrics, m] }));
    setEditingId(m.id);
  };

  const removeMetric = (id: string) => {
    setReport((p) => ({ ...p, metrics: p.metrics.filter((m) => m.id !== id) }));
  };

  // Auto-compute overall from metrics
  const computeOverall = (): RAGStatus => {
    if (report.metrics.some((m) => m.status === "red")) return "red";
    if (report.metrics.some((m) => m.status === "amber")) return "amber";
    return "green";
  };

  const overall = computeOverall();

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-background">
      {/* Header */}
      <div className="flex items-start justify-between border-b pb-3">
        <div>
          <h3 className="font-semibold">Rapport de santé du projet</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mis à jour: {new Date(report.lastUpdated).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <RAGBadge status={overall} size="lg" />
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
        <Input
          value={report.summary}
          onChange={(e) => setReport((p) => ({ ...p, summary: e.target.value }))}
          className="border-0 bg-transparent text-sm p-0 h-auto focus-visible:ring-0"
          placeholder="Résumé de la santé du projet..."
        />
      </div>

      {/* Metrics grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {report.metrics.map((m) => (
          <div
            key={m.id}
            className={cn("border rounded-lg p-3 space-y-2 cursor-pointer hover:shadow-sm transition-shadow",
              m.status === "red" && "border-red-200 bg-red-50/50",
              m.status === "amber" && "border-amber-200 bg-amber-50/50",
              m.status === "green" && "border-green-200 bg-green-50/50",
            )}
            onClick={() => setEditingId(editingId === m.id ? null : m.id)}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{m.name}</span>
              <div className="flex items-center gap-1">
                <TrendIcon trend={m.trend} />
                <RAGBadge status={m.status} size="sm" />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{m.value}</span>
              <span className="text-xs text-muted-foreground">cible: {m.target}</span>
            </div>

            {m.comment && <p className="text-xs text-muted-foreground">{m.comment}</p>}

            {/* Edit panel */}
            {editingId === m.id && (
              <div className="pt-2 border-t space-y-2" onClick={(e) => e.stopPropagation()}>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Valeur" value={m.value} onChange={(e) => updateMetric(m.id, "value", e.target.value)} className="h-7 text-xs" />
                  <Input placeholder="Cible" value={m.target} onChange={(e) => updateMetric(m.id, "target", e.target.value)} className="h-7 text-xs" />
                </div>
                <div className="flex gap-2">
                  <select value={m.status} onChange={(e) => updateMetric(m.id, "status", e.target.value as RAGStatus)} className="flex-1 h-7 rounded border text-xs px-1">
                    <option value="green">Vert</option>
                    <option value="amber">Ambre</option>
                    <option value="red">Rouge</option>
                  </select>
                  <select value={m.trend} onChange={(e) => updateMetric(m.id, "trend", e.target.value as "up" | "down" | "stable")} className="flex-1 h-7 rounded border text-xs px-1">
                    <option value="up">↑ Hausse</option>
                    <option value="stable">→ Stable</option>
                    <option value="down">↓ Baisse</option>
                  </select>
                </div>
                <Input placeholder="Commentaire" value={m.comment} onChange={(e) => updateMetric(m.id, "comment", e.target.value)} className="h-7 text-xs" />
                <Button size="sm" variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => removeMetric(m.id)}>
                  Supprimer
                </Button>
              </div>
            )}
          </div>
        ))}

        <button
          onClick={addMetric}
          className="border-2 border-dashed rounded-lg p-3 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Plus className="size-4" />
          <span className="text-sm">Ajouter métrique</span>
        </button>
      </div>
    </div>
  );
}
