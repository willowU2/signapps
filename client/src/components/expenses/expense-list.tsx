"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Trash2, Edit2, Download } from "lucide-react";
import type { Expense } from "./expense-form";

interface ExpenseListProps {
  expenses: Expense[];
  onEdit?: (expense: Expense) => void;
  onDelete?: (id: string) => void;
  onDownloadReceipt?: (receiptUrl: string, fileName: string) => void;
}

const STATUS_COLORS: Record<Expense["status"], string> = {
  Draft: "bg-gray-100 text-gray-700",
  Submitted: "bg-blue-100 text-blue-700",
  Approved: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
};

const CATEGORY_COLORS: Record<Expense["category"], string> = {
  Transport: "bg-purple-100 text-purple-700",
  Repas: "bg-orange-100 text-orange-700",
  Hotel: "bg-indigo-100 text-indigo-700",
  Fournitures: "bg-cyan-100 text-cyan-700",
};

export function ExpenseList({
  expenses,
  onEdit,
  onDelete,
  onDownloadReceipt,
}: ExpenseListProps) {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const approved = expenses
    .filter((e) => e.status === "Approved")
    .reduce((sum, e) => sum + e.amount, 0);
  const pending = expenses
    .filter((e) => e.status === "Submitted")
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-bold">{total.toFixed(2)}€</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Approuvé</p>
          <p className="text-2xl font-bold text-green-600">{approved.toFixed(2)}€</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Attente</p>
          <p className="text-2xl font-bold text-blue-600">{pending.toFixed(2)}€</p>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  Aucune note
                </TableCell>
              </TableRow>
            ) : (
              expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    {format(new Date(e.date), "d MMM", { locale: fr })}
                  </TableCell>
                  <TableCell>
                    <Badge className={CATEGORY_COLORS[e.category]}>
                      {e.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {e.description}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {e.amount.toFixed(2)}€
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[e.status]}>
                      {e.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {e.receiptUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onDownloadReceipt?.(
                              e.receiptUrl as string,
                              `receipt-${e.id}`
                            )
                          }
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {e.status === "Draft" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit?.(e)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      {e.status === "Draft" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete?.(e.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
