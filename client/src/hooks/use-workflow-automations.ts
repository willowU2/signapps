"use client";

// Feature 3/6/9/12/15/18/21/24/27: Workflow automation engine hook

import { useState, useEffect, useCallback } from "react";

export type TriggerType =
  | "email_received"
  | "deal_won"
  | "form_submitted"
  | "task_overdue"
  | "calendar_event"
  | "file_uploaded"
  | "approval_requested"
  | "schedule"
  | "manual";

export type ActionType =
  | "create_task"
  | "create_invoice"
  | "create_contact"
  | "send_email"
  | "create_doc"
  | "auto_tag"
  | "notify"
  | "approve"
  | "reject"
  | "webhook";

export interface WorkflowCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "contains" | "not_contains";
  value: string | number;
}

export interface WorkflowAction {
  id: string;
  type: ActionType;
  params: Record<string, string | number | boolean>;
}

export interface WorkflowTrigger {
  type: TriggerType;
  config: Record<string, string | number>;
}

export interface WorkflowAutomation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  schedule?: string; // cron expression for recurring
  createdAt: string;
  lastRunAt?: string;
  runCount: number;
}

const KEY = "workflow_automations";

function load(): WorkflowAutomation[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
function persist(items: WorkflowAutomation[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

const TEMPLATES: Omit<WorkflowAutomation, "id" | "createdAt" | "runCount">[] = [
  {
    name: "Email reçu → Créer tâche",
    enabled: false,
    trigger: { type: "email_received", config: { from: "" } },
    conditions: [],
    actions: [
      {
        id: "a1",
        type: "create_task",
        params: { title: "Traiter email", assignee: "" },
      },
    ],
  },
  {
    name: "Deal gagné → Créer facture",
    enabled: false,
    trigger: { type: "deal_won", config: {} },
    conditions: [],
    actions: [
      { id: "a1", type: "create_invoice", params: { template: "standard" } },
    ],
  },
  {
    name: "Formulaire soumis → Créer contact",
    enabled: false,
    trigger: { type: "form_submitted", config: { formId: "" } },
    conditions: [],
    actions: [{ id: "a1", type: "create_contact", params: {} }],
  },
  {
    name: "Tâche en retard → Envoyer email",
    enabled: false,
    trigger: { type: "task_overdue", config: { daysOverdue: 1 } },
    conditions: [],
    actions: [
      {
        id: "a1",
        type: "send_email",
        params: { to: "", subject: "Tâche en retard" },
      },
    ],
  },
  {
    name: "Événement calendrier → Notes de réunion",
    enabled: false,
    trigger: { type: "calendar_event", config: { minutesBefore: 30 } },
    conditions: [],
    actions: [
      { id: "a1", type: "create_doc", params: { title: "Notes réunion" } },
    ],
  },
  {
    name: "Fichier uploadé → Auto-tag + notifier",
    enabled: false,
    trigger: { type: "file_uploaded", config: {} },
    conditions: [],
    actions: [
      { id: "a1", type: "auto_tag", params: {} },
      { id: "a2", type: "notify", params: { channel: "team" } },
    ],
  },
];

export function useWorkflowAutomations() {
  const [automations, setAutomations] = useState<WorkflowAutomation[]>([]);

  useEffect(() => {
    setAutomations(load());
  }, []);

  const add = useCallback(
    (automation: Omit<WorkflowAutomation, "id" | "createdAt" | "runCount">) => {
      const item: WorkflowAutomation = {
        ...automation,
        id: `wf_${Date.now()}`,
        createdAt: new Date().toISOString(),
        runCount: 0,
      };
      const next = [item, ...load()];
      persist(next);
      setAutomations(next);
      return item.id;
    },
    [],
  );

  const update = useCallback(
    (id: string, patch: Partial<WorkflowAutomation>) => {
      const next = load().map((a) => (a.id === id ? { ...a, ...patch } : a));
      persist(next);
      setAutomations(next);
    },
    [],
  );

  const remove = useCallback((id: string) => {
    const next = load().filter((a) => a.id !== id);
    persist(next);
    setAutomations(next);
  }, []);

  const toggle = useCallback((id: string) => {
    const next = load().map((a) =>
      a.id === id ? { ...a, enabled: !a.enabled } : a,
    );
    persist(next);
    setAutomations(next);
  }, []);

  const addFromTemplate = useCallback(
    (index: number) => {
      if (index < 0 || index >= TEMPLATES.length) return;
      return add(TEMPLATES[index]);
    },
    [add],
  );

  return {
    automations,
    templates: TEMPLATES,
    add,
    update,
    remove,
    toggle,
    addFromTemplate,
  };
}
