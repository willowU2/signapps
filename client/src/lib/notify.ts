import { notificationsApi } from "@/lib/api/notifications";

/**
 * Send a cross-module notification (best-effort, silent on failure).
 *
 * Call this after a successful user action to notify the notification center.
 */
export async function notify(params: {
  title: string;
  body?: string;
  module: string;
  entity_type?: string;
  entity_id?: string;
  deep_link?: string;
}) {
  try {
    await notificationsApi.create({
      user_id: "", // filled by backend from JWT
      type: "system",
      ...params,
    });
  } catch {
    // Silent fail — notifications are best-effort
  }
}
