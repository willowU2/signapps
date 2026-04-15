"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export type TvaRate = 0 | 5.5 | 10 | 20;
export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Overdue";

export interface Invoice {
  id: string;
  number: string;
  clientName: string;
  date: string;
  lineItems: LineItem[];
  tvaRate: TvaRate;
  notes: string;
  status: InvoiceStatus;
}

interface InvoiceEditorProps {
  initialData?: Partial<Invoice>;
  nextNumber?: string;
  onSubmit?: (invoice: Omit<Invoice, "id">) => void;
  onCancel?: () => void;
}

const TVA_RATES: TvaRate[] = [0, 5.5, 10, 20];

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function calcHT(items: LineItem[]) {
  return items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
}

export function InvoiceEditor({
  initialData,
  nextNumber = "FAC-0001",
  onSubmit,
  onCancel,
}: InvoiceEditorProps) {
  const [clientName, setClientName] = useState(initialData?.clientName ?? "");
  const [number] = useState(initialData?.number ?? nextNumber);
  const [date, setDate] = useState(
    initialData?.date ?? new Date().toISOString().split("T")[0],
  );
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initialData?.lineItems ?? [
      { id: generateId(), description: "", quantity: 1, unitPrice: 0 },
    ],
  );
  const [tvaRate, setTvaRate] = useState<TvaRate>(initialData?.tvaRate ?? 20);
  const [notes, setNotes] = useState(initialData?.notes ?? "");

  const totalHT = calcHT(lineItems);
  const totalTVA = totalHT * (tvaRate / 100);
  const totalTTC = totalHT + totalTVA;

  function addLine() {
    setLineItems((prev) => [
      ...prev,
      { id: generateId(), description: "", quantity: 1, unitPrice: 0 },
    ]);
  }

  function removeLine(id: string) {
    setLineItems((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLine(
    id: string,
    field: keyof LineItem,
    value: string | number,
  ) {
    setLineItems((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) {
      toast.error("Nom du client requis");
      return;
    }
    if (lineItems.length === 0) {
      toast.error("Au moins une ligne requise");
      return;
    }
    if (lineItems.some((l) => !l.description.trim())) {
      toast.error("Toutes les lignes doivent avoir une description");
      return;
    }
    onSubmit?.({
      number,
      clientName: clientName.trim(),
      date,
      lineItems,
      tvaRate,
      notes,
      status: "Draft",
    });
    toast.success("Facture enregistrée");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label htmlFor="client">Client</Label>
          <Input
            id="client"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Nom du client"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="number">N° Facture</Label>
          <Input id="number" value={number} readOnly className="bg-muted" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/2">Description</TableHead>
              <TableHead className="w-24 text-right">Qté</TableHead>
              <TableHead className="w-32 text-right">PU HT (€)</TableHead>
              <TableHead className="w-32 text-right">Total HT (€)</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <Input
                    value={line.description}
                    onChange={(e) =>
                      updateLine(line.id, "description", e.target.value)
                    }
                    placeholder="Description"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(
                        line.id,
                        "quantity",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="text-right"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={line.unitPrice}
                    onChange={(e) =>
                      updateLine(
                        line.id,
                        "unitPrice",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="text-right"
                  />
                </TableCell>
                <TableCell className="text-right font-medium">
                  {(line.quantity * line.unitPrice).toFixed(2)}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLine(line.id)}
                    disabled={lineItems.length === 1}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-2 border-t">
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une ligne
          </Button>
        </div>
      </Card>

      <div className="flex justify-between items-start gap-6">
        <div className="flex-1 space-y-1">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Conditions de paiement, mentions légales..."
            rows={3}
          />
        </div>

        <Card className="p-4 w-64 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total HT</span>
            <span className="font-medium">{totalHT.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-sm text-muted-foreground">TVA</span>
            <div className="flex items-center gap-2">
              <Select
                value={String(tvaRate)}
                onValueChange={(v) => setTvaRate(parseFloat(v) as TvaRate)}
              >
                <SelectTrigger className="h-7 w-20 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TVA_RATES.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {r}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm font-medium w-20 text-right">
                {totalTVA.toFixed(2)} €
              </span>
            </div>
          </div>
          <div className="flex justify-between border-t pt-2 font-bold">
            <span>Total TTC</span>
            <span>{totalTTC.toFixed(2)} €</span>
          </div>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button type="submit">Enregistrer</Button>
      </div>
    </form>
  );
}
