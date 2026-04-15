"use client";

import { useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { AppLayout } from "@/components/layout/app-layout";
import {
  billingApi,
  type BillingUsage,
  type Invoice,
  type InvoiceStatus,
  type BillingPlan,
  type CreateInvoiceRequest,
  type CreatePlanRequest,
} from "@/lib/api/billing";
import { OverdueInvoicesCrmFlag } from "@/components/interop/OverdueInvoicesCrmFlag";
import { InvoiceEmailSender } from "@/components/interop/InvoiceEmailSender";
import { localInvoicesApi } from "@/lib/api/interop";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-muted text-muted-foreground" },
  sent: { label: "Envoyée", color: "bg-blue-500/15 text-blue-500" },
  paid: { label: "Payée", color: "bg-green-500/15 text-green-500" },
  overdue: { label: "En retard", color: "bg-red-500/15 text-red-500" },
};

function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const exp = Math.floor(Math.log(bytes) / Math.log(1024));
  const idx = Math.min(exp, units.length - 1);
  const val = bytes / Math.pow(1024, idx);
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  colorClass = "text-foreground",
}: {
  label: string;
  value: string;
  sub?: string;
  colorClass?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-1 shadow-sm">
      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </span>
      <span className={`text-2xl font-bold ${colorClass}`}>{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function PlanCard() {
  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            Plan actuel
          </span>
          <h2 className="mt-1 text-2xl font-bold">Free Tier</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Hébergement local · Pas de frais mensuels
          </p>
        </div>
        <span className="rounded-full bg-green-500/15 text-green-600 text-xs font-semibold px-3 py-1">
          Actif
        </span>
      </div>

      <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
        {[
          "Stockage jusqu'à 5 Go",
          "Utilisateurs illimités en local",
          "Tous les modules SignApps inclus",
          "Support communautaire",
        ].map((f) => (
          <li key={f} className="flex items-center gap-2">
            <CheckIcon />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-green-500 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ─── Invoice Dialog ───────────────────────────────────────────────────────────

interface InvoiceDialogProps {
  open: boolean;
  invoice?: Invoice | null;
  onClose: () => void;
  onSaved: (inv: Invoice) => void;
}

function InvoiceDialog({
  open,
  invoice,
  onClose,
  onSaved,
}: InvoiceDialogProps) {
  const isEdit = !!invoice;
  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoice) {
      setClientName(
        (invoice.metadata?.client_name as string) || invoice.client_name || "",
      );
      setAmount(String((invoice.amount_cents / 100).toFixed(2)));
      setCurrency(invoice.currency || "EUR");
      setDueDate(invoice.due_at ? invoice.due_at.substring(0, 10) : "");
      setStatus(invoice.status || "draft");
    } else {
      setClientName("");
      setAmount("");
      setCurrency("EUR");
      setDueDate("");
      setStatus("draft");
    }
  }, [invoice, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error("Montant invalide");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && invoice) {
        const res = await billingApi.updateInvoice(invoice.id, {
          amount_cents: amountCents,
          currency,
          due_at: dueDate ? new Date(dueDate).toISOString() : undefined,
          status,
          metadata: { ...invoice.metadata, client_name: clientName },
        });
        onSaved(res.data);
        toast.success("Facture mise à jour");
      } else {
        const number = `INV-${Date.now()}`;
        const payload: CreateInvoiceRequest = {
          number,
          amount_cents: amountCents,
          currency,
          due_at: dueDate ? new Date(dueDate).toISOString() : undefined,
          metadata: { client_name: clientName },
        };
        const res = await billingApi.createInvoice(payload);
        onSaved(res.data);
        toast.success("Facture créée");
      }
      onClose();
    } catch {
      toast.error(
        isEdit
          ? "Impossible de modifier la facture"
          : "Impossible de créer la facture",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-md p-6 mx-4">
        <h2 className="text-lg font-semibold mb-4">
          {isEdit ? "Modifier la facture" : "Nouvelle facture"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nom du client</label>
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Acme Corp"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Montant (TTC)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Devise</label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Date d&apos;échéance</label>
            <input
              type="date"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          {isEdit && (
            <div>
              <label className="text-sm font-medium">Statut</label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="draft">Brouillon</option>
                <option value="sent">Envoyée</option>
                <option value="paid">Payée</option>
                <option value="overdue">En retard</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border text-sm hover:bg-accent transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving
                ? "Enregistrement..."
                : isEdit
                  ? "Mettre à jour"
                  : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function ConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-sm p-6 mx-4">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground mb-5">{description}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border text-sm hover:bg-accent transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Suppression..." : "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Plan Dialog ──────────────────────────────────────────────────────────────

interface PlanDialogProps {
  open: boolean;
  plan?: BillingPlan | null;
  onClose: () => void;
  onSaved: (plan: BillingPlan) => void;
}

function PlanDialog({ open, plan, onClose, onSaved }: PlanDialogProps) {
  const isEdit = !!plan;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceCents, setPriceCents] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setDescription(plan.description || "");
      setPriceCents(String((plan.price_cents / 100).toFixed(2)));
      setCurrency(plan.currency || "EUR");
    } else {
      setName("");
      setDescription("");
      setPriceCents("");
      setCurrency("EUR");
    }
  }, [plan, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(parseFloat(priceCents) * 100);
    if (isNaN(cents) || cents < 0) {
      toast.error("Prix invalide");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && plan) {
        const res = await billingApi.updatePlan(plan.id, {
          name,
          description: description || undefined,
          price_cents: cents,
          currency,
        });
        onSaved(res.data);
        toast.success("Plan mis à jour");
      } else {
        const payload: CreatePlanRequest = {
          name,
          description: description || undefined,
          price_cents: cents,
          currency,
        };
        const res = await billingApi.createPlan(payload);
        onSaved(res.data);
        toast.success("Plan créé");
      }
      onClose();
    } catch {
      toast.error(
        isEdit
          ? "Impossible de modifier le plan"
          : "Impossible de créer le plan",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-md p-6 mx-4">
        <h2 className="text-lg font-semibold mb-4">
          {isEdit ? "Modifier le plan" : "Nouveau plan"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nom du plan</label>
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pro"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <input
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du plan"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Prix mensuel</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={priceCents}
                onChange={(e) => setPriceCents(e.target.value)}
                placeholder="29.99"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Devise</label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border text-sm hover:bg-accent transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving
                ? "Enregistrement..."
                : isEdit
                  ? "Mettre à jour"
                  : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Plans Tab ────────────────────────────────────────────────────────────────

function PlansTab() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [planDialog, setPlanDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BillingPlan | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    billingApi
      .listPlans()
      .then((res) => setPlans(res.data ?? []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSaved = (plan: BillingPlan) => {
    setPlans((prev) => {
      const idx = prev.findIndex((p) => p.id === plan.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = plan;
        return next;
      }
      return [plan, ...prev];
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await billingApi.deletePlan(deleteTarget.id);
      setPlans((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast.success("Plan supprimé");
      setDeleteTarget(null);
    } catch {
      toast.error("Impossible de supprimer le plan");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Plans tarifaires
        </h2>
        <button
          onClick={() => {
            setEditingPlan(null);
            setPlanDialog(true);
          }}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          + Nouveau plan
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : plans.length === 0 ? (
        <EmptyState
          label="Aucun plan pour le moment"
          hint="Créez votre premier plan tarifaire"
        />
      ) : (
        <div className="border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                  Nom
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                  Description
                </th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">
                  Prix / mois
                </th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
                  Statut
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr
                  key={plan.id}
                  className="border-t hover:bg-accent/40 transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{plan.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {plan.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(plan.price_cents / 100, plan.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        plan.is_active
                          ? "bg-green-500/15 text-green-500"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {plan.is_active ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => {
                          setEditingPlan(plan);
                          setPlanDialog(true);
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => setDeleteTarget(plan)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PlanDialog
        open={planDialog}
        plan={editingPlan}
        onClose={() => {
          setPlanDialog(false);
          setEditingPlan(null);
        }}
        onSaved={handleSaved}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer ce plan ?"
        description={`Le plan « ${deleteTarget?.name} » sera définitivement supprimé.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "invoices" | "quotes" | "plans";

export default function BillingPage() {
  usePageTitle("Facturation");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("invoices");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">(
    "all",
  );

  // Invoice dialog state
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.allSettled([billingApi.listInvoices(), billingApi.getUsage()]).then(
      ([invoicesResult, usageResult]) => {
        if (cancelled) return;

        if (invoicesResult.status === "fulfilled") {
          setInvoices(invoicesResult.value.data ?? []);
        } else {
          setInvoices([]);
        }

        if (usageResult.status === "fulfilled") {
          setUsage(usageResult.value.data ?? null);
        }

        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  // Derived stats
  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.total_ttc, 0);

  const countOverdue = invoices.filter((i) => i.status === "overdue").length;

  const filtered = invoices.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    return true;
  });

  const handleInvoiceSaved = (inv: Invoice) => {
    setInvoices((prev) => {
      const idx = prev.findIndex((i) => i.id === inv.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = inv;
        return next;
      }
      return [inv, ...prev];
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await billingApi.deleteInvoice(deleteTarget.id);
      setInvoices((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      toast.success("Facture supprimée");
      setDeleteTarget(null);
    } catch {
      toast.error("Impossible de supprimer la facture");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="w-full space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Facturation</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gérez vos factures et suivez votre utilisation
            </p>
          </div>
          <button
            onClick={() => {
              setEditingInvoice(null);
              setInvoiceDialog(true);
            }}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            + Nouvelle facture
          </button>
        </div>

        {/* Plan + Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <PlanCard />
          </div>

          <StatCard
            label="Total encaissé"
            value={formatCurrency(totalPaid)}
            sub="Toutes factures payées"
            colorClass="text-green-600"
          />

          <StatCard
            label="Factures en retard"
            value={String(countOverdue)}
            sub={countOverdue > 0 ? "Action requise" : "Rien à signaler"}
            colorClass={countOverdue > 0 ? "text-red-500" : "text-foreground"}
          />
        </div>

        {/* Usage cards — live data from billing API */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Utilisation
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UsageCard
              label="Stockage"
              used={usage ? formatBytes(usage.storage_used_bytes) : "—"}
              limit={
                usage && usage.storage_limit_bytes > 0
                  ? formatBytes(usage.storage_limit_bytes)
                  : "5 Go"
              }
              pct={
                usage && usage.storage_limit_bytes > 0
                  ? Math.round(
                      (usage.storage_used_bytes / usage.storage_limit_bytes) *
                        100,
                    )
                  : 0
              }
            />
            <UsageCard
              label="Appels API ce mois"
              used={usage ? String(usage.api_calls_this_month) : "—"}
              limit={
                usage && usage.api_calls_limit > 0
                  ? String(usage.api_calls_limit)
                  : "Illimité"
              }
              pct={
                usage && usage.api_calls_limit > 0
                  ? Math.round(
                      (usage.api_calls_this_month / usage.api_calls_limit) *
                        100,
                    )
                  : 0
              }
            />
            <UsageCard
              label="Utilisateurs actifs"
              used={usage ? String(usage.active_users) : "—"}
              limit={
                usage && usage.user_limit > 0
                  ? String(usage.user_limit)
                  : "Illimité"
              }
              pct={
                usage && usage.user_limit > 0
                  ? Math.round((usage.active_users / usage.user_limit) * 100)
                  : 0
              }
            />
          </div>
        </section>

        {/* Feature 11: Overdue invoices with CRM flag */}
        <section>
          <OverdueInvoicesCrmFlag />
        </section>

        {/* Tabs section */}
        <section>
          {/* Tabs */}
          <div className="flex items-center gap-2 mb-4">
            {(["invoices", "quotes", "plans"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tab === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {t === "invoices"
                  ? "Factures"
                  : t === "quotes"
                    ? "Devis"
                    : "Plans"}
              </button>
            ))}

            {/* Status filter — only shown for invoices */}
            {tab === "invoices" && (
              <div className="ml-auto flex gap-2">
                {(["all", "sent", "paid", "overdue", "draft"] as const).map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        statusFilter === s
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {s === "all"
                        ? "Toutes"
                        : (STATUS_META[s as InvoiceStatus]?.label ?? s)}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>

          {tab === "plans" ? (
            <PlansTab />
          ) : loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <ErrorBanner message={error} />
          ) : filtered.length === 0 ? (
            <EmptyState
              label={
                tab === "invoices"
                  ? statusFilter !== "all"
                    ? `Aucune facture avec le statut « ${STATUS_META[statusFilter as InvoiceStatus]?.label} »`
                    : "Aucune facture pour le moment"
                  : "Aucun devis pour le moment"
              }
              hint={
                tab === "invoices"
                  ? "Créez votre première facture pour commencer"
                  : "Créez votre premier devis pour commencer"
              }
            />
          ) : (
            <InvoiceTable
              invoices={filtered}
              onEdit={(inv) => {
                setEditingInvoice(inv);
                setInvoiceDialog(true);
              }}
              onDelete={setDeleteTarget}
            />
          )}
        </section>
      </div>

      {/* Dialogs */}
      <InvoiceDialog
        open={invoiceDialog}
        invoice={editingInvoice}
        onClose={() => {
          setInvoiceDialog(false);
          setEditingInvoice(null);
        }}
        onSaved={handleInvoiceSaved}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer cette facture ?"
        description={`La facture ${deleteTarget?.number} sera définitivement supprimée. Seules les factures en brouillon peuvent être supprimées.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </AppLayout>
  );
}

// ─── Invoice Table ────────────────────────────────────────────────────────────

function InvoiceTable({
  invoices,
  onEdit,
  onDelete,
}: {
  invoices: Invoice[];
  onEdit: (inv: Invoice) => void;
  onDelete: (inv: Invoice) => void;
}) {
  return (
    <div className="border rounded-xl overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 sticky top-0 z-10">
          <tr>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
              Numéro
            </th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
              Client
            </th>
            <th className="text-right px-4 py-3 font-semibold text-muted-foreground">
              Montant TTC
            </th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
              Statut
            </th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
              Date
            </th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
              Échéance
            </th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
              Télécharger
            </th>
            <th className="text-left px-4 py-3 font-semibold text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const st =
              STATUS_META[inv.status as InvoiceStatus] ?? STATUS_META.draft;
            // Try to find local invoice for email sending
            const localInv = localInvoicesApi
              .list()
              .find(
                (li) =>
                  li.number === inv.number || li.clientName === inv.client_name,
              );
            return (
              <tr
                key={inv.id}
                className="border-t hover:bg-accent/40 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs">{inv.number}</td>
                <td className="px-4 py-3">{inv.client_name || "—"}</td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatCurrency(inv.total_ttc, inv.currency || "EUR")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}
                  >
                    {st.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(inv.created_at)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {inv.due_date ? formatDate(inv.due_date) : "—"}
                </td>
                <td className="px-4 py-3">
                  {inv.download_url ? (
                    <a
                      href={inv.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-xs hover:underline"
                    >
                      PDF
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                {/* Feature 22: Email invoice to contact + Edit/Delete */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {localInv ? (
                      <InvoiceEmailSender
                        invoice={localInv}
                        contactEmail={localInv.contactEmail}
                      />
                    ) : (
                      <a
                        href={`mailto:?subject=Facture ${inv.number}`}
                        className="text-primary text-xs hover:underline"
                      >
                        Envoyer
                      </a>
                    )}
                    <button
                      onClick={() => onEdit(inv)}
                      className="text-primary text-xs hover:underline"
                    >
                      Modifier
                    </button>
                    {inv.status === "draft" && (
                      <button
                        onClick={() => onDelete(inv)}
                        className="text-destructive text-xs hover:underline"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Usage Card ───────────────────────────────────────────────────────────────

function UsageCard({
  label,
  used,
  limit,
  pct,
}: {
  label: string;
  used: string;
  limit: string;
  pct: number;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/60 transition-all"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {pct === 0 && (
        <p className="text-xs text-muted-foreground">
          Données disponibles dès que le service est en ligne
        </p>
      )}
    </div>
  );
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-muted" />
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 text-red-700 p-4 text-sm">
      {message}
    </div>
  );
}

function EmptyState({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="text-center py-16 rounded-xl border border-dashed text-muted-foreground">
      <svg
        className="mx-auto mb-3 w-10 h-10 opacity-30"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 14l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
        />
      </svg>
      <p className="text-base font-medium">{label}</p>
      <p className="text-sm mt-1">{hint}</p>
    </div>
  );
}
