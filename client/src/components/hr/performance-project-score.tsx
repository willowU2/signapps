"use client";

// Feature 12: HR performance → based on project completion rate

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, Star } from "lucide-react";

interface EmployeeProjectPerformance {
  employeeId: string;
  employeeName: string;
  role: string;
  completionRate: number; // % tasks completed on time
  onTimeDeliveries: number;
  totalDeliveries: number;
  avgQualityScore: number; // 1-5
  trend: "up" | "down" | "stable";
  projectContributions: { projectName: string; contribution: number }[];
}

const TREND_ICON = {
  up: <TrendingUp className="size-3.5 text-green-600" />,
  down: <TrendingDown className="size-3.5 text-red-600" />,
  stable: <Minus className="size-3.5 text-gray-500" />,
};

const PERF_LEVEL = (rate: number) => rate >= 85 ? { label: "Excellent", class: "bg-green-100 text-green-800" }
  : rate >= 70 ? { label: "Bon", class: "bg-blue-100 text-blue-800" }
  : rate >= 55 ? { label: "Moyen", class: "bg-yellow-100 text-yellow-800" }
  : { label: "À améliorer", class: "bg-red-100 text-red-800" };

const DEMO_DATA: EmployeeProjectPerformance[] = [
  { employeeId: "1", employeeName: "Alice Martin", role: "Lead Dev", completionRate: 92, onTimeDeliveries: 23, totalDeliveries: 25, avgQualityScore: 4.6, trend: "up", projectContributions: [{ projectName: "Auth Backend", contribution: 68 }, { projectName: "Analytics", contribution: 32 }] },
  { employeeId: "2", employeeName: "Bob Dupont", role: "DevOps", completionRate: 78, onTimeDeliveries: 14, totalDeliveries: 18, avgQualityScore: 3.9, trend: "stable", projectContributions: [{ projectName: "Auth Backend", contribution: 50 }, { projectName: "Infra", contribution: 50 }] },
  { employeeId: "5", employeeName: "Emma Leroy", role: "Designer", completionRate: 61, onTimeDeliveries: 11, totalDeliveries: 18, avgQualityScore: 4.1, trend: "down", projectContributions: [{ projectName: "Analytics", contribution: 100 }] },
];

interface PerformanceProjectScoreProps {
  employees?: EmployeeProjectPerformance[];
}

export function PerformanceProjectScore({ employees = DEMO_DATA }: PerformanceProjectScoreProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="size-4 text-yellow-500" />
          Performance par projet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {employees.map((emp) => {
          const level = PERF_LEVEL(emp.completionRate);
          const isOpen = selected === emp.employeeId;
          return (
            <div key={emp.employeeId} className="rounded-lg border overflow-hidden">
              <button
                className="flex w-full items-center gap-2.5 p-2.5 text-left hover:bg-muted/40"
                onClick={() => setSelected(isOpen ? null : emp.employeeId)}
              >
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">{emp.employeeName.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{emp.employeeName}</span>
                    {TREND_ICON[emp.trend]}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Progress value={emp.completionRate} className="h-1.5 w-20" />
                    <span className="text-[10px] text-muted-foreground">{emp.completionRate}%</span>
                  </div>
                </div>
                <Badge className={`text-[10px] shrink-0 ${level.class}`}>{level.label}</Badge>
              </button>
              {isOpen && (
                <div className="border-t bg-muted/20 px-3 py-2 space-y-2 text-xs">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-muted-foreground">Dans les délais</p><p className="font-bold">{emp.onTimeDeliveries}/{emp.totalDeliveries}</p></div>
                    <div><p className="text-muted-foreground">Qualité moy.</p><p className="font-bold">{emp.avgQualityScore}/5</p></div>
                    <div><p className="text-muted-foreground">Taux</p><p className="font-bold">{emp.completionRate}%</p></div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Contributions par projet :</p>
                    {emp.projectContributions.map((pc) => (
                      <div key={pc.projectName} className="flex items-center gap-2">
                        <span className="w-24 truncate">{pc.projectName}</span>
                        <Progress value={pc.contribution} className="h-1 flex-1" />
                        <span className="w-8 text-right">{pc.contribution}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
