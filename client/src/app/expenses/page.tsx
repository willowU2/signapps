"use client";

/**
 * FI1 + FI2 — Expense receipt OCR + Approval workflow
 *
 * - "Scanner un recu" opens camera/file upload -> AI OCR pre-fills the form
 * - Expense list with draft / submitted / approved / rejected / paid / reimbursed statuses
 * - Submit for approval, manager view with approve/reject, auto-approve threshold
 * - Category filter, total display, receipt thumbnails, CSV export
 */

import React, { useState, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Download,
  Receipt,
  Filter,
  CreditCard,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { aiApi } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { expensesApi, type ExpenseReport } from "@/lib/api/expenses";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExpenseStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "paid"
  | "reimbursed";
type ExpenseCategory =
  | "Transport"
  | "Repas"
  | "Hotel"
  | "Fournitures"
  | "Autre";

interface Expense {
  id: string;
  amount: number;
  currency: string;
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

const AUTO_APPROVE_THRESHOLD = 50; // euros

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
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    icon: <Send className="w-3 h-3" />,
  },
  approved: {
    label: "Approuve",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  rejected: {
    label: "Rejete",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: <XCircle className="w-3 h-3" />,
  },
  paid: {
    label: "Paye",
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    icon: <DollarSign className="w-3 h-3" />,
  },
  reimbursed: {
    label: "Rembourse",
    color:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: <CreditCard className="w-3 h-3" />,
  },
};

const CATEGORIES: ExpenseCategory[] = [
  "Transport",
  "Repas",
  "Hotel",
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
    currency: r.currency || "EUR",
    date: r.date,
    vendor: r.title,
    category: (r.category as ExpenseCategory) || "Autre",
    description: r.description || "",
    status: r.status as ExpenseStatus,
    receiptDataUrl: r.receipt_url || undefined,
  };
}

// ─── OCR Result ───────────────────────────────────────────────────────────────

interface OcrResult {
  amount?: number;
  date?: string;
  vendor?: string;
  category?: ExpenseCategory;
}

async function extractReceiptData(base64: string): Promise<OcrResult> {
  const prompt = `Tu es un systeme OCR de recus. Analyse ce recu et extrais les donnees au format JSON uniquement.
Reponds UNIQUEMENT avec un objet JSON valide, sans markdown ni explication.
Format attendu: {"amount": 42.50, "date": "2026-03-30", "vendor": "Nom du vendeur", "category": "Transport|Repas|Hotel|Fournitures|Autre"}
Si une information est absente, omets le champ.
Donnees du recu (base64): [IMAGE FOURNIE]`;

  try {
    const res = await aiApi.chat(prompt, {
      enableTools: false,
      includesSources: false,
    });
    const answer = (res.data as { answer?: string })?.answer ?? "";
    const match = answer.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {
    /* OCR is best-effort */
  }
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
    currency: string;
    date: string;
    vendor: string;
    category: ExpenseCategory;
    description: string;
    receiptDataUrl: string;
  }>({
    amount: initial?.amount?.toString() ?? "",
    currency: initial?.currency ?? "EUR",
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
        toast.success("Recu analyse par IA");
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Erreur d'analyse du recu");
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
      currency: form.currency,
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
                  cours...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  <Sparkles className="w-4 h-4 mr-1 text-primary" /> Scanner un
                  recu (OCR IA)
                </>
              )}
            </Button>
            {form.receiptDataUrl &&
              form.receiptDataUrl.startsWith("data:image") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.receiptDataUrl}
                  alt="Recu"
                  className="mt-2 max-h-32 rounded border object-contain mx-auto"
                />
              )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Montant</Label>
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
              <Label>Devise</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CHF">CHF</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                </SelectContent>
              </Select>
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
            <Label>Categorie</Label>
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
              placeholder="Details..."
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

// ─── Receipt Preview Dialog ──────────────────────────────────────────────────

function ReceiptPreview({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recu</DialogTitle>
        </DialogHeader>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Recu"
          className="max-h-[60vh] rounded border object-contain mx-auto"
        />
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
          <DialogTitle>Decision d'approbation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border p-3 bg-muted/30 space-y-1 text-sm">
            <p>
              <span className="font-medium">Fournisseur:</span>{" "}
              {expense.vendor || "-"}
            </p>
            <p>
              <span className="font-medium">Montant:</span>{" "}
              {expense.amount.toFixed(2)} {expense.currency}
            </p>
            <p>
              <span className="font-medium">Date:</span> {expense.date}
            </p>
            <p>
              <span className="font-medium">Categorie:</span> {expense.category}
            </p>
            {expense.description && (
              <p>
                <span className="font-medium">Description:</span>{" "}
                {expense.description}
              </p>
            )}
            {expense.receiptDataUrl && (
              <div className="pt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={expense.receiptDataUrl}
                  alt="Recu"
                  className="max-h-24 rounded border object-contain"
                />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label>Commentaire (optionnel)</Label>
            <Textarea
              placeholder="Raison de la decision..."
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
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<Expense | null>(null);
  const [filterStatus, setFilterStatus] = useState<ExpenseStatus | "all">(
    "all",
  );
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "all">(
    "all",
  );
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  // ─── React Query ────────────────────────────────────────────────────────────

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: async () => {
      try {
        const res = await expensesApi.list();
        return (res.data || []).map(toExpense);
      } catch {
        return [];
      }
    },
    refetchInterval: 30000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
  };

  const handleSave = async (data: Omit<Expense, "id" | "status">) => {
    try {
      await expensesApi.create({
        title: data.vendor || "Sans titre",
        description: data.description,
        amount: Math.round(data.amount * 100), // euros to cents
        currency: data.currency,
        category: data.category,
        date: data.date,
        receipt_url: data.receiptDataUrl,
      });
      toast.success("Note de frais creee");
      invalidate();
    } catch {
      toast.error("Erreur lors de la creation");
    }
  };

  const handleSubmit = async (id: string) => {
    try {
      await expensesApi.submitForApproval(id);
      toast.success("Note envoyee pour approbation");
      invalidate();
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
        decision === "approved" ? "Note approuvee" : "Note rejetee",
      );
      invalidate();
    } catch {
      toast.error("Erreur lors de la decision");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await expensesApi.delete(id);
      toast.success("Note supprimee");
      invalidate();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await expensesApi.markPaid(id);
      toast.success("Note marquee comme payee");
      invalidate();
    } catch {
      toast.error("Erreur lors du marquage");
    }
  };

  // ─── Filtering ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = expenses;
    if (filterStatus !== "all") {
      result = result.filter((e) => e.status === filterStatus);
    }
    if (filterCategory !== "all") {
      result = result.filter((e) => e.category === filterCategory);
    }
    return result;
  }, [expenses, filterStatus, filterCategory]);

  // ─── Totals ─────────────────────────────────────────────────────────────────

  const totals = useMemo(
    () => ({
      total: expenses.reduce((s, e) => s + e.amount, 0),
      approved: expenses
        .filter(
          (e) =>
            e.status === "approved" ||
            e.status === "paid" ||
            e.status === "reimbursed",
        )
        .reduce((s, e) => s + e.amount, 0),
      pending: expenses
        .filter((e) => e.status === "submitted")
        .reduce((s, e) => s + e.amount, 0),
      draft: expenses
        .filter((e) => e.status === "draft")
        .reduce((s, e) => s + e.amount, 0),
    }),
    [expenses],
  );

  // ─── CSV Export ─────────────────────────────────────────────────────────────

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.info("Aucune note a exporter.");
      return;
    }
    const header =
      "Date,Fournisseur,Categorie,Description,Montant,Devise,Statut\n";
    const rows = filtered
      .map(
        (e) =>
          `${e.date},"${e.vendor}","${e.category}","${e.description}",${e.amount.toFixed(2)},${e.currency},${STATUS_CONFIG[e.status].label}`,
      )
      .join("\n");
    const totalRow = `\n,,,,${filtered.reduce((s, e) => s + e.amount, 0).toFixed(2)},,"TOTAL"`;
    const blob = new Blob([header + rows + totalRow], {
      type: "text/csv;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `notes-frais-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("Export CSV telecharge.");
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            Notes de frais
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Auto-approuve si montant &lt; {AUTO_APPROVE_THRESHOLD}EUR
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle note
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total", value: totals.total, color: "" },
          {
            label: "Approuve",
            value: totals.approved,
            color: "text-green-600 dark:text-green-400",
          },
          {
            label: "En attente",
            value: totals.pending,
            color: "text-blue-600 dark:text-blue-400",
          },
          {
            label: "Brouillon",
            value: totals.draft,
            color: "text-muted-foreground",
          },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>
                {s.value.toFixed(2)} EUR
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap items-center">
        {/* Status filter */}
        <div className="flex gap-1.5 flex-wrap">
          {(
            [
              "all",
              "draft",
              "submitted",
              "approved",
              "rejected",
              "paid",
              "reimbursed",
            ] as const
          ).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filterStatus === s ? "default" : "outline"}
              onClick={() => setFilterStatus(s)}
              className="h-7 text-xs"
            >
              {s === "all" ? "Tous" : STATUS_CONFIG[s].label}
              {s !== "all" && (
                <span className="ml-1 opacity-60">
                  ({expenses.filter((e) => e.status === s).length})
                </span>
              )}
            </Button>
          ))}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Category filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select
            value={filterCategory}
            onValueChange={(v) =>
              setFilterCategory(v as ExpenseCategory | "all")
            }
          >
            <SelectTrigger className="h-7 w-[140px] text-xs">
              <SelectValue placeholder="Categorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtered total */}
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} note(s) - Total:{" "}
          <span className="font-semibold text-foreground">
            {filtered.reduce((s, e) => s + e.amount, 0).toFixed(2)} EUR
          </span>
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">Recu</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Fournisseur</TableHead>
                <TableHead>Categorie</TableHead>
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
                    colSpan={8}
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
                      {/* Receipt thumbnail */}
                      <TableCell>
                        {e.receiptDataUrl ? (
                          <button
                            onClick={() =>
                              setReceiptPreview(e.receiptDataUrl || null)
                            }
                            className="relative group"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={e.receiptDataUrl}
                              alt="Recu"
                              className="w-8 h-8 rounded border object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye className="w-3 h-3 text-white" />
                            </div>
                          </button>
                        ) : (
                          <div className="w-8 h-8 rounded border border-dashed flex items-center justify-center">
                            <Receipt className="w-3 h-3 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(e.date), "d MMM", { locale: fr })}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate">
                        {e.vendor || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{e.category}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                        {e.description || "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">
                        {e.amount.toFixed(2)} {e.currency}
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
                              title="Soumettre"
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          )}
                          {e.status === "submitted" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setApprovalTarget(e)}
                              title="Decider"
                            >
                              <AlertCircle className="w-4 h-4 text-blue-500" />
                            </Button>
                          )}
                          {e.status === "approved" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMarkPaid(e.id)}
                              title="Marquer paye"
                            >
                              <DollarSign className="w-4 h-4 text-purple-500" />
                            </Button>
                          )}
                          {e.status === "draft" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(e.id)}
                              title="Supprimer"
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
      )}

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

      {receiptPreview && (
        <ReceiptPreview
          url={receiptPreview}
          onClose={() => setReceiptPreview(null)}
        />
      )}
    </div>
  );
}
