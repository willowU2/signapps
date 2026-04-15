"use client";

/**
 * Climate Survey Component
 *
 * Displays eNPS score gauge, anonymous questions with 1-5 scale, and submission history.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Send, Smile, Meh, Frown } from "lucide-react";
import { toast } from "sonner";

export interface SurveyQuestion {
  id: string;
  text: string;
  category: "wellbeing" | "management" | "culture" | "growth";
}

export interface SurveyResponse {
  id: string;
  questionId: string;
  rating: number; // 1-5
  submittedAt: Date;
}

export interface ClimateSurveyProps {
  enpsScore?: number;
  questions: SurveyQuestion[];
  responses: SurveyResponse[];
  onSubmitResponse?: (questionId: string, rating: number) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  wellbeing: "Bien-être",
  management: "Management",
  culture: "Culture",
  growth: "Développement",
};

const CATEGORY_COLORS: Record<string, string> = {
  wellbeing: "bg-green-100 text-green-800",
  management: "bg-blue-100 text-blue-800",
  culture: "bg-purple-100 text-purple-800",
  growth: "bg-orange-100 text-orange-800",
};

function RatingSelector({ onSelect }: { onSelect: (rating: number) => void }) {
  const ratings = [
    { value: 1, icon: Frown, label: "Très insatisfait", color: "text-red-600" },
    { value: 2, icon: Frown, label: "Insatisfait", color: "text-orange-600" },
    { value: 3, icon: Meh, label: "Neutre", color: "text-yellow-600" },
    { value: 4, icon: Smile, label: "Satisfait", color: "text-lime-600" },
    { value: 5, icon: Smile, label: "Très satisfait", color: "text-green-600" },
  ];

  return (
    <div className="flex gap-2">
      {ratings.map((r) => {
        const Icon = r.icon;
        return (
          <button
            key={r.value}
            onClick={() => onSelect(r.value)}
            className="flex flex-col items-center gap-1 p-2 rounded-lg border border-border hover:border-border hover:bg-muted transition-colors"
            title={r.label}
          >
            <Icon className={`w-6 h-6 ${r.color}`} />
            <span className="text-xs font-medium text-muted-foreground">
              {r.value}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SurveyQuestionCard({
  question,
  onRatingSelect,
}: {
  question: SurveyQuestion;
  onRatingSelect: (rating: number) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-medium">{question.text}</p>
            <Badge className={CATEGORY_COLORS[question.category]}>
              {CATEGORY_LABELS[question.category]}
            </Badge>
          </div>
        </div>
        <RatingSelector onSelect={onRatingSelect} />
      </CardContent>
    </Card>
  );
}

function SurveyDialog({
  open,
  onOpenChange,
  questions,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: SurveyQuestion[];
  onSubmit: (responses: { questionId: string; rating: number }[]) => void;
}) {
  const [responses, setResponses] = React.useState<Record<string, number>>({});

  const allAnswered = questions.every((q) => responses[q.id]);

  const handleSubmit = () => {
    const surveyResponses = questions.map((q) => ({
      questionId: q.id,
      rating: responses[q.id],
    }));
    onSubmit(surveyResponses);
    setResponses({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sondage de Climat Social</DialogTitle>
          <DialogDescription>
            Vos réponses sont anonymes et confidentielles
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {questions.map((question) => (
            <div key={question.id}>
              <SurveyQuestionCard
                question={question}
                onRatingSelect={(rating) =>
                  setResponses((prev) => ({
                    ...prev,
                    [question.id]: rating,
                  }))
                }
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!allAnswered}
            className="gap-2"
          >
            <Send className="w-4 h-4" />
            Soumettre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClimateSurvey({
  enpsScore = 45,
  questions,
  responses,
  onSubmitResponse,
}: ClimateSurveyProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleSurveySubmit = (
    surveyResponses: { questionId: string; rating: number }[],
  ) => {
    surveyResponses.forEach((resp) => {
      onSubmitResponse?.(resp.questionId, resp.rating);
    });
    toast.success("Réponses enregistrées avec succès");
  };

  const getENPSLabel = () => {
    if (enpsScore >= 70) return "Excellent";
    if (enpsScore >= 50) return "Bon";
    if (enpsScore >= 20) return "Moyen";
    return "Critique";
  };

  const getENPSColor = () => {
    if (enpsScore >= 70) return "text-green-600";
    if (enpsScore >= 50) return "text-blue-600";
    if (enpsScore >= 20) return "text-orange-600";
    return "text-red-600";
  };

  // Group responses by question for chart
  const responsesByQuestion = questions.map((q) => {
    const qResponses = responses.filter((r) => r.questionId === q.id);
    const avgRating =
      qResponses.length > 0
        ? (
            qResponses.reduce((sum, r) => sum + r.rating, 0) / qResponses.length
          ).toFixed(1)
        : 0;
    return {
      name: q.text.substring(0, 20) + "...",
      rating: parseFloat(avgRating as string),
    };
  });

  const lastSubmission =
    responses.length > 0 ? responses[responses.length - 1].submittedAt : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">
          Sondage Climat Social
        </h2>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Send className="w-4 h-4" />
          Participer
        </Button>
      </div>

      <SurveyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        questions={questions}
        onSubmit={handleSurveySubmit}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score eNPS</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className={`text-5xl font-bold ${getENPSColor()}`}>
                {enpsScore}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {getENPSLabel()}
              </p>
            </div>
            <div className="flex-1 h-32 bg-gradient-to-r from-red-100 to-green-100 rounded-lg p-4 flex items-center justify-center">
              <div className="flex gap-1 w-full">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-full rounded transition-all ${
                      i < Math.round(enpsScore / 10)
                        ? "bg-green-500"
                        : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {responsesByQuestion.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Évaluations Moyennes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={responsesByQuestion}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" style={{ fontSize: "12px" }} />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Bar dataKey="rating" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Historique des Participations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Nombre de réponses</span>
              <span className="font-semibold">{responses.length}</span>
            </div>
            {lastSubmission && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Dernière réponse</span>
                <span className="font-semibold">
                  {new Date(lastSubmission).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
