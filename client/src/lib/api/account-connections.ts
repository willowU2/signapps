/**
 * Account Connections API (user-facing)
 *
 * Wraps the two user-facing OAuth connection endpoints on signapps-identity:
 *   GET  /api/v1/account/oauth-connections
 *   POST /api/v1/account/oauth-connections/:source_table/:id/disconnect
 */
import { getClient, ServiceName } from "./factory";

const identityClient = getClient(ServiceName.IDENTITY);

export interface AccountConnection {
  id: string;
  source_table:
    | "mail.accounts"
    | "calendar.provider_connections"
    | "social.accounts";
  provider_key: string;
  display_email: string | null;
  status: "connected" | "needs_reconnect";
  expires_at: string | null;
  disabled: boolean;
  last_error: string | null;
}

export async function listConnections(): Promise<AccountConnection[]> {
  const r = await identityClient.get<AccountConnection[]>(
    "/api/v1/account/oauth-connections",
  );
  return r.data;
}

export async function disconnect(
  sourceTable: string,
  id: string,
): Promise<void> {
  await identityClient.post(
    `/api/v1/account/oauth-connections/${encodeURIComponent(sourceTable)}/${id}/disconnect`,
  );
}
