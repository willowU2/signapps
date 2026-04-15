/**
 * Audit trail logging for RGPD compliance
 */

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  details?: Record<string, unknown>;
  ip?: string;
}

export function createAuditEntry(
  userId: string,
  action: string,
  resource: string,
  resourceId: string,
  details?: Record<string, unknown>,
): AuditEntry {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    timestamp: new Date().toISOString(),
    userId,
    action,
    resource,
    resourceId,
    details,
  };
}

/**
 * RGPD: Export all user data as JSON
 */
export async function exportUserData(
  userId: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(`/api/rgpd/export/${userId}`);
  return response.json();
}

/**
 * RGPD: Request data deletion (right to be forgotten)
 */
export async function requestDataDeletion(
  userId: string,
): Promise<{ requestId: string }> {
  const response = await fetch(`/api/rgpd/delete/${userId}`, {
    method: "POST",
  });
  return response.json();
}
