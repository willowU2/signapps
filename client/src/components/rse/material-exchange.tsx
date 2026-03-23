"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingBag } from "lucide-react";

interface ExchangeItem {
  id: string;
  name: string;
  condition: "Good" | "Fair";
  department: string;
  photo?: string;
}

export default function MaterialExchange() {
  const [items] = useState<ExchangeItem[]>([
    {
      id: "1",
      name: "Office Chair",
      condition: "Good",
      department: "HR",
      photo: "🪑",
    },
    {
      id: "2",
      name: "Monitor 27\"",
      condition: "Fair",
      department: "IT",
      photo: "🖥️",
    },
    {
      id: "3",
      name: "Filing Cabinet",
      condition: "Good",
      department: "Admin",
      photo: "🗄️",
    },
  ]);

  const [requested, setRequested] = useState<string[]>([]);

  const handleRequest = (id: string) => {
    setRequested((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingBag className="w-6 h-6 text-blue-600" />
        <h2 className="text-2xl font-bold">Material Exchange</h2>
      </div>

      <div className="grid gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-4 flex-1">
                <div className="text-4xl">{item.photo}</div>
                <div className="flex-1">
                  <h3 className="font-semibold">{item.name}</h3>
                  <div className="flex gap-2 mt-2 text-sm">
                    <span
                      className={`px-2 py-1 rounded ${
                        item.condition === "Good"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {item.condition}
                    </span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">
                      {item.department}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant={requested.includes(item.id) ? "default" : "outline"}
                onClick={() => handleRequest(item.id)}
              >
                {requested.includes(item.id) ? "✓ Requested" : "Request"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {requested.length > 0 && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
          <p className="text-blue-900">
            <strong>{requested.length}</strong> item(s) requested
          </p>
        </div>
      )}
    </div>
  );
}
