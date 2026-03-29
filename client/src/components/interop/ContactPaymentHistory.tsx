"use client"
// Feature 14: Billing → show contact payment history

import { useMemo } from "react"
import { CreditCard, TrendingUp } from "lucide-react"
import { getContactPaymentHistory, type LocalInvoice } from "@/lib/api/interop"

const STATUS_STYLES: Record<string, string> = {
  draft: "text-muted-foreground",
  sent: "text-blue-600",
  paid: "text-emerald-600",
  overdue: "text-red-500",
}
const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyée", paid: "Payée", overdue: "En retard"
}

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)

interface Props {
  contactId: string
  contactEmail?: string
}

export function ContactPaymentHistory({ contactId, contactEmail }: Props) {
  const invoices = useMemo(
    () => getContactPaymentHistory(contactId, contactEmail),
    [contactId, contactEmail]
  )

  const totalPaid = useMemo(
    () => invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0),
    [invoices]
  )
  const totalOutstanding = useMemo(
    () => invoices.filter(i => i.status !== "paid").reduce((s, i) => s + i.amount, 0),
    [invoices]
  )

  if (invoices.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-2">
        Aucune facture pour ce contact.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <CreditCard className="h-3 w-3" /> Historique paiements ({invoices.length})
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">Total payé</p>
          <p className="text-sm font-bold text-emerald-600">{fmt(totalPaid)}</p>
        </div>
        <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">En attente</p>
          <p className="text-sm font-bold text-amber-600">{fmt(totalOutstanding)}</p>
        </div>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {invoices
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((inv: LocalInvoice) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 text-sm rounded-md border bg-card px-3 py-1.5">
              <div className="min-w-0">
                <span className="font-medium">{inv.number}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {new Date(inv.createdAt).toLocaleDateString("fr-FR")}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs font-semibold">{fmt(inv.amount)}</span>
                <span className={`text-xs font-medium ${STATUS_STYLES[inv.status]}`}>
                  {STATUS_LABELS[inv.status]}
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
