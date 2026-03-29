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
import { Edit2, Trash2, Send } from "lucide-react";
import type { Invoice, InvoiceStatus } from "./invoice-editor";

interface InvoiceListProps {
  invoices: Invoice[];
  onEdit?: (invoice: Invoice) => void;
  onDelete?: (id: string) => void;
  onSend?: (id: string) => void;
}

const STATUS_STYLES: Record<InvoiceStatus, string> = {
  Draft: "bg-muted text-muted-foreground",
  Sent: "bg-blue-100 text-blue-700",
  Paid: "bg-green-100 text-green-700",
  Overdue: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  Draft: "Brouillon",
  Sent: "Envoyée",
  Paid: "Payée",
  Overdue: "En retard",
};

function calcTTC(invoice: Invoice) {
  const ht = invoice.lineItems.reduce(
    (sum, l) => sum + l.quantity * l.unitPrice,
    0
  );
  return ht * (1 + invoice.tvaRate / 100);
}

export function InvoiceList({
  invoices,
  onEdit,
  onDelete,
  onSend,
}: InvoiceListProps) {
  const totalPaid = invoices
    .filter((i) => i.status === "Paid")
    .reduce((sum, i) => sum + calcTTC(i), 0);
  const totalPending = invoices
    .filter((i) => i.status === "Sent" || i.status === "Overdue")
    .reduce((sum, i) => sum + calcTTC(i), 0);
  const totalAll = invoices.reduce((sum, i) => sum + calcTTC(i), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total facturé</p>
          <p className="text-2xl font-bold">{totalAll.toFixed(2)} €</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Encaissé</p>
          <p className="text-2xl font-bold text-green-600">
            {totalPaid.toFixed(2)} €
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">En attente</p>
          <p className="text-2xl font-bold text-blue-600">
            {totalPending.toFixed(2)} €
          </p>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Facture</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total TTC (€)</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  Aucune facture
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono font-medium">
                    {inv.number}
                  </TableCell>
                  <TableCell>{inv.clientName}</TableCell>
                  <TableCell>
                    {format(new Date(inv.date), "d MMM yyyy", { locale: fr })}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {calcTTC(inv).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_STYLES[inv.status]}>
                      {STATUS_LABELS[inv.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {inv.status === "Draft" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit?.(inv)}
                            title="Modifier"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSend?.(inv.id)}
                            title="Envoyer"
                          >
                            <Send className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete?.(inv.id)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
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
