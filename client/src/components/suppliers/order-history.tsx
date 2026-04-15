"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Order {
  id: string;
  supplier: string;
  date: string;
  amount: number;
  status: "completed" | "pending" | "shipped";
}

const DEFAULT_ORDERS: Order[] = [
  {
    id: "1",
    supplier: "TechSupply Inc",
    date: "2026-03-20",
    amount: 5200,
    status: "completed",
  },
  {
    id: "2",
    supplier: "TechSupply Inc",
    date: "2026-03-10",
    amount: 3800,
    status: "completed",
  },
  {
    id: "3",
    supplier: "TechSupply Inc",
    date: "2026-02-28",
    amount: 2100,
    status: "completed",
  },
  {
    id: "4",
    supplier: "Global Components",
    date: "2026-03-18",
    amount: 4500,
    status: "shipped",
  },
  {
    id: "5",
    supplier: "Global Components",
    date: "2026-03-05",
    amount: 6200,
    status: "completed",
  },
  {
    id: "6",
    supplier: "Premium Parts Co",
    date: "2026-03-15",
    amount: 7800,
    status: "completed",
  },
  {
    id: "7",
    supplier: "Premium Parts Co",
    date: "2026-03-01",
    amount: 5400,
    status: "completed",
  },
];

export default function OrderHistory() {
  const [orders] = useState<Order[]>(DEFAULT_ORDERS);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "shipped":
        return "bg-blue-100 text-blue-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const groupedBySupplier = orders.reduce(
    (acc, order) => {
      if (!acc[order.supplier]) {
        acc[order.supplier] = [];
      }
      acc[order.supplier].push(order);
      return acc;
    },
    {} as Record<string, Order[]>,
  );

  const chartData = Object.entries(groupedBySupplier).map(
    ([supplier, supplierOrders]) => ({
      supplier: supplier.split(" ")[0],
      total: supplierOrders.reduce((sum, o) => sum + o.amount, 0),
      count: supplierOrders.length,
    }),
  );

  const totalSpent = orders.reduce((sum, o) => sum + o.amount, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Spent</p>
          <p className="text-2xl font-bold">${totalSpent.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Orders</p>
          <p className="text-2xl font-bold">{orders.length}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Average Order</p>
          <p className="text-2xl font-bold">
            ${Math.round(totalSpent / orders.length).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="mb-4 text-lg font-semibold">Spending by Supplier</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="supplier" />
            <YAxis />
            <Tooltip
              formatter={(value) =>
                typeof value === "number" ? `$${value.toLocaleString()}` : value
              }
            />
            <Legend />
            <Bar dataKey="total" fill="#3b82f6" name="Total Spent" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {Object.entries(groupedBySupplier).map(([supplier, supplierOrders]) => (
        <div key={supplier} className="rounded-lg border">
          <div className="border-b bg-muted p-4">
            <h3 className="font-semibold">{supplier}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Order Date
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {supplierOrders
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime(),
                  )
                  .map((order) => (
                    <tr key={order.id} className="hover:bg-muted">
                      <td className="px-4 py-3 text-sm">{order.date}</td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        ${order.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`rounded px-2 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}
                        >
                          {order.status.charAt(0).toUpperCase() +
                            order.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="border-t bg-muted p-4 text-right">
            <p className="text-sm font-semibold">
              Subtotal: $
              {supplierOrders
                .reduce((sum, o) => sum + o.amount, 0)
                .toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
