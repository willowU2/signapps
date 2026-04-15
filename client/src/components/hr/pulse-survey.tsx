"use client";

/**
 * Pulse Survey Component
 *
 * Weekly survey component with 3-5 rating questions (1-5 stars).
 * Shows trend chart with last 8 weeks average, submit button, and weekly results.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { toast } from "sonner";

export interface PulseSurveyResponse {
  id: string;
  week: number;
  responses: Record<string, number>; // question -> rating (1-5)
  submittedAt: Date;
}

export interface PulseSurveyProps {
  responses: PulseSurveyResponse[];
  onSubmitSurvey?: (
    data: Omit<PulseSurveyResponse, "id" | "submittedAt">,
  ) => void;
  className?: string;
}

const SURVEY_QUESTIONS = [
  "Comment évaluez-vous votre satisfaction au travail cette semaine ?",
  "Vous sentez-vous bien soutenu par vos collègues ?",
  "Avez-vous les outils nécessaires pour faire votre travail efficacement ?",
  "Êtes-vous engagé dans vos projets actuels ?",
  "Comment évaluez-vous votre équilibre travail-vie personnelle ?",
];

function StarRating({
  rating,
  onRatingChange,
  disabled = false,
}: {
  rating: number;
  onRatingChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const [hoverRating, setHoverRating] = React.useState(0);

  return (
    <div className="flex gap-2">
      {Array.from({ length: 5 }).map((_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= (hoverRating || rating);

        return (
          <button
            key={starValue}
            type="button"
            onClick={() => !disabled && onRatingChange(starValue)}
            onMouseEnter={() => !disabled && setHoverRating(starValue)}
            onMouseLeave={() => setHoverRating(0)}
            disabled={disabled}
            className={`transition-colors ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          >
            <Star
              size={24}
              className={`${
                isFilled
                  ? "fill-amber-400 text-amber-400"
                  : "text-gray-300 dark:text-muted-foreground"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function TrendChart({ responses }: { responses: PulseSurveyResponse[] }) {
  const last8Weeks = React.useMemo(() => {
    const weeks = responses.slice(-8);

    return weeks.map((week) => {
      const ratings = Object.values(week.responses);
      const average = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      return {
        week: `S${week.week}`,
        average: parseFloat(average.toFixed(1)),
      };
    });
  }, [responses]);

  if (last8Weeks.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-muted-foreground">
        Aucune donnée disponible
      </div>
    );
  }

  const maxAverage = 5;
  const minHeight = 10;
  const maxHeight = 150;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2 h-40">
        {last8Weeks.map((week) => {
          const percentage = (week.average / maxAverage) * 100;
          const height =
            (percentage / 100) * (maxHeight - minHeight) + minHeight;

          return (
            <div
              key={week.week}
              className="flex-1 flex flex-col items-center gap-2"
            >
              <div className="relative h-40 w-full flex items-end justify-center">
                <div
                  className="w-full bg-blue-500 rounded-t transition-all"
                  style={{ height: `${height}px` }}
                  title={`${week.week}: ${week.average}/5`}
                />
              </div>
              <span className="text-xs text-muted-foreground">{week.week}</span>
              <span className="text-xs font-medium">{week.average}/5</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PulseSurvey({
  responses,
  onSubmitSurvey,
  className,
}: PulseSurveyProps) {
  const [formResponses, setFormResponses] = React.useState<
    Record<string, number>
  >({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleRatingChange = (questionIndex: number, rating: number) => {
    setFormResponses((prev) => ({
      ...prev,
      [questionIndex]: rating,
    }));
  };

  const handleSubmit = async () => {
    const allAnswered = SURVEY_QUESTIONS.every(
      (_, index) => formResponses[index],
    );

    if (!allAnswered) {
      toast.error("Veuillez répondre à toutes les questions");
      return;
    }

    setIsSubmitting(true);
    try {
      const currentWeek = Math.ceil(
        (new Date().getTime() -
          new Date(new Date().getFullYear(), 0, 1).getTime()) /
          (1000 * 60 * 60 * 24 * 7),
      );

      onSubmitSurvey?.({
        week: currentWeek,
        responses: formResponses,
      });

      setFormResponses({});
      toast.success("Sondage soumis avec succès");
    } catch (error) {
      toast.error("Erreur lors de la soumission du sondage");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormComplete = SURVEY_QUESTIONS.every(
    (_, index) => formResponses[index],
  );

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle>Sondage Hebdomadaire de Satisfaction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {SURVEY_QUESTIONS.map((question, index) => (
            <div key={index} className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{question}</label>
                {formResponses[index] && (
                  <Badge variant="secondary">{formResponses[index]}/5</Badge>
                )}
              </div>
              <StarRating
                rating={formResponses[index] || 0}
                onRatingChange={(rating) => handleRatingChange(index, rating)}
              />
            </div>
          ))}

          <Button
            onClick={handleSubmit}
            disabled={!isFormComplete || isSubmitting}
            className="w-full mt-6"
          >
            {isSubmitting ? "Soumission..." : "Soumettre le sondage"}
          </Button>
        </CardContent>
      </Card>

      {responses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tendance - Dernières 8 semaines</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart responses={responses} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
