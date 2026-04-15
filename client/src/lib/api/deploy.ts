/**
 * Deploy API Module
 *
 * Wraps the 13 endpoints of signapps-deploy exposed under /api/v1/deploy/.
 * Auth via the global Axios interceptor (JWT in Authorization header).
 */
import { getClient, ServiceName } from "./factory";

const deployClient = getClient(ServiceName.DEPLOY);
const PREFIX = "/api/v1/deploy";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnvStatus {
  env: "prod" | "dev";
  current_version: string | null;
  deployed_at: string | null;
}

export interface EnvHealth {
  env: string;
  containers: Record<string, boolean>;
  healthy: number;
  total: number;
}

export interface VersionEntry {
  version: string;
  last_deployed_at: string;
  envs: string[];
}

export interface DeploymentEntry {
  id: string;
  env: string;
  version: string;
  status: "pending" | "running" | "success" | "failed" | "rolled_back";
  triggered_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
}

export interface FeatureFlag {
  id: string;
  key: string;
  env: "prod" | "dev" | "all";
  enabled: boolean;
  rollout_percent: number;
  target_orgs: string[];
  target_users: string[];
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertFlagRequest {
  env: "prod" | "dev" | "all";
  enabled: boolean;
  rollout_percent: number;
  target_orgs: string[];
  target_users: string[];
  description?: string;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

export async function listEnvs(): Promise<EnvStatus[]> {
  const { data } = await deployClient.get<EnvStatus[]>(`${PREFIX}/envs`);
  return data;
}

export async function getEnvHealth(env: "prod" | "dev"): Promise<EnvHealth> {
  const { data } = await deployClient.get<EnvHealth>(
    `${PREFIX}/envs/${env}/health`,
  );
  return data;
}

export async function listVersions(): Promise<VersionEntry[]> {
  const { data } = await deployClient.get<VersionEntry[]>(`${PREFIX}/versions`);
  return data;
}

export async function listHistory(
  env?: string,
  limit = 50,
): Promise<DeploymentEntry[]> {
  const params: Record<string, string | number> = { limit };
  if (env) params.env = env;
  const { data } = await deployClient.get<DeploymentEntry[]>(
    `${PREFIX}/history`,
    { params },
  );
  return data;
}

export async function deploy(
  env: "prod" | "dev",
  version: string,
  confirm: string,
): Promise<{ status: string }> {
  const { data } = await deployClient.post(`${PREFIX}/envs/${env}/deploy`, {
    version,
    confirm,
  });
  return data;
}

export async function rollback(
  env: "prod" | "dev",
  confirm: string,
): Promise<{ status: string }> {
  const { data } = await deployClient.post(`${PREFIX}/envs/${env}/rollback`, {
    confirm,
  });
  return data;
}

export async function toggleMaintenance(
  env: "prod" | "dev",
  enable: boolean,
): Promise<{ env: string; enabled: boolean }> {
  const { data } = await deployClient.post(
    `${PREFIX}/envs/${env}/maintenance`,
    { enable },
  );
  return data;
}

export async function promote(confirm: string): Promise<{ status: string }> {
  const { data } = await deployClient.post(`${PREFIX}/promote`, { confirm });
  return data;
}

export async function listFlags(env?: string): Promise<FeatureFlag[]> {
  const params = env ? { env } : undefined;
  const { data } = await deployClient.get<FeatureFlag[]>(
    `${PREFIX}/feature-flags`,
    { params },
  );
  return data;
}

export async function getFlag(key: string, env = "prod"): Promise<FeatureFlag> {
  const { data } = await deployClient.get<FeatureFlag>(
    `${PREFIX}/feature-flags/${key}`,
    {
      params: { env },
    },
  );
  return data;
}

export async function upsertFlag(
  key: string,
  req: UpsertFlagRequest,
): Promise<FeatureFlag> {
  const { data } = await deployClient.put<FeatureFlag>(
    `${PREFIX}/feature-flags/${key}`,
    req,
  );
  return data;
}

export async function deleteFlag(
  key: string,
  env = "prod",
): Promise<{ deleted: boolean }> {
  const { data } = await deployClient.delete(`${PREFIX}/feature-flags/${key}`, {
    params: { env },
  });
  return data;
}
