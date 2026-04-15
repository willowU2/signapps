"use client";

import { useState } from "react";
import { Calendar, DollarSign, Clock } from "lucide-react";

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  submittedDate: string;
  paymentStatus: "pending" | "paid" | "overdue";
  paymentDate?: string;
}

const DEFAULT_INVOICES: Invoice[] = [
  {
    id: "1",
    invoiceNumber: "SUP-INV-2026-001",
    amount: 5200,
    submittedDate: "2026-03-15",
    paymentStatus: "paid",
    paymentDate: "2026-03-20",
  },
  {
    id: "2",
    invoiceNumber: "SUP-INV-2026-002",
    amount: 3800,
    submittedDate: "2026-03-18",
    paymentStatus: "pending",
  },
  {
    id: "3",
    invoiceNumber: "SUP-INV-2026-003",
    amount: 2100,
    submittedDate: "2026-02-28",
    paymentStatus: "overdue",
  },
];

export default function SupplierPortal() {
  const [invoices] = useState<Invoice[]>(DEFAULT_INVOICES);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "text-green-600";
      case "pending":
        return "text-yellow-600";
      case "overdue":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  const getNextPaymentDate = () => {
    const pending = invoices.find((i) => i.paymentStatus === "pending");
    return pending ? "2026-04-05" : "No pending payments";
  };

  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Invoices Submitted
              </p>
              <p className="text-2xl font-bold">{invoices.length}</p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold">
                $
                {invoices
                  .reduce((sum, i) => sum + i.amount, 0)
                  .toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-emerald-500" />
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Next Payment</p>
              <p className="text-sm font-semibold">{getNextPaymentDate()}</p>
            </div>
            <Calendar className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Recent Invoices</h2>
        </div>
        <div className="divide-y">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between p-4"
            >
              <div>
                <p className="font-medium">{invoice.invoiceNumber}</p>
                <p className="text-sm text-muted-foreground">
                  Submitted: {invoice.submittedDate}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  ${invoice.amount.toLocaleString()}
                </p>
                <p
                  className={`text-sm font-medium ${getStatusColor(invoice.paymentStatus)}`}
                >
                  {invoice.paymentStatus.charAt(0).toUpperCase() +
                    invoice.paymentStatus.slice(1)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
