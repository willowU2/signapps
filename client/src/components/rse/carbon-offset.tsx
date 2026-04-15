"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Leaf } from "lucide-react";

interface OffsetProject {
  id: string;
  name: string;
  type: "tree" | "solar" | "wind";
  co2Offset: number;
  status: "active" | "completed";
}

export default function CarbonOffset() {
  const [projects] = useState<OffsetProject[]>([
    {
      id: "1",
      name: "Rainforest Reforestation - Amazon",
      type: "tree",
      co2Offset: 250,
      status: "active",
    },
    {
      id: "2",
      name: "Solar Farm - India",
      type: "solar",
      co2Offset: 400,
      status: "active",
    },
    {
      id: "3",
      name: "Wind Energy - Denmark",
      type: "wind",
      co2Offset: 350,
      status: "completed",
    },
    {
      id: "4",
      name: "Mangrove Conservation - Indonesia",
      type: "tree",
      co2Offset: 180,
      status: "active",
    },
  ]);

  const [supported, setSupported] = useState<string[]>([]);

  const totalOffset = projects.reduce((sum, p) => sum + p.co2Offset, 0);
  const monthlyEmissions = 450;
  const offsetPercentage = ((totalOffset / monthlyEmissions) * 100).toFixed(0);

  const handleSupport = (id: string) => {
    setSupported((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const getTypeIcon = (type: string) => {
    if (type === "tree") return "🌳";
    if (type === "solar") return "☀️";
    return "💨";
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Leaf className="w-6 h-6 text-green-600" />
        <h2 className="text-2xl font-bold">Carbon Offset</h2>
      </div>

      {/* Offset vs Emissions */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
          <p className="text-xs text-red-600 mb-1">Monthly Emissions</p>
          <p className="text-2xl font-bold text-red-900">{monthlyEmissions}</p>
          <p className="text-xs text-red-600">kg CO₂</p>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <p className="text-xs text-green-600 mb-1">Total Offset</p>
          <p className="text-2xl font-bold text-green-900">{totalOffset}</p>
          <p className="text-xs text-green-600">kg CO₂</p>
        </div>
      </div>

      {/* Offset Coverage */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium text-sm">Offset Coverage</p>
          <p className="text-lg font-bold text-green-900">
            {offsetPercentage}%
          </p>
        </div>
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-green-500"
            style={{ width: `${Math.min(parseFloat(offsetPercentage), 100)}%` }}
          ></div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          You're offsetting {offsetPercentage}% of your monthly emissions
        </p>
      </div>

      {/* Projects */}
      <div className="space-y-2">
        {projects.map((project) => (
          <div
            key={project.id}
            className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex gap-3 flex-1">
                <span className="text-3xl">{getTypeIcon(project.type)}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{project.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {project.co2Offset} kg CO₂ offset
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                  project.status === "active"
                    ? "bg-green-100 text-green-800"
                    : "bg-muted text-gray-800"
                }`}
              >
                {project.status === "active" ? "🔄 Active" : "✓ Completed"}
              </span>
            </div>
            <Button
              size="sm"
              variant={supported.includes(project.id) ? "default" : "outline"}
              onClick={() => handleSupport(project.id)}
              className="w-full text-xs"
            >
              {supported.includes(project.id)
                ? "✓ Supporting This"
                : "Support Project"}
            </Button>
          </div>
        ))}
      </div>

      {supported.length > 0 && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm">
          <p className="text-green-900">
            <strong>Thank you!</strong> You're supporting {supported.length}{" "}
            offset project(s).
          </p>
        </div>
      )}
    </div>
  );
}
