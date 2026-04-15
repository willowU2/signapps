"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ClipboardCheck,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  ToggleLeft,
  AlignLeft,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";

type QuestionType = "multiple-choice" | "true-false" | "open";

interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}
interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  options: QuizOption[];
  openAnswer?: string;
  points: number;
}

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  passingScore: number;
  timeLimit: number;
}

const QUESTION_TYPES: {
  type: QuestionType;
  label: string;
  icon: React.ElementType;
}[] = [
  { type: "multiple-choice", label: "Multiple Choice", icon: CheckCircle },
  { type: "true-false", label: "True / False", icon: ToggleLeft },
  { type: "open", label: "Open Answer", icon: AlignLeft },
];

const makeOption = (text: string, isCorrect = false): QuizOption => ({
  id: Date.now().toString() + Math.random(),
  text,
  isCorrect,
});
const makeQuestion = (type: QuestionType): QuizQuestion => ({
  id: Date.now().toString(),
  type,
  question: "",
  points: 1,
  options:
    type === "true-false"
      ? [makeOption("True", true), makeOption("False")]
      : type === "multiple-choice"
        ? [makeOption("", true), makeOption(""), makeOption("")]
        : [],
  openAnswer: type === "open" ? "" : undefined,
});

export default function QuizBuilderPage() {
  usePageTitle("Createur de quiz");
  const [quiz, setQuiz] = useState<Quiz>({
    id: "1",
    title: "",
    description: "",
    questions: [],
    passingScore: 70,
    timeLimit: 30,
  });
  const [saved, setSaved] = useState(false);

  const addQuestion = (type: QuestionType) => {
    setQuiz((prev) => ({
      ...prev,
      questions: [...prev.questions, makeQuestion(type)],
    }));
  };

  const updateQuestion = (
    qid: string,
    field: keyof QuizQuestion,
    val: unknown,
  ) =>
    setQuiz((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === qid ? { ...q, [field]: val } : q,
      ),
    }));

  const removeQuestion = (qid: string) =>
    setQuiz((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== qid),
    }));

  const updateOption = (
    qid: string,
    oid: string,
    field: "text" | "isCorrect",
    val: string | boolean,
  ) =>
    setQuiz((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== qid) return q;
        const options = q.options.map((o) => {
          if (field === "isCorrect" && val === true)
            return { ...o, isCorrect: o.id === oid };
          if (o.id === oid) return { ...o, [field]: val };
          return o;
        });
        return { ...q, options };
      }),
    }));

  const addOption = (qid: string) =>
    setQuiz((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === qid ? { ...q, options: [...q.options, makeOption("")] } : q,
      ),
    }));

  const removeOption = (qid: string, oid: string) =>
    setQuiz((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === qid
          ? { ...q, options: q.options.filter((o) => o.id !== oid) }
          : q,
      ),
    }));

  const handleSave = () => {
    if (!quiz.title.trim()) {
      toast.error("Titre du quiz requis");
      return;
    }
    if (quiz.questions.length === 0) {
      toast.error("Ajoutez au moins une question");
      return;
    }
    setSaved(true);
    toast.success(
      `Quiz "${quiz.title}" enregistré avec ${quiz.questions.length} question(s)`,
    );
  };

  const totalPoints = quiz.questions.reduce((a, q) => a + q.points, 0);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Quiz Builder</h1>
              <p className="text-sm text-muted-foreground">
                Create assessments with multiple question types
              </p>
            </div>
          </div>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Quiz
          </Button>
        </div>

        {/* Quiz settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quiz Settings</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Title</Label>
              <Input
                value={quiz.title}
                onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                placeholder="Quiz title..."
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={quiz.description}
                onChange={(e) =>
                  setQuiz({ ...quiz, description: e.target.value })
                }
                placeholder="Brief description..."
                rows={2}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Passing Score (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={quiz.passingScore}
                onChange={(e) =>
                  setQuiz({ ...quiz, passingScore: +e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label>Time Limit (min)</Label>
              <Input
                type="number"
                min={0}
                value={quiz.timeLimit}
                onChange={(e) =>
                  setQuiz({ ...quiz, timeLimit: +e.target.value })
                }
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <div className="space-y-4">
          {quiz.questions.map((q, idx) => (
            <Card key={q.id}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Q{idx + 1}
                  </Badge>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {q.type.replace("-", " ")}
                  </Badge>
                  <div className="ml-auto flex items-center gap-2">
                    <Label className="text-xs">Points:</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={q.points}
                      onChange={(e) =>
                        updateQuestion(q.id, "points", +e.target.value)
                      }
                      className="w-16 h-7 text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeQuestion(q.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Question</Label>
                  <Textarea
                    value={q.question}
                    onChange={(e) =>
                      updateQuestion(q.id, "question", e.target.value)
                    }
                    placeholder="Enter your question..."
                    rows={2}
                    className="mt-1"
                  />
                </div>

                {q.type === "multiple-choice" && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Options (click circle to mark correct)
                    </Label>
                    {q.options.map((opt) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateOption(q.id, opt.id, "isCorrect", true)
                          }
                          className={cn(
                            "h-5 w-5 rounded-full border-2 transition-colors shrink-0",
                            opt.isCorrect
                              ? "bg-green-500 border-green-500"
                              : "border-muted-foreground hover:border-green-500",
                          )}
                        />
                        <Input
                          value={opt.text}
                          onChange={(e) =>
                            updateOption(q.id, opt.id, "text", e.target.value)
                          }
                          placeholder="Option text..."
                          className="h-8"
                        />
                        {q.options.length > 2 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => removeOption(q.id, opt.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addOption(q.id)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Option
                    </Button>
                  </div>
                )}

                {q.type === "true-false" && (
                  <RadioGroup
                    value={q.options.find((o) => o.isCorrect)?.text || "True"}
                    onValueChange={(v) =>
                      q.options.forEach((o) =>
                        updateOption(q.id, o.id, "isCorrect", o.text === v),
                      )
                    }
                    className="flex gap-6"
                  >
                    {q.options.map((o) => (
                      <div key={o.id} className="flex items-center gap-2">
                        <RadioGroupItem value={o.text} id={`${q.id}-${o.id}`} />
                        <Label
                          htmlFor={`${q.id}-${o.id}`}
                          className={cn(
                            "cursor-pointer",
                            o.text === "True"
                              ? "text-green-600"
                              : "text-red-600",
                          )}
                        >
                          {o.text}
                        </Label>
                      </div>
                    ))}
                    <span className="text-xs text-muted-foreground self-center">
                      = correct answer
                    </span>
                  </RadioGroup>
                )}

                {q.type === "open" && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      Expected answer (for grading reference)
                    </Label>
                    <Textarea
                      value={q.openAnswer || ""}
                      onChange={(e) =>
                        updateQuestion(q.id, "openAnswer", e.target.value)
                      }
                      placeholder="Model answer..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add question buttons */}
        <Card className="border-dashed">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-3 text-center">
              Add a question
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUESTION_TYPES.map(({ type, label, icon: Icon }) => (
                <Button
                  key={type}
                  variant="outline"
                  onClick={() => addQuestion(type)}
                  className="gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {quiz.questions.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
            <span>
              {quiz.questions.length} question
              {quiz.questions.length > 1 ? "s" : ""}
            </span>
            <span>{totalPoints} total points</span>
            <span>Passing: {quiz.passingScore}%</span>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
