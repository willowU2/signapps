"use client";

import { useEffect, useState } from "react";
import { usePageTitle } from "@/hooks/use-page-title";
import { AppLayout } from "@/components/layout/app-layout";
import { billingApi, type BillingUsage, type Invoice, type InvoiceStatus } from "@/lib/api/billing";
import { OverdueInvoicesCrmFlag } from "@/components/interop/OverdueInvoicesCrmFlag";
import { InvoiceEmailSender } from "@/components/interop/InvoiceEmailSender";
import { localInvoicesApi } from "@/lib/api/interop";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<InvoiceStatus, { label: string; color: string }> = {
  draft:   { label: "Brouillon", color: "bg-muted text-muted-foreground" },
  sent:    { label: "Envoyée",   color: "bg-blue-500/15 text-blue-500" },
  paid:    { label: "Payée",     color: "bg-green-500/15 text-green-500" },
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "invoices" | "quotes";

export default function BillingPage() {
  usePageTitle('Facturation');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("invoices");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.allSettled([billingApi.listInvoices(), billingApi.getUsage()]).then(
      ([invoicesResult, usageResult]) => {
        if (cancelled) return;

        if (invoicesResult.status === "fulfilled") {
          setInvoices((invoicesResult.value as any).data ?? []);
        } else {
          setInvoices([]);
        }

        if (usageResult.status === "fulfilled") {
          setUsage((usageResult.value as any).data ?? null);
        }

        setLoading(false);
      }
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
        <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
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
            used={
              usage
                ? formatBytes(usage.storage_used_bytes)
                : "—"
            }
            limit={
              usage && usage.storage_limit_bytes > 0
                ? formatBytes(usage.storage_limit_bytes)
                : "5 Go"
            }
            pct={
              usage && usage.storage_limit_bytes > 0
                ? Math.round(
                    (usage.storage_used_bytes / usage.storage_limit_bytes) * 100
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
                    (usage.api_calls_this_month / usage.api_calls_limit) * 100
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

      {/* Invoices table */}
      <section>
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
          {(["invoices", "quotes"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {t === "invoices" ? "Factures" : "Devis"}
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
                      : STATUS_META[s as InvoiceStatus]?.label ?? s}
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {loading ? (
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
          <InvoiceTable invoices={filtered} />
        )}
      </section>
    </div>
    </AppLayout>
  );
}

// ─── Invoice Table ────────────────────────────────────────────────────────────

function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
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
            const localInv = localInvoicesApi.list().find(
              li => li.number === inv.number || li.clientName === inv.client_name
            );
            return (
              <tr
                key={inv.id}
                className="border-t hover:bg-accent/40 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs">{inv.number}</td>
                <td className="px-4 py-3">{inv.client_name}</td>
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
                {/* Feature 22: Email invoice to contact */}
                <td className="px-4 py-3">
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
