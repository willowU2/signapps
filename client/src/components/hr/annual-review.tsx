"use client";

import { useState } from "react";
import { Star, CheckCircle, FileText, User } from "lucide-react";

interface ReviewObjective {
  id: string;
  title: string;
  description: string;
  status: "achieved" | "partial" | "missed";
  rating: number;
}

interface ActionPlan {
  id: string;
  action: string;
  dueDate: string;
  owner: string;
  completed: boolean;
}

const DEFAULT_OBJECTIVES: ReviewObjective[] = [
  {
    id: "1",
    title: "Complete API Migration",
    description: "Migrate legacy REST API to GraphQL",
    status: "achieved",
    rating: 5,
  },
  {
    id: "2",
    title: "Improve Test Coverage",
    description: "Increase unit test coverage to 85%",
    status: "achieved",
    rating: 4,
  },
  {
    id: "3",
    title: "Mentor Junior Developers",
    description: "Onboard and mentor 2 junior developers",
    status: "partial",
    rating: 3,
  },
];

const DEFAULT_ACTIONS: ActionPlan[] = [
  {
    id: "1",
    action: "Attend advanced TypeScript course",
    dueDate: "2026-06-30",
    owner: "Employee",
    completed: false,
  },
  {
    id: "2",
    action: "Lead architecture review session",
    dueDate: "2026-04-30",
    owner: "Employee",
    completed: false,
  },
  {
    id: "3",
    action: "Provide monthly feedback meetings",
    dueDate: "2026-12-31",
    owner: "Manager",
    completed: false,
  },
];

export function AnnualReview() {
  const [objectives, setObjectives] = useState<ReviewObjective[]>(
    DEFAULT_OBJECTIVES
  );
  const [actions, setActions] = useState<ActionPlan[]>(DEFAULT_ACTIONS);
  const [overallRating, setOverallRating] = useState(4);
  const [managerComments, setManagerComments] = useState(
    "Excellent performance this year. Strong technical skills and leadership potential."
  );
  const [employeeComments, setEmployeeComments] = useState("");
  const [isSigned, setIsSigned] = useState(false);

  const handleToggleAction = (id: string) => {
    setActions(
      actions.map((a) =>
        a.id === id ? { ...a, completed: !a.completed } : a
      )
    );
  };

  const avgObjectiveRating =
    objectives.length > 0
      ? (objectives.reduce((sum, o) => sum + o.rating, 0) / objectives.length).toFixed(1)
      : 0;

  const completedActions = actions.filter((a) => a.completed).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Annual Review</h2>
          <p className="text-gray-600">
            Performance evaluation and development planning
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <p className="text-sm text-blue-700 font-medium">Overall Rating</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-blue-900">{overallRating}</p>
            <span className="text-sm text-blue-700">/5</span>
          </div>
        </div>

        <div className="rounded-lg border bg-purple-50 p-4">
          <p className="text-sm text-purple-700 font-medium">Objectives Average</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold text-purple-900">{avgObjectiveRating}</p>
            <span className="text-sm text-purple-700">/5</span>
          </div>
        </div>

        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-sm text-green-700 font-medium">Development Actions</p>
          <p className="text-2xl font-bold text-green-900">
            {completedActions}/{actions.length}
          </p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-50 border-b p-4">
          <h3 className="font-semibold text-gray-900">Performance Objectives</h3>
        </div>

        <div className="divide-y">
          {objectives.map((obj) => (
            <div key={obj.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-900">{obj.title}</p>
                  <p className="text-sm text-gray-600">{obj.description}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span
                    className={`text-xs px-2 py-1 rounded font-medium ${
                      obj.status === "achieved"
                        ? "bg-green-100 text-green-800"
                        : obj.status === "partial"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {obj.status.charAt(0).toUpperCase() + obj.status.slice(1)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= obj.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="bg-gray-50 border-b p-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Development Plan</h3>
        </div>

        <div className="divide-y">
          {actions.map((action) => (
            <div
              key={action.id}
              className={`p-4 cursor-pointer transition-all ${
                action.completed ? "bg-green-50" : "hover:bg-gray-50"
              }`}
              onClick={() => handleToggleAction(action.id)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {action.completed ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                </div>

                <div className="flex-1">
                  <p className="font-medium text-gray-900">{action.action}</p>
                  <div className="flex gap-4 mt-1 text-xs text-gray-600">
                    <span>Due: {action.dueDate}</span>
                    <span>Owner: {action.owner}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 bg-white">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Overall Rating
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setOverallRating(star)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <Star
                  className={`w-6 h-6 ${
                    star <= overallRating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-white">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sign-off
          </label>
          <button
            onClick={() => setIsSigned(!isSigned)}
            className={`w-full py-2 rounded-lg font-medium transition-colors ${
              isSigned
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {isSigned ? "✓ Signed" : "Sign Review"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 bg-white">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Manager Comments
          </label>
          <textarea
            value={managerComments}
            onChange={(e) => setManagerComments(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500"
            rows={3}
            disabled
          />
        </div>

        <div className="border rounded-lg p-4 bg-white">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Employee Response
          </label>
          <textarea
            value={employeeComments}
            onChange={(e) => setEmployeeComments(e.target.value)}
            placeholder="Add your comments and acknowledgment..."
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500"
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
