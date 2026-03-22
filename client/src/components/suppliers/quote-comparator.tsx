"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";

interface Quote {
  id: string;
  supplier: string;
  price: number;
  deliveryDays: number;
  score: number;
  isWinner?: boolean;
}

const DEFAULT_QUOTES: Quote[] = [
  {
    id: "1",
    supplier: "TechSupply Inc",
    price: 5200,
    deliveryDays: 5,
    score: 92,
    isWinner: true,
  },
  {
    id: "2",
    supplier: "Global Components",
    price: 5800,
    deliveryDays: 7,
    score: 85,
  },
  {
    id: "3",
    supplier: "Premium Parts Co",
    price: 4950,
    deliveryDays: 10,
    score: 88,
  },
  {
    id: "4",
    supplier: "Budget Suppliers Ltd",
    price: 4200,
    deliveryDays: 14,
    score: 72,
  },
];

export default function QuoteComparator() {
  const [quotes] = useState<Quote[]>(DEFAULT_QUOTES);

  const minPrice = Math.min(...quotes.map((q) => q.price));
  const maxPrice = Math.max(...quotes.map((q) => q.price));

  const getPricePct = (price: number) => {
    if (maxPrice === minPrice) return 50;
    return ((price - minPrice) / (maxPrice - minPrice)) * 100;
  };

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Quote Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-semibold">Supplier</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Price</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Delivery (Days)</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Score</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quotes.map((quote) => (
                <tr key={quote.id} className={`hover:bg-gray-50 ${quote.isWinner ? "bg-green-50" : ""}`}>
                  <td className="px-4 py-3 text-sm font-medium">{quote.supplier}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-center">
                      <span className="font-semibold">${quote.price.toLocaleString()}</span>
                      <div className="mt-1 w-20 h-1 bg-gray-200 rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${getPricePct(quote.price)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">{quote.deliveryDays}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="rounded bg-blue-100 px-2 py-1 text-sm font-semibold text-blue-700">
                      {quote.score}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {quote.isWinner ? (
                      <div className="flex items-center justify-center gap-1">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-semibold text-green-600">Winner</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">Not selected</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border bg-green-50 p-4">
        <h3 className="font-semibold text-green-900">Selected Supplier</h3>
        <p className="mt-2 text-sm text-green-700">
          {quotes.find((q) => q.isWinner)?.supplier} has been selected as the winning supplier
        </p>
      </div>
    </div>
  );
}
