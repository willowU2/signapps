// Feature 3: Project milestone → send notification to team

import { useCallback } from "react";
import { toast } from "sonner";

export type MilestoneEvent = "reached" | "at_risk" | "overdue" | "approaching";

export interface MilestoneNotificationPayload {
  milestoneId: string;
  milestoneName: string;
  projectName: string;
  targetDate: string;
  event: MilestoneEvent;
  teamMemberIds: string[];
}

const EVENT_CONFIG: Record<MilestoneEvent, { title: string; description: (p: MilestoneNotificationPayload) => string }> = {
  reached: {
    title: "Jalon atteint",
    description: (p) => `${p.milestoneName} du projet ${p.projectName} a été atteint.`,
  },
  at_risk: {
    title: "Jalon à risque",
    description: (p) => `${p.milestoneName} est à risque. Échéance: ${new Date(p.targetDate).toLocaleDateString("fr-FR")}.`,
  },
  overdue: {
    title: "Jalon en retard",
    description: (p) => `${p.milestoneName} dépasse son échéance du ${new Date(p.targetDate).toLocaleDateString("fr-FR")}.`,
  },
  approaching: {
    title: "Jalon imminent",
    description: (p) => `${p.milestoneName} arrive à échéance dans moins de 48h.`,
  },
};

export function useMilestoneNotifications() {
  const sendMilestoneNotification = useCallback((payload: MilestoneNotificationPayload) => {
    const config = EVENT_CONFIG[payload.event];

    // Show toast to current user
    const toastFn = payload.event === "overdue" ? toast.error
      : payload.event === "at_risk" ? toast.warning
      : toast.success;

    toastFn(config.title, {
      description: config.description(payload),
    });

    // Persist to notification store (compatible with existing notification system)
    const notification = {
      id: `milestone-${payload.milestoneId}-${Date.now()}`,
      type: "milestone" as const,
      title: config.title,
      message: config.description(payload),
      context: { projectName: payload.projectName, milestoneId: payload.milestoneId },
      recipients: payload.teamMemberIds,
      createdAt: new Date().toISOString(),
      read: false,
    };

    // Dispatch custom event for notification center to pick up
    window.dispatchEvent(new CustomEvent("agentiq:notification", { detail: notification }));

    return notification;
  }, []);

  const notifyMilestoneReached = useCallback((payload: Omit<MilestoneNotificationPayload, "event">) =>
    sendMilestoneNotification({ ...payload, event: "reached" }), [sendMilestoneNotification]);

  const notifyMilestoneAtRisk = useCallback((payload: Omit<MilestoneNotificationPayload, "event">) =>
    sendMilestoneNotification({ ...payload, event: "at_risk" }), [sendMilestoneNotification]);

  const notifyMilestoneOverdue = useCallback((payload: Omit<MilestoneNotificationPayload, "event">) =>
    sendMilestoneNotification({ ...payload, event: "overdue" }), [sendMilestoneNotification]);

  return { sendMilestoneNotification, notifyMilestoneReached, notifyMilestoneAtRisk, notifyMilestoneOverdue };
}
