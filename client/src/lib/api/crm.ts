/**
 * CRM API — localStorage-backed persistence
 * Deals, Activities, Tasks, Quotas, LeadScores
 * No backend service required — all client-side.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type DealStage = "prospect" | "qualified" | "proposal" | "negotiation" | "won" | "lost"

export interface Deal {
  id: string
  title: string
  company: string
  contactId?: string
  contactEmail?: string
  value: number
  probability: number
  stage: DealStage
  closeDate?: string
  assignedTo?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

export type ActivityType = "email" | "phone" | "meeting" | "note"

export interface Activity {
  id: string
  dealId?: string
  contactId?: string
  type: ActivityType
  content: string
  author?: string
  date: string
  calendarEventId?: string
}

export interface CrmTask {
  id: string
  dealId: string
  title: string
  dueDate?: string
  done: boolean
  assignedTo?: string
  createdAt: string
}

export interface Quota {
  id: string
  salesperson: string
  period: string // e.g. "2026-Q1"
  target: number
  achieved: number
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

function load<T>(key: string): T[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[]
  } catch {
    return []
  }
}

function save<T>(key: string, data: T[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(key, JSON.stringify(data))
}

// ─── Deals ────────────────────────────────────────────────────────────────────

export const dealsApi = {
  list: (): Deal[] => load<Deal>("crm:deals"),

  get: (id: string): Deal | undefined =>
    load<Deal>("crm:deals").find(d => d.id === id),

  create: (data: Omit<Deal, "id" | "createdAt" | "updatedAt">): Deal => {
    const deal: Deal = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    save<Deal>("crm:deals", [...load<Deal>("crm:deals"), deal])
    return deal
  },

  update: (id: string, data: Partial<Deal>): Deal | undefined => {
    const deals = load<Deal>("crm:deals").map(d =>
      d.id === id ? { ...d, ...data, updatedAt: new Date().toISOString() } : d
    )
    save<Deal>("crm:deals", deals)
    return deals.find(d => d.id === id)
  },

  delete: (id: string) => {
    save<Deal>("crm:deals", load<Deal>("crm:deals").filter(d => d.id !== id))
  },

  importMany: (deals: Omit<Deal, "id" | "createdAt" | "updatedAt">[]): Deal[] => {
    const existing = load<Deal>("crm:deals")
    const newDeals: Deal[] = deals.map(d => ({
      ...d,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    save<Deal>("crm:deals", [...existing, ...newDeals])
    return newDeals
  },
}

// ─── Activities ───────────────────────────────────────────────────────────────

export const activitiesApi = {
  list: (): Activity[] => load<Activity>("crm:activities"),

  byDeal: (dealId: string): Activity[] =>
    load<Activity>("crm:activities").filter(a => a.dealId === dealId),

  byContact: (contactId: string): Activity[] =>
    load<Activity>("crm:activities").filter(a => a.contactId === contactId),

  create: (data: Omit<Activity, "id">): Activity => {
    const act: Activity = { ...data, id: crypto.randomUUID() }
    save<Activity>("crm:activities", [...load<Activity>("crm:activities"), act])
    return act
  },

  delete: (id: string) => {
    save<Activity>("crm:activities", load<Activity>("crm:activities").filter(a => a.id !== id))
  },
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const crmTasksApi = {
  byDeal: (dealId: string): CrmTask[] =>
    load<CrmTask>("crm:tasks").filter(t => t.dealId === dealId),

  create: (data: Omit<CrmTask, "id" | "createdAt">): CrmTask => {
    const task: CrmTask = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    save<CrmTask>("crm:tasks", [...load<CrmTask>("crm:tasks"), task])
    return task
  },

  toggle: (id: string) => {
    const tasks = load<CrmTask>("crm:tasks").map(t =>
      t.id === id ? { ...t, done: !t.done } : t
    )
    save<CrmTask>("crm:tasks", tasks)
  },

  delete: (id: string) => {
    save<CrmTask>("crm:tasks", load<CrmTask>("crm:tasks").filter(t => t.id !== id))
  },
}

// ─── Quotas ───────────────────────────────────────────────────────────────────

export const quotasApi = {
  list: (): Quota[] => load<Quota>("crm:quotas"),

  listByPeriod: (period: string): Quota[] =>
    load<Quota>("crm:quotas").filter(q => q.period === period),

  upsert: (data: Omit<Quota, "id">): Quota => {
    const existing = load<Quota>("crm:quotas")
    const idx = existing.findIndex(
      q => q.salesperson === data.salesperson && q.period === data.period
    )
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...data }
      save<Quota>("crm:quotas", existing)
      return existing[idx]
    }
    const q: Quota = { ...data, id: crypto.randomUUID() }
    save<Quota>("crm:quotas", [...existing, q])
    return q
  },

  delete: (id: string) => {
    save<Quota>("crm:quotas", load<Quota>("crm:quotas").filter(q => q.id !== id))
  },
}

// ─── Lead Scoring ─────────────────────────────────────────────────────────────

export function computeLeadScore(deal: Deal): number {
  let score = 0

  // Value score
  if (deal.value > 50000) score += 30
  else if (deal.value > 10000) score += 20
  else if (deal.value > 1000) score += 10

  // Stage score
  const stageScores: Record<DealStage, number> = {
    prospect: 10,
    qualified: 20,
    proposal: 35,
    negotiation: 50,
    won: 100,
    lost: 0,
  }
  score += stageScores[deal.stage]

  // Close date urgency
  if (deal.closeDate) {
    const daysUntil = (new Date(deal.closeDate).getTime() - Date.now()) / 86400000
    if (daysUntil < 7) score += 20
    else if (daysUntil < 30) score += 10
  }

  // Activity bonus (count activities)
  const activityCount = load<Activity>("crm:activities").filter(
    a => a.dealId === deal.id
  ).length
  score += Math.min(activityCount * 5, 20)

  return Math.min(score, 100)
}

// ─── Stage config (shared) ────────────────────────────────────────────────────

export const STAGE_OPTIONS: DealStage[] = [
  "prospect", "qualified", "proposal", "negotiation", "won", "lost"
]

export const STAGE_LABELS: Record<DealStage, string> = {
  prospect: "Prospect",
  qualified: "Qualifié",
  proposal: "Proposition",
  negotiation: "Négociation",
  won: "Gagné",
  lost: "Perdu",
}
