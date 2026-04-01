"use client"
// Feature 26: Contact → birthday reminder with CRM context

import { useState, useEffect } from "react"
import { Gift, TrendingUp, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getDealsForContact, getContactPaymentHistory } from "@/lib/api/interop"
import { STAGE_LABELS } from "@/lib/api/crm"

interface Contact {
  id: string
  name: string
  email?: string
  birthday?: string
  company?: string
}

interface Props {
  contact: Contact
}

function daysUntilBirthday(birthday: string): number | null {
  const parts = birthday.split("-")
  if (parts.length < 2) return null
  const [month, day] = parts.slice(-2).map(Number)
  const today = new Date()
  const thisYear = new Date(today.getFullYear(), month - 1, day)
  if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1)
  return Math.ceil((thisYear.getTime() - today.getTime()) / 86400000)
}

const fmt = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)

export function ContactBirthdayCrmContext({ contact }: Props) {
  const [deals, setDeals] = useState<Awaited<ReturnType<typeof getDealsForContact>>>([])
  const invoices = getContactPaymentHistory(contact.id, contact.email)

  useEffect(() => {
    getDealsForContact(contact.id, contact.email).then(setDeals)
  }, [contact.id, contact.email])

  const daysUntil = contact.birthday ? daysUntilBirthday(contact.birthday) : null
  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0)
  const openDeals = deals.filter(d => d.stage !== "lost" && d.stage !== "won")
  const isUpcoming = daysUntil !== null && daysUntil <= 30

  if (!contact.birthday) return null

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${isUpcoming ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : "border-border bg-card"}`}>
      <div className="flex items-center gap-2">
        <Gift className={`h-4 w-4 ${isUpcoming ? "text-amber-500" : "text-muted-foreground"}`} />
        <span className="text-sm font-medium">{contact.name}</span>
        {isUpcoming && daysUntil === 0 && (
          <Badge className="bg-amber-500 text-white text-xs">Aujourd'hui !</Badge>
        )}
        {isUpcoming && daysUntil !== null && daysUntil > 0 && (
          <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
            Dans {daysUntil}j
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {openDeals.length > 0 && (
          <div className="flex items-center gap-1 text-primary">
            <TrendingUp className="h-3 w-3" />
            <span>{openDeals.length} deal(s) ouvert(s)</span>
          </div>
        )}
        {totalRevenue > 0 && (
          <div className="flex items-center gap-1 text-emerald-600">
            <DollarSign className="h-3 w-3" />
            <span>{fmt(totalRevenue)} encaissé</span>
          </div>
        )}
      </div>

      {isUpcoming && contact.email && (
        <Button size="sm" variant="outline" asChild className="h-7 text-xs w-full">
          <a href={`mailto:${contact.email}?subject=${encodeURIComponent(`Joyeux anniversaire ${contact.name.split(" ")[0]} !`)}`}>
            <Gift className="h-3 w-3 mr-1" /> Envoyer message d'anniversaire
          </a>
        </Button>
      )}
    </div>
  )
}
