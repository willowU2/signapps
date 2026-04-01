"use client"
// Feature 1: Contact → show linked CRM deals

import { useState, useEffect } from "react"
import { TrendingUp, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getDealsForContact } from "@/lib/api/interop"
import { STAGE_LABELS, type Deal } from "@/lib/api/crm"
import Link from "next/link"

const STAGE_COLORS: Record<string, string> = {
  prospect: "bg-slate-100 text-slate-700",
  qualified: "bg-blue-100 text-blue-700",
  proposal: "bg-amber-100 text-amber-700",
  negotiation: "bg-orange-100 text-orange-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
}

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)

interface Props {
  contactId: string
  contactEmail?: string
}

export function ContactDealsPanel({ contactId, contactEmail }: Props) {
  const [deals, setDeals] = useState<Deal[]>([])
  useEffect(() => {
    getDealsForContact(contactId, contactEmail).then(setDeals)
  }, [contactId, contactEmail])

  if (deals.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-2">
        Aucune opportunité CRM liée.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <TrendingUp className="h-3 w-3" /> Opportunités CRM ({deals.length})
      </p>
      <div className="space-y-1.5">
        {deals.map((deal: Deal) => (
          <div
            key={deal.id}
            className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{deal.title}</p>
              <p className="text-xs text-muted-foreground">{deal.company}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-semibold">{fmt(deal.value)}</span>
              <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STAGE_COLORS[deal.stage] ?? ""}`}>
                {STAGE_LABELS[deal.stage as keyof typeof STAGE_LABELS] ?? deal.stage}
              </span>
              <Link href="/crm" className="text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
