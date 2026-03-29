"use client"
// Feature 30: Unified customer 360° view: contact + deals + invoices + emails + events

import { useState, useMemo } from "react"
import { Users, TrendingUp, FileText, Mail, Calendar, ChevronDown, ChevronUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContactDealsPanel } from "./ContactDealsPanel"
import { ContactPaymentHistory } from "./ContactPaymentHistory"
import { SharedContactNotes } from "./SharedContactNotes"
import { ContactCalendarPanel } from "./ContactCalendarPanel"
import { ContactSocialProfiles } from "./ContactSocialProfiles"
import { ContactTasksPanel } from "./ContactTasksPanel"
import { InvoiceEmailSender } from "./InvoiceEmailSender"
import { getDealsForContact, getContactPaymentHistory } from "@/lib/api/interop"

interface Contact {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  tags?: string[]
  birthday?: string
}

interface Props {
  contact: Contact
  defaultOpen?: boolean
}

export function Customer360View({ contact, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const deals = useMemo(
    () => getDealsForContact(contact.id, contact.email),
    [contact.id, contact.email]
  )

  const invoices = useMemo(
    () => getContactPaymentHistory(contact.id, contact.email),
    [contact.id, contact.email]
  )

  const openDeals = deals.filter(d => d.stage !== "lost" && d.stage !== "won")
  const wonDeals = deals.filter(d => d.stage === "won")
  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0)
  const overdueCount = invoices.filter(i => i.status === "overdue").length

  const fmt = (v: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-start justify-between gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-primary">
              {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-sm">{contact.name}</h3>
            <p className="text-xs text-muted-foreground">{contact.email}</p>
            {contact.company && (
              <p className="text-xs text-muted-foreground">{contact.company}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {openDeals.length > 0 && (
                <Badge variant="outline" className="text-xs h-4 py-0 flex items-center gap-0.5">
                  <TrendingUp className="h-2.5 w-2.5" />
                  {openDeals.length} deal(s)
                </Badge>
              )}
              {totalRevenue > 0 && (
                <Badge variant="outline" className="text-xs h-4 py-0 text-emerald-600 border-emerald-300">
                  {fmt(totalRevenue)}
                </Badge>
              )}
              {overdueCount > 0 && (
                <Badge variant="destructive" className="text-xs h-4 py-0">
                  {overdueCount} en retard
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <InvoiceEmailSender contactEmail={contact.email} contactName={contact.name} mode="quick" />
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* 360° Details */}
      {open && (
        <div className="border-t px-4 pb-4">
          <Tabs defaultValue="deals" className="mt-3">
            <TabsList className="h-7 text-xs gap-0.5">
              <TabsTrigger value="deals" className="text-xs h-6 px-2">
                <TrendingUp className="h-3 w-3 mr-1" />
                Deals ({deals.length})
              </TabsTrigger>
              <TabsTrigger value="billing" className="text-xs h-6 px-2">
                <FileText className="h-3 w-3 mr-1" />
                Factures ({invoices.length})
              </TabsTrigger>
              <TabsTrigger value="emails" className="text-xs h-6 px-2">
                <Mail className="h-3 w-3 mr-1" />
                Emails
              </TabsTrigger>
              <TabsTrigger value="calendar" className="text-xs h-6 px-2">
                <Calendar className="h-3 w-3 mr-1" />
                Agenda
              </TabsTrigger>
              <TabsTrigger value="notes" className="text-xs h-6 px-2">
                Notes
              </TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs h-6 px-2">
                Tâches
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deals" className="mt-3">
              <ContactDealsPanel contactId={contact.id} contactEmail={contact.email} />
            </TabsContent>

            <TabsContent value="billing" className="mt-3">
              <ContactPaymentHistory contactId={contact.id} contactEmail={contact.email} />
            </TabsContent>

            <TabsContent value="emails" className="mt-3">
              <div className="space-y-3">
                <InvoiceEmailSender contactEmail={contact.email} contactName={contact.name} />
                <p className="text-xs text-muted-foreground">
                  Consultez vos emails échangés dans le module{" "}
                  <a href="/mail" className="text-primary hover:underline">Mail</a>.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="calendar" className="mt-3">
              <ContactCalendarPanel
                contactId={contact.id}
                contactEmail={contact.email}
                contactName={contact.name}
                showScheduleButton
              />
            </TabsContent>

            <TabsContent value="notes" className="mt-3">
              <SharedContactNotes contactId={contact.id} source="contacts" />
            </TabsContent>

            <TabsContent value="tasks" className="mt-3">
              <ContactTasksPanel contactId={contact.id} contactEmail={contact.email} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
