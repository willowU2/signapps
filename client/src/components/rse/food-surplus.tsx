"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Apple } from "lucide-react";

interface SurplusItem {
  id: string;
  item: string;
  quantity: string;
  expiryDate: string;
  location: string;
}

export default function FoodSurplus() {
  const [items] = useState<SurplusItem[]>([
    {
      id: "1",
      item: "Organic Apples",
      quantity: "15 kg",
      expiryDate: "Today",
      location: "Cafeteria",
    },
    {
      id: "2",
      item: "Whole Wheat Bread",
      quantity: "8 loaves",
      expiryDate: "Tomorrow",
      location: "Pantry A",
    },
    {
      id: "3",
      item: "Greek Yogurt",
      quantity: "12 cups",
      expiryDate: "In 3 days",
      location: "Fridge 2",
    },
  ]);

  const [claimed, setClaimed] = useState<string[]>([]);

  const handleClaim = (id: string) => {
    setClaimed((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Apple className="w-6 h-6 text-orange-600" />
        <h2 className="text-2xl font-bold">Food Surplus</h2>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold mb-2">{item.item}</h3>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Quantity</p>
                    <p className="font-medium">{item.quantity}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expires</p>
                    <p className="font-medium">{item.expiryDate}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Location</p>
                    <p className="font-medium">{item.location}</p>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant={claimed.includes(item.id) ? "default" : "outline"}
                onClick={() => handleClaim(item.id)}
                className="self-center"
              >
                {claimed.includes(item.id) ? "✓ Claimed" : "Claim"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {claimed.length > 0 && (
        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 text-sm">
          <p className="text-orange-900">
            <strong>{claimed.length}</strong> item(s) claimed for reuse
          </p>
        </div>
      )}
    </div>
  );
}
