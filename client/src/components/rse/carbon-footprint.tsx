"use client";

import { useState } from "react";
import { TrendingDown } from "lucide-react";

interface Category {
  name: string;
  value: number;
  color: string;
  tip: string;
}

export default function CarbonFootprint() {
  const [categories] = useState<Category[]>([
    {
      name: "Transport",
      value: 45,
      color: "bg-red-500",
      tip: "Carpool or use public transit 3x/week",
    },
    {
      name: "Energy",
      value: 30,
      color: "bg-yellow-500",
      tip: "Use LED bulbs and reduce AC usage",
    },
    {
      name: "Food",
      value: 15,
      color: "bg-orange-500",
      tip: "Try meatless Mondays",
    },
    {
      name: "Waste",
      value: 10,
      color: "bg-green-600",
      tip: "Reduce single-use plastics",
    },
  ]);

  const totalEmissions = categories.reduce((sum, cat) => sum + cat.value, 0);
  const avgCategory = totalEmissions / categories.length;

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingDown className="w-6 h-6 text-green-600" />
        <h2 className="text-2xl font-bold">Carbon Footprint</h2>
      </div>

      <div className="space-y-4">
        {/* Main Gauge */}
        <div className="p-4 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg border border-blue-200">
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground mb-1">
              Your Monthly Footprint
            </p>
            <p className="text-4xl font-bold text-blue-900">{totalEmissions}</p>
            <p className="text-sm text-muted-foreground">kg CO₂</p>
          </div>
          {/* Gauge visual */}
          <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-400 via-red-400 to-red-600 transition-all"
              style={{
                width: `${Math.min((totalEmissions / 200) * 100, 100)}%`,
              }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>0</span>
            <span>100</span>
            <span>200+</span>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="space-y-3">
          <p className="font-semibold text-sm text-muted-foreground">
            Breakdown by Category
          </p>
          {categories.map((cat) => (
            <div key={cat.name}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{cat.name}</span>
                <span className="text-muted-foreground">
                  {cat.value}% ({((totalEmissions * cat.value) / 100) | 0} kg)
                </span>
              </div>
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${cat.color}`}
                  style={{ width: `${cat.value}%` }}
                ></div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">💡 {cat.tip}</p>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>Tip:</strong> You're{" "}
            {totalEmissions > 150 ? "above" : "close to"} the monthly average of{" "}
            {avgCategory.toFixed(0)} kg. Focus on{" "}
            {categories[0].name.toLowerCase()} to reduce impact.
          </p>
        </div>
      </div>
    </div>
  );
}
