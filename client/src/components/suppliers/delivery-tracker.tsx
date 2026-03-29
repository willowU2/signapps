"use client";

import { useState } from "react";
import { Package, CheckCircle, AlertCircle } from "lucide-react";

interface Delivery {
  id: string;
  poRef: string;
  expectedDate: string;
  status: "in-transit" | "delivered" | "late";
  supplier: string;
}

const DEFAULT_DELIVERIES: Delivery[] = [
  {
    id: "1",
    poRef: "PO-2026-0451",
    expectedDate: "2026-03-24",
    status: "in-transit",
    supplier: "TechSupply Inc",
  },
  {
    id: "2",
    poRef: "PO-2026-0450",
    expectedDate: "2026-03-22",
    status: "delivered",
    supplier: "Global Components",
  },
  {
    id: "3",
    poRef: "PO-2026-0449",
    expectedDate: "2026-03-18",
    status: "late",
    supplier: "Premium Parts Co",
  },
  {
    id: "4",
    poRef: "PO-2026-0448",
    expectedDate: "2026-03-26",
    status: "in-transit",
    supplier: "Budget Suppliers",
  },
];

export default function DeliveryTracker() {
  const [deliveries] = useState<Delivery[]>(DEFAULT_DELIVERIES);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "delivered":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "in-transit":
        return <Package className="h-5 w-5 text-blue-600" />;
      case "late":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClass = "px-3 py-1 rounded text-xs font-semibold";
    switch (status) {
      case "delivered":
        return baseClass + " bg-green-100 text-green-700";
      case "in-transit":
        return baseClass + " bg-blue-100 text-blue-700";
      case "late":
        return baseClass + " bg-red-100 text-red-700";
      default:
        return baseClass + " bg-muted text-muted-foreground";
    }
  };

  const getStatusText = (status: string) => {
    return status
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Delivery Tracking</h2>
        </div>
        <div className="divide-y">
          {deliveries.map((delivery) => (
            <div key={delivery.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-muted p-2">
                  {getStatusIcon(delivery.status)}
                </div>
                <div>
                  <p className="font-medium">{delivery.poRef}</p>
                  <p className="text-sm text-muted-foreground">{delivery.supplier}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Expected: {delivery.expectedDate}</p>
                <div className="mt-1">
                  <span className={getStatusBadge(delivery.status)}>
                    {getStatusText(delivery.status)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Delivered</p>
              <p className="text-xl font-bold">
                {deliveries.filter((d) => d.status === "delivered").length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">In Transit</p>
              <p className="text-xl font-bold">
                {deliveries.filter((d) => d.status === "in-transit").length}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-xs text-muted-foreground">Late</p>
              <p className="text-xl font-bold">
                {deliveries.filter((d) => d.status === "late").length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
