/**
 * Interoperability layer — CRM × Contacts × Billing
 * All localStorage-backed, no backend required.
 */

import { dealsApi, activitiesApi, crmTasksApi, type Deal, type Activity } from "./crm"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LocalInvoice {
  id: string
  number: string
  clientName: string
  contactId?: string
  contactEmail?: string
  dealId?: string
  amount: number
  currency: string
  status: "draft" | "sent" | "paid" | "overdue"
  createdAt: string
  dueDate: string
  items?: { label: string; quantity: number; unitPrice: number }[]
}

export interface ContactNote {
  id: string
  contactId: string
  dealId?: string
  content: string
  author?: string
  createdAt: string
  source: "crm" | "contacts"
}

export interface SocialProfile {
  id: string
  contactId: string
  platform: "linkedin" | "twitter" | "github" | "website"
  url: string
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function load<T>(key: string): T[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(key) ?? "[]") as T[] }
  catch { return [] }
}

function save<T>(key: string, data: T[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(data))
}

// ─── Local Invoices API ───────────────────────────────────────────────────────

export const localInvoicesApi = {
  list: (): LocalInvoice[] => load<LocalInvoice>("billing:invoices"),

  byContact: (contactId: string): LocalInvoice[] =>
    load<LocalInvoice>("billing:invoices").filter(i => i.contactId === contactId),

  byContactEmail: (email: string): LocalInvoice[] =>
    load<LocalInvoice>("billing:invoices").filter(
      i => i.contactEmail?.toLowerCase() === email.toLowerCase()
    ),

  byDeal: (dealId: string): LocalInvoice[] =>
    load<LocalInvoice>("billing:invoices").filter(i => i.dealId === dealId),

  get: (id: string): LocalInvoice | undefined =>
    load<LocalInvoice>("billing:invoices").find(i => i.id === id),

  create: (data: Omit<LocalInvoice, "id" | "createdAt">): LocalInvoice => {
    const inv: LocalInvoice = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    save<LocalInvoice>("billing:invoices", [...load<LocalInvoice>("billing:invoices"), inv])
    return inv
  },

  update: (id: string, data: Partial<LocalInvoice>): LocalInvoice | undefined => {
    const all = load<LocalInvoice>("billing:invoices").map(i =>
      i.id === id ? { ...i, ...data } : i
    )
    save<LocalInvoice>("billing:invoices", all)
    return all.find(i => i.id === id)
  },

  delete: (id: string) => {
    save<LocalInvoice>("billing:invoices", load<LocalInvoice>("billing:invoices").filter(i => i.id !== id))
  },

  // Feature 18: Generate invoice from deal data
  fromDeal: (deal: Deal, contactId?: string): LocalInvoice => {
    const num = `FA-${Date.now().toString().slice(-6)}`
    const due = new Date()
    due.setDate(due.getDate() + 30)
    return localInvoicesApi.create({
      number: num,
      clientName: deal.company,
      contactId,
      contactEmail: deal.contactEmail,
      dealId: deal.id,
      amount: deal.value,
      currency: "EUR",
      status: "draft",
      dueDate: due.toISOString().slice(0, 10),
      items: [{ label: deal.title, quantity: 1, unitPrice: deal.value }],
    })
  },
}

// ─── Contact Notes API (shared CRM ↔ Contacts) ───────────────────────────────

export const contactNotesApi = {
  list: (): ContactNote[] => load<ContactNote>("shared:contact_notes"),

  byContact: (contactId: string): ContactNote[] =>
    load<ContactNote>("shared:contact_notes").filter(n => n.contactId === contactId),

  create: (data: Omit<ContactNote, "id" | "createdAt">): ContactNote => {
    const note: ContactNote = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    save<ContactNote>("shared:contact_notes", [...load<ContactNote>("shared:contact_notes"), note])
    return note
  },

  delete: (id: string) => {
    save<ContactNote>("shared:contact_notes", load<ContactNote>("shared:contact_notes").filter(n => n.id !== id))
  },
}

// ─── Social Profiles API ─────────────────────────────────────────────────────

export const socialProfilesApi = {
  byContact: (contactId: string): SocialProfile[] =>
    load<SocialProfile>("contacts:social").filter(s => s.contactId === contactId),

  upsert: (data: Omit<SocialProfile, "id"> & { id?: string }): SocialProfile => {
    const all = load<SocialProfile>("contacts:social")
    const idx = all.findIndex(s => s.contactId === data.contactId && s.platform === data.platform)
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...data, id: all[idx].id }
      save<SocialProfile>("contacts:social", all)
      return all[idx]
    }
    const s: SocialProfile = { ...data, id: data.id ?? crypto.randomUUID() }
    save<SocialProfile>("contacts:social", [...all, s])
    return s
  },

  delete: (id: string) => {
    save<SocialProfile>("contacts:social", load<SocialProfile>("contacts:social").filter(s => s.id !== id))
  },
}

// ─── Cross-module helpers ─────────────────────────────────────────────────────

/** Feature 1: Deals linked to a contact */
export function getDealsForContact(contactId: string, contactEmail?: string): Deal[] {
  const all = dealsApi.list()
  return all.filter(d =>
    d.contactId === contactId ||
    (contactEmail && d.contactEmail?.toLowerCase() === contactEmail.toLowerCase())
  )
}

/** Feature 7: All contacts in the same company */
export function getCompanyContacts<T extends { id: string; company?: string }>(
  contact: T,
  allContacts: T[]
): T[] {
  if (!contact.company) return []
  return allContacts.filter(
    c => c.id !== contact.id &&
      c.company?.toLowerCase() === contact.company!.toLowerCase()
  )
}

/** Feature 8: Total invoice value per stage */
export function getInvoiceValueByStage(): Record<string, number> {
  const deals = dealsApi.list()
  const invoices = localInvoicesApi.list()
  const result: Record<string, number> = {}
  for (const deal of deals) {
    const inv = invoices.filter(i => i.dealId === deal.id)
    const total = inv.reduce((s, i) => s + i.amount, 0)
    result[deal.stage] = (result[deal.stage] ?? 0) + total
  }
  return result
}

/** Feature 11: Overdue invoices with their linked deals */
export function getOverdueInvoicesWithDeals(): { invoice: LocalInvoice; deal?: Deal }[] {
  const invoices = localInvoicesApi.list().filter(i => i.status === "overdue")
  return invoices.map(invoice => ({
    invoice,
    deal: invoice.dealId ? dealsApi.get(invoice.dealId) : undefined,
  }))
}

/** Feature 14: Payment history for a contact */
export function getContactPaymentHistory(
  contactId: string,
  contactEmail?: string
): LocalInvoice[] {
  const byId = localInvoicesApi.byContact(contactId)
  const byEmail = contactEmail ? localInvoicesApi.byContactEmail(contactEmail) : []
  const seen = new Set<string>()
  return [...byId, ...byEmail].filter(i => {
    if (seen.has(i.id)) return false
    seen.add(i.id)
    return true
  })
}

/** Feature 20: CRM revenue summary with billing data */
export function getCrmRevenueSummary(): {
  stage: string
  dealCount: number
  dealValue: number
  invoicedAmount: number
  paidAmount: number
}[] {
  const deals = dealsApi.list()
  const invoices = localInvoicesApi.list()
  const stages = ["prospect", "qualified", "proposal", "negotiation", "won", "lost"]
  return stages.map(stage => {
    const stageDeals = deals.filter(d => d.stage === stage)
    const stageInvoices = invoices.filter(i =>
      stageDeals.some(d => d.id === i.dealId)
    )
    return {
      stage,
      dealCount: stageDeals.length,
      dealValue: stageDeals.reduce((s, d) => s + d.value, 0),
      invoicedAmount: stageInvoices.reduce((s, i) => s + i.amount, 0),
      paidAmount: stageInvoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0),
    }
  })
}

/** Feature 25: CRM forecast enriched with billing history */
export function getBillingEnrichedForecast(contactEmail?: string): {
  avgDealValue: number
  totalPaid: number
  wonDealsCount: number
  paymentRate: number
} {
  const invoices = contactEmail
    ? localInvoicesApi.byContactEmail(contactEmail)
    : localInvoicesApi.list()
  const deals = contactEmail
    ? dealsApi.list().filter(d => d.contactEmail?.toLowerCase() === contactEmail.toLowerCase())
    : dealsApi.list()

  const wonDeals = deals.filter(d => d.stage === "won")
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0)
  const avgDealValue = wonDeals.length > 0
    ? wonDeals.reduce((s, d) => s + d.value, 0) / wonDeals.length
    : 0
  const paymentRate = invoices.length > 0
    ? (invoices.filter(i => i.status === "paid").length / invoices.length) * 100
    : 0

  return { avgDealValue, totalPaid, wonDealsCount: wonDeals.length, paymentRate }
}

/** Feature 4: Auto-create invoice when deal moves to "won" */
export function autoCreateInvoiceForWonDeal(deal: Deal): LocalInvoice | null {
  if (deal.stage !== "won") return null
  const existing = localInvoicesApi.byDeal(deal.id)
  if (existing.length > 0) return null // already invoiced
  return localInvoicesApi.fromDeal(deal)
}

/** Feature 27: Payment received → update deal status */
export function onInvoicePaid(invoiceId: string): Deal | undefined {
  const inv = localInvoicesApi.get(invoiceId)
  if (!inv?.dealId) return undefined
  const deal = dealsApi.get(inv.dealId)
  if (!deal || deal.stage === "won") return undefined
  return dealsApi.update(inv.dealId, { stage: "won" })
}

/** Feature 15: Contact import → auto-create CRM lead */
export function autoCreateLeadFromContact(contact: {
  id: string; name: string; email: string; company?: string
}): Deal {
  return dealsApi.create({
    title: `Nouveau lead — ${contact.name}`,
    company: contact.company ?? "À définir",
    contactId: contact.id,
    contactEmail: contact.email,
    value: 0,
    probability: 10,
    stage: "prospect",
  })
}

/** Feature 19: Contact merge → update CRM and billing references */
export function mergeContactReferences(keepId: string, removeId: string, keepEmail: string): void {
  // Update deals
  const deals = dealsApi.list()
  deals.filter(d => d.contactId === removeId).forEach(d => {
    dealsApi.update(d.id, { contactId: keepId })
  })
  // Update activities
  const acts = activitiesApi.list()
  acts.filter(a => a.contactId === removeId).forEach(a => {
    activitiesApi.delete(a.id)
    activitiesApi.create({ ...a, contactId: keepId })
  })
  // Update invoices
  const invs = localInvoicesApi.list()
  invs.filter(i => i.contactId === removeId).forEach(i => {
    localInvoicesApi.update(i.id, { contactId: keepId, contactEmail: keepEmail })
  })
  // Update notes
  const notes = contactNotesApi.list()
  notes.filter(n => n.contactId === removeId).forEach(n => {
    contactNotesApi.delete(n.id)
    contactNotesApi.create({ ...n, contactId: keepId })
  })
}

/** Feature 29: Export deals with contact info as CSV */
export function exportDealsWithContactsCsv<T extends { id: string; name: string; email: string; company?: string }>(
  contacts: T[]
): string {
  const deals = dealsApi.list()
  const contactMap = new Map(contacts.map(c => [c.id, c]))
  const emailMap = new Map(contacts.map(c => [c.email.toLowerCase(), c]))

  const header = "Titre,Société,Contact,Email,Valeur,Étape,Probabilité,Clôture,Assigné à"
  const rows = deals.map(d => {
    const contact = d.contactId
      ? contactMap.get(d.contactId)
      : d.contactEmail
      ? emailMap.get(d.contactEmail.toLowerCase())
      : undefined
    return [
      d.title,
      d.company,
      contact?.name ?? "",
      d.contactEmail ?? contact?.email ?? "",
      d.value,
      d.stage,
      `${d.probability}%`,
      d.closeDate ?? "",
      d.assignedTo ?? "",
    ]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  })
  return [header, ...rows].join("\n")
}
