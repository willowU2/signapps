"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Award } from "lucide-react";

interface BCorporArea {
  id: string;
  name: string;
  icon: string;
  completed: number;
  total: number;
  items: string[];
}

export default function BCorporTracker() {
  const [areas] = useState<BCorporArea[]>([
    {
      id: "1",
      name: "Governance",
      icon: "⚖️",
      completed: 4,
      total: 5,
      items: [
        "Mission-driven legal structure",
        "Board accountability",
        "Stakeholder engagement",
        "Ethics oversight",
        "Transparency reporting",
      ],
    },
    {
      id: "2",
      name: "Workers",
      icon: "👥",
      completed: 5,
      total: 6,
      items: [
        "Competitive compensation",
        "Benefits & wellness",
        "Work-life balance",
        "Career development",
        "Safe working conditions",
        "Diversity & inclusion",
      ],
    },
    {
      id: "3",
      name: "Community",
      icon: "🤝",
      completed: 3,
      total: 5,
      items: [
        "Local engagement",
        "Charitable giving",
        "Supplier practices",
        "Community development",
        "Emergency response",
      ],
    },
    {
      id: "4",
      name: "Environment",
      icon: "🌍",
      completed: 4,
      total: 5,
      items: [
        "Climate action",
        "Waste reduction",
        "Water stewardship",
        "Land management",
        "Sustainable sourcing",
      ],
    },
    {
      id: "5",
      name: "Customers",
      icon: "😊",
      completed: 4,
      total: 5,
      items: [
        "Product quality",
        "Data privacy",
        "Customer support",
        "Fair pricing",
        "Accessibility",
      ],
    },
  ]);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const totalCompleted = areas.reduce((sum, a) => sum + a.completed, 0);
  const totalItems = areas.reduce((sum, a) => sum + a.total, 0);
  const overallScore = Math.round((totalCompleted / totalItems) * 100);

  const toggleExpand = (id: string) => {
    setExpanded(expanded === id ? null : id);
  };

  const toggleCheck = (id: string) => {
    setChecked((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const gaps = areas.filter((a) => a.completed < a.total);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Award className="w-6 h-6 text-amber-600" />
        <h2 className="text-2xl font-bold">B Corp Certification</h2>
      </div>

      {/* Overall Score */}
      <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-amber-600 mb-1">Overall Score</p>
            <p className="text-3xl font-bold text-amber-900">{overallScore}%</p>
            <p className="text-xs text-amber-600 mt-1">
              {totalCompleted}/{totalItems} standards met
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-amber-600 mb-2">Certification Status</p>
            <p className="text-lg font-bold text-amber-900">
              {overallScore >= 80 ? "✓ On Track" : "⚠ In Progress"}
            </p>
          </div>
        </div>
      </div>

      {/* Areas */}
      <div className="space-y-2">
        {areas.map((area) => {
          const percentage = Math.round((area.completed / area.total) * 100);
          const isExpanded = expanded === area.id;

          return (
            <div
              key={area.id}
              className="border rounded-lg overflow-hidden bg-card hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => toggleExpand(area.id)}
                className="w-full p-3 flex items-center justify-between hover:bg-muted"
              >
                <div className="flex items-center gap-3 flex-1 text-left">
                  <span className="text-2xl">{area.icon}</span>
                  <div>
                    <p className="font-semibold text-sm">{area.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {area.completed}/{area.total} completed
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-foreground">{percentage}%</p>
                  <span className="text-xs">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* Progress Bar */}
              <div className="px-3 pb-3">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      percentage >= 80
                        ? "bg-green-500"
                        : percentage >= 50
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Expanded Items */}
              {isExpanded && (
                <div className="border-t px-3 py-2 bg-muted space-y-2">
                  {area.items.map((item, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked[`${area.id}-${idx}`] || false}
                        onChange={() => toggleCheck(`${area.id}-${idx}`)}
                        className="rounded"
                      />
                      <span
                        className={
                          checked[`${area.id}-${idx}`]
                            ? "line-through text-gray-400"
                            : "text-muted-foreground"
                        }
                      >
                        {item}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Gap Analysis */}
      {gaps.length > 0 && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="font-semibold text-sm text-blue-900 mb-2">Gap Analysis</p>
          <ul className="space-y-1 text-xs text-blue-900">
            {gaps.map((gap) => (
              <li key={gap.id}>
                • {gap.name}: {gap.total - gap.completed} item(s) remaining
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button className="w-full gap-2 bg-amber-600 hover:bg-amber-700">
        📄 Generate Certification Report
      </Button>
    </div>
  );
}
