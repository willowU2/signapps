"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Gauge } from "lucide-react";

interface NPSSurveyProps {
  onSubmit?: (score: number, comment: string) => void;
  historicalScore?: number;
}

export function NPSSurvey({
  onSubmit,
  historicalScore = 72,
}: NPSSurveyProps) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (score !== null) {
      onSubmit?.(score, comment);
      setSubmitted(true);
      setTimeout(() => {
        setScore(null);
        setComment("");
        setSubmitted(false);
      }, 2000);
    }
  };

  // Calculate segments
  const promoters = Math.round((historicalScore * 45) / 100);
  const passives = Math.round((historicalScore * 35) / 100);
  const detractors = 100 - promoters - passives;

  // NPS = Promoters - Detractors
  const nps = promoters - detractors;

  const getGaugeColor = (value: number) => {
    if (value >= 50) return "text-green-600";
    if (value >= 0) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Gauge className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Score NPS</h2>
      </div>

      {/* NPS Gauge */}
      <Card className="p-8">
        <div className="mb-6 text-center">
          <p className="mb-2 text-sm text-muted-foreground">Score NPS Actuel</p>
          <p className={`text-5xl font-bold ${getGaugeColor(nps)}`}>
            {nps.toFixed(0)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            (Promoteurs: {promoters}% - Détracteurs: {detractors}%)
          </p>
        </div>

        {/* Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Promoteurs (9-10)</span>
            <div className="h-6 w-48 rounded-full bg-green-200">
              <div
                className="h-full rounded-full bg-green-600 transition-all"
                style={{ width: `${promoters}%` }}
              />
            </div>
            <span className="w-12 text-right text-sm font-semibold">
              {promoters}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Neutres (7-8)</span>
            <div className="h-6 w-48 rounded-full bg-yellow-200">
              <div
                className="h-full rounded-full bg-yellow-600 transition-all"
                style={{ width: `${passives}%` }}
              />
            </div>
            <span className="w-12 text-right text-sm font-semibold">
              {passives}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Détracteurs (0-6)</span>
            <div className="h-6 w-48 rounded-full bg-red-200">
              <div
                className="h-full rounded-full bg-red-600 transition-all"
                style={{ width: `${detractors}%` }}
              />
            </div>
            <span className="w-12 text-right text-sm font-semibold">
              {detractors}%
            </span>
          </div>
        </div>
      </Card>

      {/* Survey Form */}
      <Card className="p-6">
        <h3 className="mb-4 font-semibold">Donnez-nous votre avis</h3>
        {!submitted ? (
          <div className="space-y-4">
            <div>
              <p className="mb-3 text-sm font-medium">
                Recommanderiez-vous notre service ? (0-10)
              </p>
              <div className="grid grid-cols-11 gap-1">
                {Array.from({ length: 11 }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setScore(i)}
                    className={`h-10 rounded text-sm font-semibold transition-colors ${
                      score === i
                        ? "bg-blue-600 text-white"
                        : "border border-border hover:border-blue-400"
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Commentaire (optionnel)
              </label>
              <Textarea
                placeholder="Expliquez votre score..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="h-20 resize-none"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={score === null}
              className="w-full"
            >
              Envoyer
            </Button>
          </div>
        ) : (
          <div className="rounded-lg bg-green-50 p-4 text-center">
            <p className="font-semibold text-green-700">
              Merci pour votre retour !
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
