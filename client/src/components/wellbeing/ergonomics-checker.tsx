"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErgonomicsQuestion {
  id: string;
  category: "posture" | "screen" | "chair";
  question: string;
  weight: number;
}

export default function ErgonomicsChecker() {
  const [scores, setScores] = useState({ posture: 0, screen: 0, chair: 0 });
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  const questions: ErgonomicsQuestion[] = [
    { id: "p1", category: "posture", question: "Back straight and supported?", weight: 25 },
    { id: "p2", category: "posture", question: "Neck aligned with screen?", weight: 25 },
    { id: "s1", category: "screen", question: "Screen at arm's length distance?", weight: 25 },
    { id: "s2", category: "screen", question: "Top of screen at eye level?", weight: 25 },
    { id: "c1", category: "chair", question: "Feet flat on ground?", weight: 25 },
    { id: "c2", category: "chair", question: "Armrests at elbow height?", weight: 25 },
  ];

  const handleToggle = (id: string) => {
    const newAnswers = { ...answers, [id]: !answers[id] };
    setAnswers(newAnswers);
    calculateScores(newAnswers);
  };

  const calculateScores = (currentAnswers: Record<string, boolean>) => {
    const newScores = { posture: 0, screen: 0, chair: 0 };
    questions.forEach((q) => {
      if (currentAnswers[q.id]) {
        newScores[q.category] += q.weight / 2;
      }
    });
    setScores(newScores);
  };

  const overallScore = (scores.posture + scores.screen + scores.chair) / 3;
  const statusColor = overallScore >= 75 ? "text-green-600" : overallScore >= 50 ? "text-yellow-600" : "text-red-600";

  const recommendations = [
    "Adjust monitor height to eye level",
    "Use a chair with proper lumbar support",
    "Keep wrists neutral while typing",
    "Take 5-minute breaks every 30 minutes",
  ];

  return (
    <div className="space-y-6 p-4">
      <h2 className="text-2xl font-bold">Ergonomics Checker</h2>

      <div className="grid gap-4">
        {["posture", "screen", "chair"].map((category) => (
          <div key={category} className="bg-muted p-4 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold capitalize">{category}</h3>
              <span className={`text-2xl font-bold ${scores[category as keyof typeof scores] >= 50 ? "text-green-600" : "text-orange-600"}`}>
                {Math.round(scores[category as keyof typeof scores])}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${scores[category as keyof typeof scores] >= 50 ? "bg-green-500" : "bg-orange-500"}`}
                style={{ width: `${scores[category as keyof typeof scores]}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Assessment</h3>
        {questions.map((q) => (
          <label key={q.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
            <input
              type="checkbox"
              checked={answers[q.id] || false}
              onChange={() => handleToggle(q.id)}
              className="w-4 h-4"
            />
            <span className="text-sm">{q.question}</span>
          </label>
        ))}
      </div>

      <div className={`p-4 rounded-lg border-2 ${overallScore >= 75 ? "bg-green-50 border-green-200" : overallScore >= 50 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"}`}>
        <div className="flex items-start gap-2">
          {overallScore >= 75 ? <CheckCircle2 className={`w-5 h-5 ${statusColor} flex-shrink-0 mt-0.5`} /> : <AlertCircle className={`w-5 h-5 ${statusColor} flex-shrink-0 mt-0.5`} />}
          <div>
            <p className={`font-semibold ${statusColor}`}>Overall Score: {Math.round(overallScore)}%</p>
            <p className="text-sm text-muted-foreground mt-1">{overallScore >= 75 ? "Excellent posture!" : "Improve your setup"}</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Recommendations</h3>
        <ul className="space-y-1">
          {recommendations.map((rec, i) => (
            <li key={i} className="text-sm text-blue-800 flex items-start gap-2">
              <span className="text-blue-600 font-bold">•</span>
              {rec}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
