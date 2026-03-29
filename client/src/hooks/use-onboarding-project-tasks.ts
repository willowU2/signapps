// Feature 7: HR onboarding → create project tasks automatically

import { useState, useCallback } from "react";
import { toast } from "sonner";

export interface OnboardingRole {
  roleId: string;
  roleName: string;
  department: string;
  projectId: string;
  projectName: string;
  templateTasks: { title: string; daysFromStart: number; priority: "low" | "medium" | "high" }[];
}

export interface CreatedOnboardingTask {
  id: string;
  projectId: string;
  title: string;
  assigneeId: string;
  assigneeName: string;
  dueDate: string;
  priority: "low" | "medium" | "high";
  source: "onboarding";
  status: "pending" | "in_progress" | "done";
}

const ROLE_TEMPLATES: OnboardingRole[] = [
  {
    roleId: "dev",
    roleName: "Développeur",
    department: "Technologie",
    projectId: "p1",
    projectName: "Refonte Backend Auth",
    templateTasks: [
      { title: "Setup environnement dev", daysFromStart: 1, priority: "high" },
      { title: "Lire documentation architecture", daysFromStart: 2, priority: "high" },
      { title: "Pair programming avec le lead", daysFromStart: 3, priority: "medium" },
      { title: "Premier PR de correction", daysFromStart: 7, priority: "medium" },
    ],
  },
  {
    roleId: "ux",
    roleName: "Designer UX/UI",
    department: "Technologie",
    projectId: "p2",
    projectName: "Dashboard Analytics",
    templateTasks: [
      { title: "Revue du design system", daysFromStart: 1, priority: "high" },
      { title: "Audit UX de la page principale", daysFromStart: 3, priority: "medium" },
      { title: "Maquettes onboarding flow", daysFromStart: 5, priority: "high" },
    ],
  },
];

function addDays(from: string, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function useOnboardingProjectTasks() {
  const [tasks, setTasks] = useState<CreatedOnboardingTask[]>([]);
  const [creating, setCreating] = useState(false);

  const createTasksForNewHire = useCallback(async (params: {
    employeeId: string;
    employeeName: string;
    roleId: string;
    startDate: string;
  }) => {
    const template = ROLE_TEMPLATES.find((t) => t.roleId === params.roleId);
    if (!template) {
      toast.error("Aucun template de tâches pour ce rôle.");
      return [];
    }

    setCreating(true);
    await new Promise((resolve) => setTimeout(resolve, 600));

    const created: CreatedOnboardingTask[] = template.templateTasks.map((tt, i) => ({
      id: `onb-${params.employeeId}-${Date.now()}-${i}`,
      projectId: template.projectId,
      title: tt.title,
      assigneeId: params.employeeId,
      assigneeName: params.employeeName,
      dueDate: addDays(params.startDate, tt.daysFromStart),
      priority: tt.priority,
      source: "onboarding" as const,
      status: "pending" as const,
    }));

    setTasks((prev) => [...prev, ...created]);
    setCreating(false);

    toast.success(`${created.length} tâches d'onboarding créées`, {
      description: `Assignées à ${params.employeeName} sur ${template.projectName}.`,
    });

    return created;
  }, []);

  const getRoleTemplates = useCallback(() => ROLE_TEMPLATES, []);

  return { tasks, creating, createTasksForNewHire, getRoleTemplates };
}
