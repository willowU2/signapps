"use client";

import { AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface StockItem {
  id: string;
  product: string;
  quantity: number;
  minThreshold: number;
  lastMovement: string;
}

interface StockManagerProps {
  items?: StockItem[];
}

const SAMPLE_STOCK: StockItem[] = [
  {
    id: "1",
    product: "Office Chair",
    quantity: 5,
    minThreshold: 10,
    lastMovement: "2026-03-20",
  },
  {
    id: "2",
    product: "Standing Desk",
    quantity: 8,
    minThreshold: 5,
    lastMovement: "2026-03-21",
  },
  {
    id: "3",
    product: "Monitor Stand",
    quantity: 0,
    minThreshold: 3,
    lastMovement: "2026-03-19",
  },
  {
    id: "4",
    product: "Keyboard",
    quantity: 20,
    minThreshold: 10,
    lastMovement: "2026-03-22",
  },
  {
    id: "5",
    product: "Mouse",
    quantity: 35,
    minThreshold: 15,
    lastMovement: "2026-03-22",
  },
  {
    id: "6",
    product: "Webcam",
    quantity: 8,
    minThreshold: 10,
    lastMovement: "2026-03-20",
  },
];

function getStatusBadge(quantity: number, minThreshold: number) {
  if (quantity === 0) {
    return (
      <Badge variant="destructive" className="bg-red-600">
        Out
      </Badge>
    );
  } else if (quantity < minThreshold) {
    return (
      <Badge variant="destructive" className="bg-yellow-600">
        Low
      </Badge>
    );
  } else {
    return (
      <Badge variant="default" className="bg-green-600">
        OK
      </Badge>
    );
  }
}

function isBelowThreshold(quantity: number, minThreshold: number): boolean {
  return quantity <= minThreshold;
}

export function StockManager({ items = SAMPLE_STOCK }: StockManagerProps) {
  const alertItems = items.filter((item) =>
    isBelowThreshold(item.quantity, item.minThreshold)
  );

  return (
    <div className="space-y-6">
      {alertItems.length > 0 && (
        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900">
                Low Stock Alert
              </h3>
              <p className="text-sm text-yellow-800">
                {alertItems.length} product{alertItems.length !== 1 ? "s" : ""}{" "}
                below minimum threshold
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Product</TableHead>
              <TableHead className="w-20 text-right">Quantity</TableHead>
              <TableHead className="w-24 text-right">Min Threshold</TableHead>
              <TableHead className="w-16">Status</TableHead>
              <TableHead className="w-32">Last Movement</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.id}
                className={
                  isBelowThreshold(item.quantity, item.minThreshold)
                    ? "bg-yellow-50"
                    : ""
                }
              >
                <TableCell className="font-medium">{item.product}</TableCell>
                <TableCell className="text-right">
                  <span
                    className={`font-semibold ${
                      item.quantity === 0
                        ? "text-red-600"
                        : item.quantity < item.minThreshold
                          ? "text-yellow-600"
                          : "text-green-600"
                    }`}
                  >
                    {item.quantity}
                  </span>
                </TableCell>
                <TableCell className="text-right">{item.minThreshold}</TableCell>
                <TableCell>
                  {getStatusBadge(item.quantity, item.minThreshold)}
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {new Date(item.lastMovement).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {isBelowThreshold(item.quantity, item.minThreshold) && (
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="border rounded-lg p-4">
          <p className="text-2xl font-bold text-gray-900">
            {items.reduce((sum, item) => sum + item.quantity, 0)}
          </p>
          <p className="text-sm text-gray-600">Total Units</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-2xl font-bold text-yellow-600">{alertItems.length}</p>
          <p className="text-sm text-gray-600">Low Stock</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-2xl font-bold text-red-600">
            {items.filter((item) => item.quantity === 0).length}
          </p>
          <p className="text-sm text-gray-600">Out of Stock</p>
        </div>
      </div>
    </div>
  );
}
