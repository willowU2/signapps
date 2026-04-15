"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Cpu } from "lucide-react";

interface Equipment {
  id: string;
  name: string;
  age: string;
  condition: string;
}

export default function ITRecycling() {
  const [equipment] = useState<Equipment[]>([
    { id: "1", name: "Dell Laptop", age: "5 years", condition: "Functional" },
    { id: "2", name: "HP Printer", age: "8 years", condition: "Faulty" },
    { id: "3", name: "Monitor LG", age: "3 years", condition: "Good" },
  ]);

  const [disposal, setDisposal] = useState<Record<string, string>>({});

  const handleDisposal = (
    id: string,
    type: "recycle" | "donate" | "destroy",
  ) => {
    setDisposal((prev) => ({
      ...prev,
      [id]: type,
    }));
  };

  const getImpact = (action: string) => {
    const impacts: Record<string, number> = {
      recycle: 2.5,
      donate: 3.2,
      destroy: 0.5,
    };
    return impacts[action] || 0;
  };

  const totalImpact = Object.values(disposal).reduce(
    (sum, action) => sum + getImpact(action),
    0,
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Cpu className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold">IT Recycling</h2>
      </div>

      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
        <div className="text-center">
          <p className="text-sm text-purple-600 mb-1">Environmental Impact</p>
          <p className="text-3xl font-bold text-purple-900">
            {totalImpact.toFixed(1)}
          </p>
          <p className="text-xs text-purple-600">kg CO₂ equivalent prevented</p>
        </div>
      </div>

      <div className="space-y-3">
        {equipment.map((item) => (
          <div
            key={item.id}
            className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 className="font-semibold mb-1">{item.name}</h3>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 bg-muted rounded">{item.age}</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                    {item.condition}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {(
                [
                  { label: "Recycle", type: "recycle" as const },
                  { label: "Donate", type: "donate" as const },
                  { label: "Destroy", type: "destroy" as const },
                ] as const
              ).map((option) => (
                <Button
                  key={option.type}
                  size="sm"
                  variant={
                    disposal[item.id] === option.type ? "default" : "outline"
                  }
                  onClick={() => handleDisposal(item.id, option.type)}
                  className="text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(disposal).length > 0 && (
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-sm">
          <p className="text-purple-900">
            <strong>{Object.keys(disposal).length}</strong> item(s) scheduled
            for disposal
          </p>
        </div>
      )}
    </div>
  );
}
