"use client";

import { useState } from "react";
import { Star, User } from "lucide-react";

interface Evaluator {
  id: string;
  name: string;
  role: "peer" | "manager" | "subordinate";
  ratings: {
    [competency: string]: number;
  };
}

interface Competency {
  name: string;
  weight: number;
}

const COMPETENCIES: Competency[] = [
  { name: "Communication", weight: 1 },
  { name: "Leadership", weight: 1 },
  { name: "Technical Skill", weight: 1 },
  { name: "Teamwork", weight: 1 },
  { name: "Problem Solving", weight: 1 },
];

const DEFAULT_EVALUATORS: Evaluator[] = [
  {
    id: "1",
    name: "Alice Johnson",
    role: "manager",
    ratings: {
      Communication: 4,
      Leadership: 5,
      "Technical Skill": 4,
      Teamwork: 5,
      "Problem Solving": 4,
    },
  },
  {
    id: "2",
    name: "Bob Chen",
    role: "peer",
    ratings: {
      Communication: 4,
      Leadership: 3,
      "Technical Skill": 5,
      Teamwork: 4,
      "Problem Solving": 5,
    },
  },
  {
    id: "3",
    name: "Carol Davis",
    role: "peer",
    ratings: {
      Communication: 5,
      Leadership: 4,
      "Technical Skill": 4,
      Teamwork: 5,
      "Problem Solving": 4,
    },
  },
  {
    id: "4",
    name: "David Wilson",
    role: "subordinate",
    ratings: {
      Communication: 5,
      Leadership: 5,
      "Technical Skill": 3,
      Teamwork: 5,
      "Problem Solving": 4,
    },
  },
];

function getRoleColor(role: string): string {
  switch (role) {
    case "manager":
      return "bg-purple-100 text-purple-800";
    case "peer":
      return "bg-blue-100 text-blue-800";
    case "subordinate":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= value
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

export function Feedback360() {
  const [evaluators] = useState<Evaluator[]>(DEFAULT_EVALUATORS);
  const [expandedEvaluator, setExpandedEvaluator] = useState<string | null>(null);

  const calculateAverageRating = (competency: string): number => {
    const ratings = evaluators
      .map((e) => e.ratings[competency])
      .filter((r) => r !== undefined);
    return ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;
  };

  const getCompetencyColor = (avg: number): string => {
    if (avg >= 4.5) return "bg-green-50 border-green-200";
    if (avg >= 3.5) return "bg-blue-50 border-blue-200";
    if (avg >= 2.5) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  };

  const overallAverage =
    Math.round(
      (COMPETENCIES.reduce((sum, comp) => sum + calculateAverageRating(comp.name), 0) /
        COMPETENCIES.length) *
        10
    ) / 10;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">360° Feedback Review</h2>
        <p className="text-gray-600">
          Comprehensive feedback from managers, peers, and team members
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <p className="text-sm text-gray-600 font-medium">Overall Rating</p>
          <p className="text-3xl font-bold text-blue-900">{overallAverage}</p>
          <p className="text-xs text-gray-500 mt-1">out of 5.0</p>
        </div>
        <div className="rounded-lg border bg-purple-50 p-4">
          <p className="text-sm text-gray-600 font-medium">Evaluators</p>
          <p className="text-3xl font-bold text-purple-900">{evaluators.length}</p>
          <p className="text-xs text-gray-500 mt-1">Responses received</p>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-sm text-gray-600 font-medium">Managers</p>
          <p className="text-3xl font-bold text-green-900">
            {evaluators.filter((e) => e.role === "manager").length}
          </p>
        </div>
        <div className="rounded-lg border bg-yellow-50 p-4">
          <p className="text-sm text-gray-600 font-medium">Peers & Reports</p>
          <p className="text-3xl font-bold text-yellow-900">
            {evaluators.filter((e) => e.role !== "manager").length}
          </p>
        </div>
      </div>

      <div className="border rounded-lg p-6 bg-white">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Competency Scores
        </h3>
        <div className="space-y-3">
          {COMPETENCIES.map((comp) => {
            const avg = calculateAverageRating(comp.name);
            return (
              <div key={comp.name} className={`rounded-lg border p-4 ${getCompetencyColor(avg)}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-gray-900">{comp.name}</p>
                  <span className="text-lg font-bold text-gray-900">{avg}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(avg / 5) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Evaluator Details</h3>
        {evaluators.map((evaluator) => (
          <div key={evaluator.id} className="border rounded-lg overflow-hidden bg-white">
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
              onClick={() =>
                setExpandedEvaluator(
                  expandedEvaluator === evaluator.id ? null : evaluator.id
                )
              }
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">{evaluator.name}</p>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded capitalize ${getRoleColor(evaluator.role)}`}
                  >
                    {evaluator.role}
                  </span>
                </div>
              </div>
            </div>
            {expandedEvaluator === evaluator.id && (
              <div className="border-t bg-gray-50 p-4 space-y-3">
                {COMPETENCIES.map((comp) => (
                  <div key={comp.name} className="flex items-center justify-between">
                    <span className="text-gray-700">{comp.name}</span>
                    <StarRating value={evaluator.ratings[comp.name] || 0} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
