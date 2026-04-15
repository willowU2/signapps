"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUp } from "lucide-react";
import { toast } from "sonner";

export interface Expense {
  id: string;
  amount: number;
  date: string;
  category: "Transport" | "Repas" | "Hotel" | "Fournitures";
  description: string;
  receiptUrl?: string;
  status: "Draft" | "Submitted" | "Approved" | "Rejected";
}

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (expense: Omit<Expense, "id">) => void;
  initialData?: Partial<Expense>;
}

const CATEGORIES = ["Transport", "Repas", "Hotel", "Fournitures"];
const STATUS_COLORS: Record<Expense["status"], string> = {
  Draft: "bg-muted text-muted-foreground",
  Submitted: "bg-blue-100 text-blue-700",
  Approved: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
};

export function ExpenseForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: ExpenseFormProps) {
  const [formData, setFormData] = useState({
    amount: initialData?.amount?.toString() || "",
    date: initialData?.date || new Date().toISOString().split("T")[0],
    category: (initialData?.category || "Transport") as Expense["category"],
    description: initialData?.description || "",
    receiptUrl: initialData?.receiptUrl || "",
    status: (initialData?.status || "Draft") as Expense["status"],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("Montant invalide");
      return;
    }
    if (!formData.description.trim()) {
      toast.error("Description requise");
      return;
    }

    setIsSubmitting(true);
    try {
      onSubmit?.({
        amount: parseFloat(formData.amount),
        date: formData.date,
        category: formData.category,
        description: formData.description,
        receiptUrl: formData.receiptUrl || undefined,
        status: formData.status,
      });
      toast.success("Note créée");
      onOpenChange(false);
      setFormData({
        amount: "",
        date: new Date().toISOString().split("T")[0],
        category: "Transport",
        description: "",
        receiptUrl: "",
        status: "Draft",
      });
      setFileName("");
    } catch {
      toast.error("Erreur de création");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nouvelle note de frais</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-between items-center">
            <Label>Statut</Label>
            <Badge className={STATUS_COLORS[formData.status]}>
              {formData.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="amount">Montant (€)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, amount: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, date: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="category">Catégorie</Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData((p) => ({
                  ...p,
                  category: value as Expense["category"],
                }))
              }
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Détails..."
              value={formData.description}
              onChange={(e) =>
                setFormData((p) => ({ ...p, description: e.target.value }))
              }
              rows={2}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="receipt">Justificatif</Label>
            <div className="flex items-center gap-2">
              <Input
                id="receipt"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFileName(file.name);
                    const url = URL.createObjectURL(file);
                    setFormData((p) => ({ ...p, receiptUrl: url }));
                  }
                }}
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("receipt")?.click()}
              >
                <FileUp className="mr-2 h-4 w-4" />
                Télécharger
              </Button>
              {fileName && (
                <span className="text-xs text-muted-foreground">
                  {fileName}
                </span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "..." : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
