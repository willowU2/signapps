"use client";

import { useState } from "react";
import { Package, Calendar } from "lucide-react";

interface FurnitureItem {
  id: string;
  name: string;
  location: string;
  condition: "good" | "fair" | "poor";
  quantity: number;
  lastChecked: string;
}

const FURNITURE_ITEMS: FurnitureItem[] = [
  {
    id: "1",
    name: "Office Desk",
    location: "Floor 1 - Office 1",
    condition: "good",
    quantity: 8,
    lastChecked: "2026-03-15",
  },
  {
    id: "2",
    name: "Office Chair",
    location: "Floor 1 - All Offices",
    condition: "good",
    quantity: 12,
    lastChecked: "2026-03-10",
  },
  {
    id: "3",
    name: "Conference Table",
    location: "Floor 1 - Conference Room",
    condition: "good",
    quantity: 1,
    lastChecked: "2026-03-20",
  },
  {
    id: "4",
    name: "Filing Cabinet",
    location: "Floor 1 - Storage",
    condition: "fair",
    quantity: 6,
    lastChecked: "2026-02-28",
  },
  {
    id: "5",
    name: "Bookshelf",
    location: "Floor 2 - Office 3",
    condition: "fair",
    quantity: 3,
    lastChecked: "2026-03-01",
  },
  {
    id: "6",
    name: "Sofa",
    location: "Floor 1 - Break Room",
    condition: "poor",
    quantity: 2,
    lastChecked: "2026-01-15",
  },
];

function getConditionColor(condition: string): { bg: string; badge: string; text: string } {
  switch (condition) {
    case "good":
      return { bg: "bg-green-50", badge: "bg-green-100 text-green-800", text: "text-green-900" };
    case "fair":
      return { bg: "bg-yellow-50", badge: "bg-yellow-100 text-yellow-800", text: "text-yellow-900" };
    case "poor":
      return { bg: "bg-red-50", badge: "bg-red-100 text-red-800", text: "text-red-900" };
    default:
      return { bg: "bg-gray-50", badge: "bg-gray-100 text-gray-800", text: "text-gray-900" };
  }
}

export function FurnitureInventory() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedItem = FURNITURE_ITEMS.find((i) => i.id === selectedItemId);

  const totalItems = FURNITURE_ITEMS.reduce((sum, item) => sum + item.quantity, 0);
  const goodCondition = FURNITURE_ITEMS.filter((i) => i.condition === "good").length;
  const poorCondition = FURNITURE_ITEMS.filter((i) => i.condition === "poor").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Furniture Inventory</h2>
          <p className="text-gray-600">Track and manage office furniture</p>
        </div>
        <Package className="w-8 h-8 text-blue-600" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-blue-50 p-4">
          <p className="text-xs font-semibold text-gray-600 uppercase">Total Items</p>
          <p className="text-2xl font-bold text-blue-900">{totalItems}</p>
        </div>

        <div className="rounded-lg border bg-green-50 p-4">
          <p className="text-xs font-semibold text-gray-600 uppercase">Good Condition</p>
          <p className="text-2xl font-bold text-green-900">{goodCondition}</p>
        </div>

        <div className="rounded-lg border bg-red-50 p-4">
          <p className="text-xs font-semibold text-gray-600 uppercase">Poor Condition</p>
          <p className="text-2xl font-bold text-red-900">{poorCondition}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory Table */}
        <div className="lg:col-span-2 border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Item Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-900">Location</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-900">Qty</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-900">Condition</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {FURNITURE_ITEMS.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedItemId === item.id ? getConditionColor(item.condition).bg : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{item.location}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-900">{item.quantity}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          getConditionColor(item.condition).badge
                        }`}
                      >
                        {item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Item Details */}
        <div className="space-y-4">
          {selectedItem ? (
            <div className="rounded-lg border bg-white p-6 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedItem.name}</h3>
                <p className="text-sm text-gray-600">{selectedItem.location}</p>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Quantity</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{selectedItem.quantity}</p>
                </div>

                <div className={`rounded-lg p-3 ${getConditionColor(selectedItem.condition).bg}`}>
                  <p className="text-xs font-semibold text-gray-600 uppercase">Condition</p>
                  <p
                    className={`text-sm font-bold mt-1 ${getConditionColor(selectedItem.condition).text}`}
                  >
                    {selectedItem.condition.charAt(0).toUpperCase() + selectedItem.condition.slice(1)}
                  </p>
                </div>

                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <p className="text-xs font-semibold text-gray-600 uppercase">Last Checked</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {new Date(selectedItem.lastChecked).toLocaleDateString("de-DE")}
                  </p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors text-sm">
                  Update Item
                </button>
                <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium py-2 px-4 rounded transition-colors text-sm">
                  Mark as Checked
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-gray-50 p-6 text-center">
              <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Select an item to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
