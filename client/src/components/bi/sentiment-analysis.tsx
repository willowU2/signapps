"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
  score: number; // 0-100, 50 = neutral
}

export default function SentimentAnalysis() {
  const sentiment: SentimentData = {
    positive: 68,
    neutral: 22,
    negative: 10,
    score: 72,
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-emerald-600 bg-emerald-50";
    if (score >= 50) return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return "Positive";
    if (score >= 50) return "Neutral";
    return "Negative";
  };

  const getGaugeColor = (score: number) => {
    if (score >= 70) return "fill-emerald-500";
    if (score >= 50) return "fill-amber-500";
    return "fill-red-500";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Sentiment Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Gauge */}
          <div className="flex justify-center">
            <div className="relative w-40 h-40">
              <svg
                className="w-full h-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="xMidYMid meet"
              >
                {/* Background gauge */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                />

                {/* Filled gauge */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${(sentiment.score / 100) * 251.3} 251.3`}
                  strokeLinecap="round"
                  className={getGaugeColor(sentiment.score)}
                  transform="rotate(-90 50 50)"
                />

                {/* Center text */}
                <text
                  x="50"
                  y="48"
                  textAnchor="middle"
                  fontSize="28"
                  fontWeight="bold"
                  fill="currentColor"
                >
                  {sentiment.score}
                </text>
                <text
                  x="50"
                  y="60"
                  textAnchor="middle"
                  fontSize="12"
                  fill="#999"
                >
                  Sentiment
                </text>
              </svg>
            </div>
          </div>

          {/* Score label */}
          <div
            className={`p-3 rounded-lg text-center ${getScoreColor(sentiment.score)}`}
          >
            <p className="font-semibold text-sm">
              {getScoreLabel(sentiment.score)}
            </p>
          </div>

          {/* Breakdown */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-muted-foreground">
                  Positive
                </span>
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-200"
                >
                  {sentiment.positive}%
                </Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: `${sentiment.positive}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-muted-foreground">
                  Neutral
                </span>
                <Badge
                  variant="outline"
                  className="bg-muted text-muted-foreground border-border"
                >
                  {sentiment.neutral}%
                </Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gray-400 h-2 rounded-full"
                  style={{ width: `${sentiment.neutral}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-muted-foreground">
                  Negative
                </span>
                <Badge
                  variant="outline"
                  className="bg-red-50 text-red-700 border-red-200"
                >
                  {sentiment.negative}%
                </Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full"
                  style={{ width: `${sentiment.negative}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="pt-3 border-t text-xs text-muted-foreground">
            <p>Based on 1,245 customer feedback entries</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
