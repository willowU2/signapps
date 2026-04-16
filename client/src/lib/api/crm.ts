/**
 * CRM API — real backend persistence via signapps-identity service.
 * Deals and Leads are stored in crm.deals / crm.leads (PostgreSQL).
 * The interface is intentionally kept compatible with the old localStorage API
 * so UI components require no changes.
 */

import { getClient, ServiceName } from "./factory";

// CRM routes live in signapps-contacts (port 3021), NOT identity.
// getClient already appends /api/v1 as base, so paths must NOT repeat it.
const contactsClient = () => getClient(ServiceName.CONTACTS);

// ─── Types ────────────────────────────────────────────────────────────────────

export type DealStage =
  | "prospect"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export interface Deal {
  id: string;
  title: string;
  /** Maps to contact_name in the backend */
  company: string;
  contactId?: string;
  contactEmail?: string;
  /** Maps to amount in the backend (stored as BIGINT cents/units) */
  value: number;
  probability: number;
  stage: DealStage;
  closeDate?: string;
  /** Maps to owner_id in the backend */
  assignedTo?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  status: string;
  score: number;
  ownerId: string;
  tenantId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType = "email" | "phone" | "meeting" | "note";

export interface Activity {
  id: string;
  dealId?: string;
  contactId?: string;
  type: ActivityType;
  content: string;
  author?: string;
  date: string;
  calendarEventId?: string;
}

export interface CrmTask {
  id: string;
  dealId: string;
  title: string;
  dueDate?: string;
  done: boolean;
  assignedTo?: string;
  createdAt: string;
}

export interface Quota {
  id: string;
  salesperson: string;
  period: string; // e.g. "2026-Q1"
  target: number;
  achieved: number;
}

export interface PipelineStage {
  stage: string;
  count: number;
  total_amount: number;
}

// ─── Backend ↔ frontend mappers ───────────────────────────────────────────────

/** Raw shape returned by the backend for a CRM deal (crm.deals table). */
interface ApiDeal {
  id: string;
  title: string;
  contact_name?: string | null;
  contact_id?: string | null;
  contact_email?: string | null;
  amount?: number | null;
  probability?: number | null;
  stage?: string | null;
  close_date?: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

/** Raw shape returned by the backend for a CRM lead (crm.leads table). */
interface ApiLead {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: string | null;
  status?: string | null;
  score?: number | null;
  owner_id: string;
  tenant_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// Backend returns snake_case; map to the camelCase Deal interface.
function mapDeal(d: ApiDeal): Deal {
  return {
    id: d.id,
    title: d.title,
    company: d.contact_name ?? "",
    contactId: d.contact_id ?? undefined,
    contactEmail: d.contact_email ?? undefined,
    value: d.amount ?? 0,
    probability: d.probability ?? 10,
    stage: (d.stage ?? "prospect") as DealStage,
    closeDate: d.close_date ?? undefined,
    assignedTo: d.owner_id,
    tags: [],
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

// Map Deal (UI) → backend create/update payload
function dealToPayload(data: Partial<Deal>) {
  return {
    ...(data.title !== undefined && { title: data.title }),
    ...(data.stage !== undefined && { stage: data.stage }),
    ...(data.value !== undefined && { amount: data.value }),
    ...(data.company !== undefined && { contact_name: data.company }),
    ...(data.contactId !== undefined && { contact_id: data.contactId }),
    ...(data.contactEmail !== undefined && {
      contact_email: data.contactEmail,
    }),
    ...(data.closeDate !== undefined && { close_date: data.closeDate }),
    ...(data.probability !== undefined && { probability: data.probability }),
  };
}

function mapLead(l: ApiLead): Lead {
  return {
    id: l.id,
    name: l.name,
    email: l.email ?? undefined,
    phone: l.phone ?? undefined,
    company: l.company ?? undefined,
    source: l.source ?? undefined,
    status: l.status ?? "new",
    score: l.score ?? 0,
    ownerId: l.owner_id,
    tenantId: l.tenant_id ?? undefined,
    notes: l.notes ?? undefined,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  };
}

// ─── Deals API ────────────────────────────────────────────────────────────────

export const dealsApi = {
  list: async (stage?: string): Promise<Deal[]> => {
    try {
      const params = stage ? { stage } : {};
      const res = await contactsClient().get<ApiDeal[]>("/crm/deals", {
        params,
      });
      return (res.data ?? []).map(mapDeal);
    } catch {
      return [];
    }
  },

  get: async (id: string): Promise<Deal | undefined> => {
    try {
      const res = await contactsClient().get<ApiDeal>(`/crm/deals/${id}`);
      return mapDeal(res.data);
    } catch {
      return undefined;
    }
  },

  create: async (
    data: Omit<Deal, "id" | "createdAt" | "updatedAt">,
  ): Promise<Deal> => {
    const res = await contactsClient().post<ApiDeal>(
      "/crm/deals",
      dealToPayload(data),
    );
    return mapDeal(res.data);
  },

  update: async (
    id: string,
    data: Partial<Deal>,
  ): Promise<Deal | undefined> => {
    try {
      const res = await contactsClient().put<ApiDeal>(
        `/crm/deals/${id}`,
        dealToPayload(data),
      );
      return mapDeal(res.data);
    } catch {
      return undefined;
    }
  },

  delete: async (id: string): Promise<void> => {
    await contactsClient().delete(`/crm/deals/${id}`);
  },

  importMany: async (
    deals: Omit<Deal, "id" | "createdAt" | "updatedAt">[],
  ): Promise<Deal[]> => {
    const results: Deal[] = [];
    for (const d of deals) {
      try {
        results.push(await dealsApi.create(d));
      } catch {
        // skip failed imports
      }
    }
    return results;
  },
};

// ─── Leads API ────────────────────────────────────────────────────────────────

export const leadsApi = {
  list: async (status?: string): Promise<Lead[]> => {
    try {
      const params = status ? { status } : {};
      const res = await contactsClient().get<ApiLead[]>("/crm/leads", {
        params,
      });
      return (res.data ?? []).map(mapLead);
    } catch {
      return [];
    }
  },

  get: async (id: string): Promise<Lead | undefined> => {
    try {
      const res = await contactsClient().get<ApiLead>(`/crm/leads/${id}`);
      return mapLead(res.data);
    } catch {
      return undefined;
    }
  },

  create: async (
    data: Omit<Lead, "id" | "createdAt" | "updatedAt" | "ownerId">,
  ): Promise<Lead> => {
    const res = await contactsClient().post<ApiLead>("/crm/leads", {
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      source: data.source,
      status: data.status,
      score: data.score,
      notes: data.notes,
    });
    return mapLead(res.data);
  },

  update: async (
    id: string,
    data: Partial<Lead>,
  ): Promise<Lead | undefined> => {
    try {
      const res = await contactsClient().put<ApiLead>(`/crm/leads/${id}`, {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.company !== undefined && { company: data.company }),
        ...(data.source !== undefined && { source: data.source }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.score !== undefined && { score: data.score }),
        ...(data.notes !== undefined && { notes: data.notes }),
      });
      return mapLead(res.data);
    } catch {
      return undefined;
    }
  },

  delete: async (id: string): Promise<void> => {
    await contactsClient().delete(`/crm/leads/${id}`);
  },
};

// ─── Pipeline API ─────────────────────────────────────────────────────────────

export const pipelineApi = {
  getStages: async (): Promise<PipelineStage[]> => {
    try {
      const res = await contactsClient().get("/crm/pipeline");
      return res.data as PipelineStage[];
    } catch {
      return [];
    }
  },
};

// ─── Activities (kept local — no backend table yet) ───────────────────────────

function loadLocal<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}

function saveLocal<T>(key: string, data: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

export const activitiesApi = {
  list: (): Activity[] => loadLocal<Activity>("crm:activities"),

  byDeal: (dealId: string): Activity[] =>
    loadLocal<Activity>("crm:activities").filter((a) => a.dealId === dealId),

  byContact: (contactId: string): Activity[] =>
    loadLocal<Activity>("crm:activities").filter(
      (a) => a.contactId === contactId,
    ),

  create: (data: Omit<Activity, "id">): Activity => {
    const act: Activity = { ...data, id: crypto.randomUUID() };
    saveLocal<Activity>("crm:activities", [
      ...loadLocal<Activity>("crm:activities"),
      act,
    ]);
    return act;
  },

  delete: (id: string) => {
    saveLocal<Activity>(
      "crm:activities",
      loadLocal<Activity>("crm:activities").filter((a) => a.id !== id),
    );
  },
};

// ─── Tasks (kept local — no backend table yet) ────────────────────────────────

export const crmTasksApi = {
  byDeal: (dealId: string): CrmTask[] =>
    loadLocal<CrmTask>("crm:tasks").filter((t) => t.dealId === dealId),

  create: (data: Omit<CrmTask, "id" | "createdAt">): CrmTask => {
    const task: CrmTask = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    saveLocal<CrmTask>("crm:tasks", [...loadLocal<CrmTask>("crm:tasks"), task]);
    return task;
  },

  toggle: (id: string) => {
    const tasks = loadLocal<CrmTask>("crm:tasks").map((t) =>
      t.id === id ? { ...t, done: !t.done } : t,
    );
    saveLocal<CrmTask>("crm:tasks", tasks);
  },

  delete: (id: string) => {
    saveLocal<CrmTask>(
      "crm:tasks",
      loadLocal<CrmTask>("crm:tasks").filter((t) => t.id !== id),
    );
  },
};

// ─── Quotas (kept local — no backend table yet) ───────────────────────────────

export const quotasApi = {
  list: (): Quota[] => loadLocal<Quota>("crm:quotas"),

  listByPeriod: (period: string): Quota[] =>
    loadLocal<Quota>("crm:quotas").filter((q) => q.period === period),

  upsert: (data: Omit<Quota, "id">): Quota => {
    const existing = loadLocal<Quota>("crm:quotas");
    const idx = existing.findIndex(
      (q) => q.salesperson === data.salesperson && q.period === data.period,
    );
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...data };
      saveLocal<Quota>("crm:quotas", existing);
      return existing[idx];
    }
    const q: Quota = { ...data, id: crypto.randomUUID() };
    saveLocal<Quota>("crm:quotas", [...existing, q]);
    return q;
  },

  delete: (id: string) => {
    saveLocal<Quota>(
      "crm:quotas",
      loadLocal<Quota>("crm:quotas").filter((q) => q.id !== id),
    );
  },
};

// ─── Lead Scoring ─────────────────────────────────────────────────────────────

export function computeLeadScore(deal: Deal): number {
  let score = 0;

  if (deal.value > 50000) score += 30;
  else if (deal.value > 10000) score += 20;
  else if (deal.value > 1000) score += 10;

  const stageScores: Record<DealStage, number> = {
    prospect: 10,
    qualified: 20,
    proposal: 35,
    negotiation: 50,
    won: 100,
    lost: 0,
  };
  score += stageScores[deal.stage];

  if (deal.closeDate) {
    const daysUntil =
      (new Date(deal.closeDate).getTime() - Date.now()) / 86400000;
    if (daysUntil < 7) score += 20;
    else if (daysUntil < 30) score += 10;
  }

  const activityCount = activitiesApi.byDeal(deal.id).length;
  score += Math.min(activityCount * 5, 20);

  return Math.min(score, 100);
}

// ─── Stage config (shared) ────────────────────────────────────────────────────

export const STAGE_OPTIONS: DealStage[] = [
  "prospect",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

export const STAGE_LABELS: Record<DealStage, string> = {
  prospect: "Prospect",
  qualified: "Qualifié",
  proposal: "Proposition",
  negotiation: "Négociation",
  won: "Gagné",
  lost: "Perdu",
};
