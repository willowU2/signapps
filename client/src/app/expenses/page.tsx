"use client";

/**
 * FI1 + FI2 — Expense receipt OCR + Approval workflow
 *
 * - "Scanner un reçu" opens camera/file upload → AI OCR pre-fills the form
 * - Expense list with draft / submitted / approved / paid statuses
 * - Submit for approval, manager view with approve/reject, auto-approve threshold
 * - Approval chain status display
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Camera,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Plus,
  Loader2,
  Sparkles,
  Send,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { aiApi } from "@/lib/api";
import { expensesApi, type ExpenseReport } from "@/lib/api/expenses";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExpenseStatus = "draft" | "submitted" | "approved" | "rejected" | "paid";
type ExpenseCategory =
  | "Transport"
  | "Repas"
  | "Hôtel"
  | "Fournitures"
  | "Autre";

interface Expense {
  id: string;
  amount: number;
  date: string;
  vendor: string;
  category: ExpenseCategory;
  description: string;
  receiptDataUrl?: string;
  status: ExpenseStatus;
  approvalComment?: string;
  submittedAt?: string;
  approvedAt?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTO_APPROVE_THRESHOLD = 50; // €

const STATUS_CONFIG: Record<
  ExpenseStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  draft: {
    label: "Brouillon",
    color: "bg-muted text-muted-foreground",
    icon: <Clock className="w-3 h-3" />,
  },
  submitted: {
    label: "En attente",
    color: "bg-blue-100 text-blue-700",
    icon: <Send className="w-3 h-3" />,
  },
  approved: {
    label: "Approuvé",
    color: "bg-green-100 text-green-700",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  rejected: {
    label: "Rejeté",
    color: "bg-red-100 text-red-700",
    icon: <XCircle className="w-3 h-3" />,
  },
  paid: {
    label: "Payé",
    color: "bg-purple-100 text-purple-700",
    icon: <DollarSign className="w-3 h-3" />,
  },
};

const CATEGORIES: ExpenseCategory[] = [
  "Transport",
  "Repas",
  "Hôtel",
  "Fournitures",
  "Autre",
];

// ─── API helpers ──────────────────────────────────────────────────────────────

/** Convert cents from backend to euros for display */
function centsToEuros(cents: number): number {
  return cents / 100;
}

/** Convert backend ExpenseReport to local Expense shape */
function toExpense(r: ExpenseReport): Expense {
  return {
    id: r.id,
    amount: centsToEuros(r.amount),
    date: r.date,
    vendor: r.title,
    category: (r.category as ExpenseCategory) || "Autre",
    description: r.description || "",
    status: r.status as ExpenseStatus,
    receiptDataUrl: r.receipt_url || undefined,
  };
}

async function fetchExpenses(): Promise<Expense[]> {
  try {
    const res = await expensesApi.list();
    return (res.data || []).map(toExpense);
  } catch {
    return [];
  }
}

// ─── OCR Result ───────────────────────────────────────────────────────────────

interface OcrResult {
  amount?: number;
  date?: string;
  vendor?: string;
  category?: ExpenseCategory;
}

async function extractReceiptData(base64: string): Promise<OcrResult> {
  const prompt = `Tu es un système OCR de reçus. Analyse ce reçu et extrais les données au format JSON uniquement.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni explication.
Format attendu: {"amount": 42.50, "date": "2026-03-30", "vendor": "Nom du vendeur", "category": "Transport|Repas|Hôtel|Fournitures|Autre"}
Si une information est absente, omets le champ.
Données du reçu (base64): [IMAGE FOURNIE]`;

  try {
    const res = await aiApi.chat(prompt, {
      enableTools: false,
      includesSources: false,
    });
    const answer = (res.data as { answer?: string })?.answer ?? "";
    const match = answer.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return {};
}

// ─── Expense Form Dialog ──────────────────────────────────────────────────────

interface ExpenseFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (expense: Omit<Expense, "id" | "status">) => void;
  initial?: Partial<Expense>;
}

function ExpenseFormDialog({
  open,
  onClose,
  onSave,
  initial,
}: ExpenseFormDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [form, setForm] = useState<{
    amount: string;
    date: string;
    vendor: string;
    category: ExpenseCategory;
    description: string;
    receiptDataUrl: string;
  }>({
    amount: initial?.amount?.toString() ?? "",
    date: initial?.date ?? new Date().toISOString().split("T")[0],
    vendor: initial?.vendor ?? "",
    category: (initial?.category as ExpenseCategory) ?? "Autre",
    description: initial?.description ?? "",
    receiptDataUrl: initial?.receiptDataUrl ?? "",
  });

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        setForm((f) => ({ ...f, receiptDataUrl: base64 }));
        const ocr = await extractReceiptData(base64);
        setForm((f) => ({
          ...f,
          amount: ocr.amount != null ? ocr.amount.toString() : f.amount,
          date: ocr.date ?? f.date,
          vendor: ocr.vendor ?? f.vendor,
          category: ocr.category ?? f.category,
        }));
        toast.success("Reçu analysé par IA");
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Erreur d'analyse du reçu");
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error("Montant invalide");
      return;
    }
    onSave({
      amount: parseFloat(form.amount),
      date: form.date,
      vendor: form.vendor,
      category: form.category,
      description: form.description,
      receiptDataUrl: form.receiptDataUrl || undefined,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle note de frais</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Receipt scan */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              onChange={handleScan}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              onClick={() => fileRef.current?.click()}
              disabled={scanning}
            >
              {scanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyse en
                  cours…
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  <Sparkles className="w-4 h-4 mr-1 text-primary" /> Scanner un
                  reçu (OCR IA)
                </>
              )}
            </Button>
            {form.receiptDataUrl &&
              form.receiptDataUrl.startsWith("data:image") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.receiptDataUrl}
                  alt="Reçu"
                  className="mt-2 max-h-32 rounded border object-contain mx-auto"
                />
              )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Montant (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Fournisseur</Label>
            <Input
              placeholder="Nom du vendeur"
              value={form.vendor}
              onChange={(e) =>
                setForm((f) => ({ ...f, vendor: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1">
            <Label>Catégorie</Label>
            <Select
              value={form.category}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, category: v as ExpenseCategory }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea
              placeholder="Détails…"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit">Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Approval Dialog ──────────────────────────────────────────────────────────

interface ApprovalDialogProps {
  expense: Expense | null;
  onClose: () => void;
  onDecision: (
    id: string,
    decision: "approved" | "rejected",
    comment: string,
  ) => void;
}

function ApprovalDialog({ expense, onClose, onDecision }: ApprovalDialogProps) {
  const [comment, setComment] = useState("");
  if (!expense) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Décision d'approbation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm">
            <p>
              <span className="font-medium">Fournisseur:</span>{" "}
              {expense.vendor || "—"}
            </p>
            <p>
              <span className="font-medium">Montant:</span>{" "}
              {expense.amount.toFixed(2)} €
            </p>
            <p>
              <span className="font-medium">Date:</span> {expense.date}
            </p>
            <p>
              <span className="font-medium">Catégorie:</span> {expense.category}
            </p>
            {expense.description && (
              <p>
                <span className="font-medium">Description:</span>{" "}
                {expense.description}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Commentaire (optionnel)</Label>
            <Textarea
              placeholder="Raison de la décision…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={() => onDecision(expense.id, "rejected", comment)}
          >
            <XCircle className="w-4 h-4 mr-1" /> Rejeter
          </Button>
          <Button onClick={() => onDecision(expense.id, "approved", comment)}>
            <CheckCircle2 className="w-4 h-4 mr-1" /> Approuver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<Expense | null>(null);
  const [filterStatus, setFilterStatus] = useState<ExpenseStatus | "all">(
    "all",
  );

  const reload = useCallback(async () => {
    const data = await fetchExpenses();
    setExpenses(data);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleSave = async (data: Omit<Expense, "id" | "status">) => {
    try {
      await expensesApi.create({
        title: data.vendor || "Sans titre",
        description: data.description,
        amount: Math.round(data.amount * 100), // euros to cents
        category: data.category,
        date: data.date,
        receipt_url: data.receiptDataUrl,
      });
      toast.success("Note de frais créée");
      reload();
    } catch {
      toast.error("Erreur lors de la création");
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      await expensesApi.submitForApproval(id);
      toast.success("Note envoyée pour approbation");
      reload();
    } catch {
      toast.error("Erreur lors de la soumission");
    }
  };

  const handleDecision = async (
    id: string,
    decision: "approved" | "rejected",
    comment: string,
  ) => {
    try {
      if (decision === "approved") {
        await expensesApi.approve(id, comment);
      } else {
        await expensesApi.reject(id, comment);
      }
      setApprovalTarget(null);
      toast.success(
        decision === "approved" ? "Note approuvée" : "Note rejetée",
      );
      reload();
    } catch {
      toast.error("Erreur lors de la décision");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await expensesApi.delete(id);
      toast.success("Note supprimée");
      reload();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const filtered =
    filterStatus === "all"
      ? expenses
      : expenses.filter((e) => e.status === filterStatus);

  const totals = {
    total: expenses.reduce((s, e) => s + e.amount, 0),
    approved: expenses
      .filter((e) => e.status === "approved")
      .reduce((s, e) => s + e.amount, 0),
    pending: expenses
      .filter((e) => e.status === "submitted")
      .reduce((s, e) => s + e.amount, 0),
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notes de frais</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Auto-approuvé si montant &lt; {AUTO_APPROVE_THRESHOLD}€
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle note
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: totals.total, color: "" },
          {
            label: "Approuvé",
            value: totals.approved,
            color: "text-green-600",
          },
          {
            label: "En attente",
            value: totals.pending,
            color: "text-blue-600",
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>
                {s.value.toFixed(2)} €
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(
          ["all", "draft", "submitted", "approved", "rejected", "paid"] as const
        ).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filterStatus === s ? "default" : "outline"}
            onClick={() => setFilterStatus(s)}
          >
            {s === "all" ? "Tous" : STATUS_CONFIG[s].label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-10 text-muted-foreground"
                >
                  Aucune note de frais
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => {
                const cfg = STATUS_CONFIG[e.status];
                return (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(e.date), "d MMM", { locale: fr })}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate">
                      {e.vendor || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{e.category}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                      {e.description || "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {e.amount.toFixed(2)} €
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${cfg.color} flex items-center gap-1 w-fit`}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </Badge>
                      {e.approvalComment && (
                        <p
                          className="text-xs text-muted-foreground mt-0.5 truncate max-w-[120px]"
                          title={e.approvalComment}
                        >
                          {e.approvalComment}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {e.status === "draft" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSubmit(e.id)}
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                        {e.status === "submitted" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setApprovalTarget(e)}
                          >
                            <AlertCircle className="w-4 h-4 text-blue-500" />
                          </Button>
                        )}
                        {e.status === "draft" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(e.id)}
                          >
                            <XCircle className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <ExpenseFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
      />

      <ApprovalDialog
        expense={approvalTarget}
        onClose={() => setApprovalTarget(null)}
        onDecision={handleDecision}
      />
    </div>
  );
}
