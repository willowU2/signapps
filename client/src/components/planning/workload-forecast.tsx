"use client";

import { useState } from "react";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TeamMember {
  id: string;
  name: string;
  loadJ30: number;
  loadJ90: number;
}

export default function WorkloadForecast() {
  const [period, setPeriod] = useState<"J30" | "J90">("J30");

  const teamMembers: TeamMember[] = [
    { id: "1", name: "Alice Chen", loadJ30: 95, loadJ90: 85 },
    { id: "2", name: "Bob Martinez", loadJ30: 110, loadJ90: 95 },
    { id: "3", name: "Carol Smith", loadJ30: 75, loadJ90: 80 },
    { id: "4", name: "David Lee", loadJ30: 120, loadJ90: 105 },
  ];

  const load = period === "J30" ? "loadJ30" : "loadJ90";
  const maxLoad = Math.max(...teamMembers.map(m => m[load]));

  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Workload Forecast</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={period === "J30" ? "default" : "outline"}
            onClick={() => setPeriod("J30")}
          >
            J+30
          </Button>
          <Button
            size="sm"
            variant={period === "J90" ? "default" : "outline"}
            onClick={() => setPeriod("J90")}
          >
            J+90
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {teamMembers.map((member) => {
          const loadValue = member[load];
          const isOverloaded = loadValue > 100;
          const percent = (loadValue / 120) * 100;

          return (
            <div key={member.id} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{member.name}</span>
                <span className={`text-sm font-bold ${isOverloaded ? "text-red-600" : "text-green-600"}`}>
                  {loadValue}%
                </span>
              </div>
              <div className="relative w-full h-6 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${isOverloaded ? "bg-red-500" : "bg-blue-500"}`}
                  style={{ width: `${Math.min(percent, 100)}%` }}
                />
              </div>
              {isOverloaded && (
                <div className="flex items-center gap-1 text-xs text-red-600">
                  <AlertTriangle className="w-3 h-3" />
                  Overload alert
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 bg-blue-50 rounded-lg text-sm border border-blue-200">
        <p className="font-medium text-blue-900">
          <TrendingUp className="w-4 h-4 inline mr-2" />
          Forecast period: {period === "J30" ? "Next 30 days" : "Next 90 days"}
        </p>
      </div>
    </div>
  );
}
