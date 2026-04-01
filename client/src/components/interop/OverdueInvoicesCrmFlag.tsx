"use client"
// Feature 11: Billing overdue invoice → flag in CRM
// Feature 27: Payment received → update CRM deal status

import { useState, useEffect } from "react"
import { AlertTriangle, CheckCircle, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getOverdueInvoicesWithDeals, localInvoicesApi, onInvoicePaid } from "@/lib/api/interop"
import { dealsApi } from "@/lib/api/crm"
import { toast } from "sonner"
import Link from "next/link"

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)

interface Props {
  compact?: boolean
}

export function OverdueInvoicesCrmFlag({ compact = false }: Props) {
  const [items, setItems] = useState<Awaited<ReturnType<typeof getOverdueInvoicesWithDeals>>>([])

  const refresh = () => getOverdueInvoicesWithDeals().then(setItems)

  useEffect(() => { refresh() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkPaid = async (invoiceId: string) => {
    localInvoicesApi.update(invoiceId, { status: "paid" })
    // Feature 27: payment received → update deal
    const updatedDeal = await onInvoicePaid(invoiceId)
    if (updatedDeal) {
      toast.success(`Facture payée. Deal "${updatedDeal.title}" mis à jour → Gagné.`)
    } else {
      toast.success("Facture marquée comme payée.")
    }
    refresh()
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600">
        <CheckCircle className="h-4 w-4" />
        <span>Aucune facture en retard.</span>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-500">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="font-medium">{items.length} facture(s) en retard</span>
        <span className="text-xs text-muted-foreground">
          ({fmt(items.reduce((s, i) => s + i.invoice.amount, 0))})
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <p className="text-sm font-semibold text-red-500">
          {items.length} facture(s) en retard — action requise
        </p>
      </div>

      <div className="space-y-2">
        {items.map(({ invoice, deal }) => (
          <div key={invoice.id} className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{invoice.number}</span>
                <Badge variant="destructive" className="text-xs h-4">En retard</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {invoice.clientName} · {fmt(invoice.amount)}
                {deal && (
                  <span className="ml-2 inline-flex items-center gap-0.5 text-primary">
                    <TrendingUp className="h-2.5 w-2.5" />
                    <Link href="/crm" className="hover:underline">{deal.title}</Link>
                  </span>
                )}
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs flex-shrink-0" onClick={() => handleMarkPaid(invoice.id)}>
              Marquer payée
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
