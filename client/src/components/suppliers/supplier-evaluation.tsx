"use client";

import { useState } from "react";
import { Star } from "lucide-react";

interface SupplierScore {
  id: string;
  supplierName: string;
  quality: number;
  delivery: number;
  price: number;
  communication: number;
}

const DEFAULT_SCORES: SupplierScore[] = [
  {
    id: "1",
    supplierName: "TechSupply Inc",
    quality: 95,
    delivery: 88,
    price: 75,
    communication: 92,
  },
  {
    id: "2",
    supplierName: "Global Components Ltd",
    quality: 82,
    delivery: 79,
    price: 85,
    communication: 78,
  },
  {
    id: "3",
    supplierName: "Premium Parts Co",
    quality: 98,
    delivery: 95,
    price: 60,
    communication: 96,
  },
];

export default function SupplierEvaluation() {
  const [scores] = useState<SupplierScore[]>(DEFAULT_SCORES);

  const getAverageScore = (supplier: SupplierScore) => {
    return Math.round((supplier.quality + supplier.delivery + supplier.price + supplier.communication) / 4);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-green-100 text-green-700";
    if (score >= 80) return "bg-blue-100 text-blue-700";
    if (score >= 70) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  const getStarRating = (score: number) => {
    return Math.round(score / 20);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Supplier Evaluation Grid</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-semibold">Supplier</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Quality</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Delivery</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Price</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Communication</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Average</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {scores.map((supplier) => {
                const avg = getAverageScore(supplier);
                return (
                  <tr key={supplier.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{supplier.supplierName}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <span className={`rounded px-2 py-1 text-sm font-semibold ${getScoreColor(supplier.quality)}`}>
                          {supplier.quality}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <span className={`rounded px-2 py-1 text-sm font-semibold ${getScoreColor(supplier.delivery)}`}>
                          {supplier.delivery}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <span className={`rounded px-2 py-1 text-sm font-semibold ${getScoreColor(supplier.price)}`}>
                          {supplier.price}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <span className={`rounded px-2 py-1 text-sm font-semibold ${getScoreColor(supplier.communication)}`}>
                          {supplier.communication}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center">
                        <span className={`rounded px-2 py-1 text-sm font-bold ${getScoreColor(avg)}`}>
                          {avg}
                        </span>
                        <div className="mt-1 flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < getStarRating(avg) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                            />
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
