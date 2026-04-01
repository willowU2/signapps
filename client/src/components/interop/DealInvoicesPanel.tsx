"use client"
// Feature 2: CRM deal → show linked invoices from billing
// Feature 6: Billing invoice → link to CRM deal

import { useState, useEffect } from "react"
import { FileText, Plus, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { localInvoicesApi, autoCreateInvoiceForWonDeal, type LocalInvoice } from "@/lib/api/interop"
import { dealsApi, type Deal } from "@/lib/api/crm"
import { toast } from "sonner"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700",
}
const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyée", paid: "Payée", overdue: "En retard"
}

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)

interface Props {
  dealId: string
  onRefresh?: () => void
}

export function DealInvoicesPanel({ dealId, onRefresh }: Props) {
  const [invoices, setInvoices] = useState<LocalInvoice[]>(() =>
    localInvoicesApi.byDeal(dealId)
  )

  const [deal, setDeal] = useState<Deal | undefined>(undefined)
  useEffect(() => { dealsApi.get(dealId).then(setDeal) }, [dealId])

  const refresh = () => {
    setInvoices(localInvoicesApi.byDeal(dealId))
    onRefresh?.()
  }

  const handleCreateInvoice = () => {
    if (!deal) return
    const inv = localInvoicesApi.fromDeal(deal)
    toast.success(`Facture ${inv.number} créée.`)
    refresh()
  }

  const handleMarkPaid = (id: string) => {
    localInvoicesApi.update(id, { status: "paid" })
    toast.success("Facture marquée comme payée.")
    refresh()
  }

  const totalInvoiced = invoices.reduce((s, i) => s + i.amount, 0)
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          <FileText className="h-3 w-3" /> Factures ({invoices.length})
        </p>
        <Button size="sm" variant="outline" onClick={handleCreateInvoice} className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" /> Créer facture
        </Button>
      </div>

      {invoices.length > 0 && (
        <div className="flex gap-4 text-xs">
          <span>Facturé: <strong>{fmt(totalInvoiced)}</strong></span>
          <span className="text-emerald-600">Payé: <strong>{fmt(totalPaid)}</strong></span>
        </div>
      )}

      {invoices.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucune facture liée.</p>
      ) : (
        <div className="space-y-1.5">
          {invoices.map((inv: LocalInvoice) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{inv.number}</p>
                <p className="text-xs text-muted-foreground">{fmt(inv.amount)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {inv.status === "overdue" && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[inv.status]}`}>
                  {STATUS_LABELS[inv.status]}
                </span>
                {inv.status !== "paid" && (
                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => handleMarkPaid(inv.id)}>
                    Payer
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
