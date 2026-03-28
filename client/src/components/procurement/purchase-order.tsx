"use client";

import { useState } from "react";
import { Plus, Trash2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";

interface POItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

const poFormSchema = z.object({
  supplier: z.string().min(1, "Supplier name is required"),
  poNumber: z.string().min(1, "PO number is required"),
});

type POFormValues = z.infer<typeof poFormSchema>;

export function PurchaseOrder() {
  const [items, setItems] = useState<POItem[]>([
    { id: "1", description: "Office supplies", quantity: 10, unitPrice: 25.0 },
  ]);
  const [supplier, setSupplier] = useState("ABC Supplies Inc.");

  const form = useForm<POFormValues>({
    resolver: zodResolver(poFormSchema),
    defaultValues: { supplier: "ABC Supplies Inc.", poNumber: "PO-001" },
  });

  const addItem = () => {
    const newId = (Math.max(...items.map((i) => parseInt(i.id))) + 1).toString();
    setItems([
      ...items,
      { id: newId, description: "", quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof POItem, value: any) => {
    setItems(
      items.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  };

  const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const handleGeneratePDF = () => {
    toast.success("PDF généré successfully");
  };

  const onSubmit = (values: POFormValues) => {
    setSupplier(values.supplier);
    toast.success("Bon de commande enregistré");
  };

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="supplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="poNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PO Number</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>

      <div className="border rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Line Items</h3>
          <Button onClick={addItem} size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-1" /> Add Item
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="w-24">Quantity</TableHead>
              <TableHead className="w-24">Unit Price</TableHead>
              <TableHead className="w-24">Total</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Input
                    value={item.description}
                    onChange={(e) =>
                      updateItem(item.id, "description", e.target.value)
                    }
                    className="w-full"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(item.id, "quantity", parseInt(e.target.value) || 0)
                    }
                    min="1"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) =>
                      updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)
                    }
                    step="0.01"
                    min="0"
                  />
                </TableCell>
                <TableCell>${(item.quantity * item.unitPrice).toFixed(2)}</TableCell>
                <TableCell>
                  <Button
                    onClick={() => removeItem(item.id)}
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 text-right space-y-2">
          <div className="text-lg font-bold">Total: ${total.toFixed(2)}</div>
          <Button onClick={handleGeneratePDF} className="w-full">
            <FileDown className="w-4 h-4 mr-2" /> Generate PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
