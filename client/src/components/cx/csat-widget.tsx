"use client";

import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Star } from "lucide-react";

interface Rating {
  id: string;
  score: 1 | 2 | 3 | 4 | 5;
  date: string;
  comment?: string;
}

interface CSATWidgetProps {
  ratings?: Rating[];
  onSubmitRating?: (score: 1 | 2 | 3 | 4 | 5) => void;
}

export function CSATWidget({
  ratings = [
    { id: "1", score: 5, date: "2024-03-20", comment: "Excellent service" },
    { id: "2", score: 4, date: "2024-03-19", comment: "Bon, mais peut mieux" },
    { id: "3", score: 5, date: "2024-03-18" },
    { id: "4", score: 4, date: "2024-03-17" },
    { id: "5", score: 3, date: "2024-03-16", comment: "Satisfait" },
  ],
  onSubmitRating,
}: CSATWidgetProps) {
  // Calculate average score
  const avgScore =
    ratings.length > 0
      ? (
          ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
        ).toFixed(1)
      : 0;

  // Prepare trend data
  const trendData = ratings
    .slice()
    .reverse()
    .map((r) => ({
      date: new Date(r.date).toLocaleDateString("fr-FR", {
        month: "short",
        day: "numeric",
      }),
      score: r.score,
    }));

  const handleRating = (score: 1 | 2 | 3 | 4 | 5) => {
    onSubmitRating?.(score);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Star className="h-6 w-6" />
        <h2 className="text-2xl font-bold">CSAT - Satisfaction Client</h2>
      </div>

      {/* Average Score Card */}
      <Card className="p-6">
        <div className="mb-6">
          <p className="mb-1 text-sm text-gray-600">Score Moyen</p>
          <div className="flex items-baseline gap-2">
            <p className="text-5xl font-bold text-blue-600">{avgScore}</p>
            <p className="text-gray-600">/5</p>
          </div>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-5 w-5 ${
                  i < Math.round(Number(avgScore))
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-gray-300"
                }`}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Basé sur {ratings.length} évaluations
          </p>
        </div>

        {/* Quick Rating */}
        <div className="border-t pt-6">
          <p className="mb-3 text-sm font-medium">Évaluer notre service</p>
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i + 1}
                onClick={() => handleRating((i + 1) as 1 | 2 | 3 | 4 | 5)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  size={32}
                  className="text-gray-300 hover:fill-yellow-400 hover:text-yellow-400"
                />
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Trend Chart */}
      <Card className="p-6">
        <h3 className="mb-4 font-semibold">Tendance (Dernières 7 jours)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 5]} />
            <Tooltip formatter={(value) => `${value}/5`} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent Ratings */}
      <Card className="p-6">
        <h3 className="mb-4 font-semibold">Avis Récents</h3>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {ratings.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune évaluation</p>
          ) : (
            ratings
              .slice()
              .reverse()
              .map((rating) => (
                <div key={rating.id} className="border-b border-gray-200 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={16}
                          className={`${
                            i < rating.score
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(rating.date).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  {rating.comment && (
                    <p className="mt-1 text-sm text-gray-700">
                      {rating.comment}
                    </p>
                  )}
                </div>
              ))
          )}
        </div>
      </Card>
    </div>
  );
}
