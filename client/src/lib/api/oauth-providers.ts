/**
 * OAuth Providers Admin API
 *
 * Wraps the 6 admin endpoints on signapps-identity:
 *   GET    /api/v1/admin/oauth-providers
 *   GET    /api/v1/admin/oauth-providers/:key
 *   POST   /api/v1/admin/oauth-providers/:key          (upsert)
 *   DELETE /api/v1/admin/oauth-providers/:key          (soft-delete)
 *   POST   /api/v1/admin/oauth-providers/:key/test
 *   GET    /api/v1/admin/oauth-providers/:key/stats
 */
import { getClient, ServiceName } from "./factory";
import type {
  OAuthPurpose,
  ProviderConfigDetail,
  ProviderConfigSummary,
  ProviderStats,
  TestProviderResponse,
  UpsertProviderConfigBody,
} from "@/types/oauth-providers";

const identityClient = getClient(ServiceName.IDENTITY);

const BASE = "/api/v1/admin/oauth-providers";

export async function listProviders(): Promise<ProviderConfigSummary[]> {
  const r = await identityClient.get<ProviderConfigSummary[]>(BASE);
  return r.data;
}

export async function getProvider(key: string): Promise<ProviderConfigDetail> {
  const r = await identityClient.get<ProviderConfigDetail>(
    `${BASE}/${encodeURIComponent(key)}`,
  );
  return r.data;
}

export async function upsertProvider(
  key: string,
  body: UpsertProviderConfigBody,
): Promise<ProviderConfigDetail> {
  const r = await identityClient.post<ProviderConfigDetail>(
    `${BASE}/${encodeURIComponent(key)}`,
    body,
  );
  return r.data;
}

export async function deleteProvider(key: string): Promise<void> {
  await identityClient.delete(`${BASE}/${encodeURIComponent(key)}`);
}

export async function testProvider(
  key: string,
  body: {
    client_id?: string;
    client_secret?: string;
    purpose: OAuthPurpose;
    redirect_after?: string;
  },
): Promise<TestProviderResponse> {
  const r = await identityClient.post<TestProviderResponse>(
    `${BASE}/${encodeURIComponent(key)}/test`,
    body,
  );
  return r.data;
}

export async function getProviderStats(key: string): Promise<ProviderStats> {
  const r = await identityClient.get<ProviderStats>(
    `${BASE}/${encodeURIComponent(key)}/stats`,
  );
  return r.data;
}
