"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

const metricsClient = getClient(ServiceName.METRICS);

interface ESGScore {
  category: string;
  score: number;
  trend: "up" | "down" | "stable";
  color: string;
}

const DEFAULT_SCORES: ESGScore[] = [
  {
    category: "Environmental",
    score: 78,
    trend: "up",
    color: "bg-green-100 text-green-800",
  },
  {
    category: "Social",
    score: 72,
    trend: "stable",
    color: "bg-blue-100 text-blue-800",
  },
  {
    category: "Governance",
    score: 85,
    trend: "up",
    color: "bg-purple-100 text-purple-800",
  },
];

const DEFAULT_QUARTERLY: number[] = [65, 70, 75, 78];

const STORAGE_KEY_SCORES = "esg_scores";
const STORAGE_KEY_QUARTERLY = "esg_quarterly";

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function ESGReporting() {
  const [scores, setScores] = useState<ESGScore[]>(DEFAULT_SCORES);
  const [quarterly, setQuarterly] = useState<number[]>(DEFAULT_QUARTERLY);
  const [editingScore, setEditingScore] = useState<string | null>(null);
  const [editingQuarterIdx, setEditingQuarterIdx] = useState<number | null>(
    null,
  );

  // Load persisted values on mount — API first, localStorage fallback
  useEffect(() => {
    const load = async () => {
      try {
        const [scoresRes, quarterlyRes] = await Promise.all([
          metricsClient.get<any>("/esg/scores"),
          metricsClient.get<any>("/esg/quarterly"),
        ]);
        if (scoresRes.data) {
          const apiScores = Array.isArray(scoresRes.data)
            ? scoresRes.data
            : scoresRes.data.scores;
          if (Array.isArray(apiScores) && apiScores.length > 0) {
            const mapped = apiScores.map((s: any) => ({
              category: s.category ?? s.name,
              score: s.score ?? s.value ?? 0,
              trend: (["up", "down", "stable"].includes(s.trend)
                ? s.trend
                : "stable") as ESGScore["trend"],
              color: s.color ?? "bg-muted text-gray-800",
            }));
            setScores(mapped);
            localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(mapped));
          }
        }
        if (quarterlyRes.data) {
          const apiQ = Array.isArray(quarterlyRes.data)
            ? quarterlyRes.data
            : quarterlyRes.data.quarterly;
          if (Array.isArray(apiQ) && apiQ.length > 0) {
            const vals = apiQ.map((q: any) =>
              typeof q === "number" ? q : (q.value ?? q.score ?? 0),
            );
            setQuarterly(vals);
            localStorage.setItem(STORAGE_KEY_QUARTERLY, JSON.stringify(vals));
          }
        }
      } catch {
        setScores(
          loadFromStorage<ESGScore[]>(STORAGE_KEY_SCORES, DEFAULT_SCORES),
        );
        setQuarterly(
          loadFromStorage<number[]>(STORAGE_KEY_QUARTERLY, DEFAULT_QUARTERLY),
        );
      }
    };
    load();
  }, []);

  const avgScore = (
    scores.reduce((sum, s) => sum + s.score, 0) / scores.length
  ).toFixed(1);

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return "📈";
    if (trend === "down") return "📉";
    return "➡️";
  };

  const updateScore = (category: string, newScore: number) => {
    const clamped = Math.min(100, Math.max(0, newScore));
    const updated = scores.map((s) =>
      s.category === category ? { ...s, score: clamped } : s,
    );
    setScores(updated);
    localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(updated));
    setEditingScore(null);
    metricsClient.put("/esg/scores", { scores: updated }).catch(() => {});
    toast.success(`${category} score updated`);
  };

  const updateQuarterly = (idx: number, newVal: number) => {
    const clamped = Math.min(100, Math.max(0, newVal));
    const updated = quarterly.map((v, i) => (i === idx ? clamped : v));
    setQuarterly(updated);
    localStorage.setItem(STORAGE_KEY_QUARTERLY, JSON.stringify(updated));
    setEditingQuarterIdx(null);
    metricsClient.put("/esg/quarterly", { quarterly: updated }).catch(() => {});
    toast.success(`Q${idx + 1} trend updated`);
  };

  const handleExport = () => {
    window.print();
    toast.success("PDF généré");
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-6 h-6 text-indigo-600" />
        <h2 className="text-2xl font-bold">ESG Reporting</h2>
      </div>

      {/* Overall Score */}
      <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
        <div className="text-center">
          <p className="text-sm text-indigo-600 mb-2">Overall ESG Score</p>
          <p className="text-5xl font-bold text-indigo-900">{avgScore}</p>
          <p className="text-sm text-indigo-600 mt-1">out of 100</p>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid gap-3">
        {scores.map((item) => (
          <div
            key={item.category}
            className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold">{item.category}</h3>
                {editingScore === item.category ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={item.score}
                      className="h-7 w-24 text-sm"
                      autoFocus
                      onBlur={(e) =>
                        updateScore(item.category, Number(e.target.value))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          updateScore(
                            item.category,
                            Number((e.target as HTMLInputElement).value),
                          );
                        if (e.key === "Escape") setEditingScore(null);
                      }}
                    />
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground cursor-pointer hover:text-indigo-600"
                    title="Click to edit"
                    onClick={() => setEditingScore(item.category)}
                  >
                    Score: {item.score}/100
                  </button>
                )}
              </div>
              <span className="text-xl">{getTrendIcon(item.trend)}</span>
            </div>

            {/* Score Bar */}
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full ${
                  item.score >= 80
                    ? "bg-green-500"
                    : item.score >= 70
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${item.score}%` }}
              ></div>
            </div>

            <div className="text-xs text-muted-foreground">
              {item.score >= 80
                ? "Excellent performance"
                : item.score >= 70
                  ? "Good performance"
                  : "Needs improvement"}
            </div>
          </div>
        ))}
      </div>

      {/* Quarterly Trend — editable bars */}
      <div className="p-4 bg-muted rounded-lg border border-border">
        <p className="font-semibold mb-2 text-sm">
          Quarterly Trend{" "}
          <span className="text-xs font-normal text-muted-foreground">
            (click bar to edit)
          </span>
        </p>
        <div className="h-20 flex items-end gap-2 justify-around">
          {quarterly.map((value, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center">
              {editingQuarterIdx === idx ? (
                <Input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={value}
                  className="h-6 w-full text-xs mb-1 px-1"
                  autoFocus
                  onBlur={(e) => updateQuarterly(idx, Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      updateQuarterly(
                        idx,
                        Number((e.target as HTMLInputElement).value),
                      );
                    if (e.key === "Escape") setEditingQuarterIdx(null);
                  }}
                />
              ) : (
                <div
                  className="w-full bg-indigo-500 rounded-t cursor-pointer hover:bg-indigo-600 transition-colors"
                  style={{ height: `${(value / 100) * 100}%` }}
                  title={`Q${idx + 1}: ${value} — click to edit`}
                  onClick={() => setEditingQuarterIdx(idx)}
                ></div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Q{idx + 1}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Export Button */}
      <Button
        onClick={handleExport}
        className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700"
      >
        📄 Export Report
      </Button>
    </div>
  );
}
