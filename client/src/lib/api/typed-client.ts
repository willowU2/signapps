/**
 * Typed API Client - SignApps Platform
 *
 * AQ-TSDK: TypeScript SDK wrapper that provides fully typed API access
 * across all SignApps microservices. Aggregates all service APIs into
 * a single typed client with proper error handling.
 */

import { AxiosResponse } from 'axios';
import { getClient, ServiceName, checkServiceHealth, type HealthCheckResult } from './factory';

// Re-export service APIs for convenience
import { authApi, usersApi, rolesApi, groupsApi, webhooksApi, auditApi } from './identity';
import type {
  User, LoginRequest, LoginResponse, UserListResponse,
  CreateUserRequest, Role, CreateRoleRequest, Group, CreateGroupRequest,
  Webhook, CreateWebhookRequest,
  AuditLog, AuditLogFilters, AuditLogListResponse,
} from './identity';

import { containersApi, storeApi, composeApi, backupsApi, networksApi, volumesApi } from './containers';
import type {
  ContainerInfo, ContainerStats, CreateContainerRequest,
  StoreApp, ComposeProject, BackupProfile,
} from './containers';

import { storageApi, quotasApi, sharesApi, trashApi, searchApi as storageSearchApi, storageStatsApi } from './storage';
import type {
  Bucket, UploadResponse, ListObjectsResponse, ObjectInfo,
  QuotaUsage, ShareLink, TrashItem, StorageStats,
} from './storage';

import { mailApi } from './mail';
import type { MailAccount, Email, SendEmailRequest, MailStats } from './mail';

import { aiApi } from './ai';
import type { ChatResponse, AIStats, Model, KnowledgeBase } from './ai';

import { metricsApi, alertsApi } from './monitoring';
import type { SystemMetrics, MetricHistoryPoint, AlertConfig, AlertEvent } from './monitoring';

import { schedulerMetricsApi } from './metrics';
import type { WorkloadMetrics, ResourceMetrics } from './metrics';

// ---------------------------------------------------------------------------
// Error wrapper
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  service: string;
  data?: unknown;

  constructor(message: string, status: number, service: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.service = service;
    this.data = data;
  }
}

function unwrap<T>(res: AxiosResponse<T>): T {
  return res.data;
}

// ---------------------------------------------------------------------------
// Typed Client
// ---------------------------------------------------------------------------

export const typedClient = {
  // =========================================================================
  // Identity Service
  // =========================================================================
  identity: {
    auth: {
      login: (creds: LoginRequest) => authApi.login(creds).then(unwrap),
      logout: () => authApi.logout(),
      me: () => authApi.me().then(unwrap),
    },
    users: {
      list: (page?: number, limit?: number) => usersApi.list(page, limit).then(unwrap),
      get: (id: string) => usersApi.get(id).then(unwrap),
      create: (data: CreateUserRequest) => usersApi.create(data).then(unwrap),
      update: (id: string, data: Partial<CreateUserRequest>) => usersApi.update(id, data).then(unwrap),
      delete: (id: string) => usersApi.delete(id),
    },
    roles: {
      list: () => rolesApi.list().then(unwrap),
      get: (id: string) => rolesApi.get(id).then(unwrap),
      create: (data: CreateRoleRequest) => rolesApi.create(data).then(unwrap),
      update: (id: string, data: CreateRoleRequest) => rolesApi.update(id, data).then(unwrap),
      delete: (id: string) => rolesApi.delete(id),
    },
    groups: {
      list: () => groupsApi.list().then(unwrap),
      get: (id: string) => groupsApi.get(id).then(unwrap),
      create: (data: CreateGroupRequest) => groupsApi.create(data).then(unwrap),
    },
    webhooks: {
      list: () => webhooksApi.list().then(unwrap),
      get: (id: string) => webhooksApi.get(id).then(unwrap),
      create: (data: CreateWebhookRequest) => webhooksApi.create(data).then(unwrap),
      update: (id: string, data: Partial<CreateWebhookRequest>) => webhooksApi.update(id, data).then(unwrap),
      delete: (id: string) => webhooksApi.delete(id),
      test: (id: string) => webhooksApi.test(id).then(unwrap),
    },
    audit: {
      list: (filters?: AuditLogFilters) => auditApi.list(filters).then(unwrap),
      get: (id: string) => auditApi.get(id).then(unwrap),
      export: (filters?: AuditLogFilters) => auditApi.export(filters),
    },
  },

  // =========================================================================
  // Containers Service
  // =========================================================================
  containers: {
    list: (all?: boolean) => containersApi.list(all).then(unwrap),
    get: (id: string) => containersApi.get(id).then(unwrap),
    create: (data: CreateContainerRequest) => containersApi.create(data).then(unwrap),
    start: (id: string) => containersApi.start(id),
    stop: (id: string) => containersApi.stop(id),
    restart: (id: string) => containersApi.restart(id),
    delete: (id: string, force?: boolean) => containersApi.delete(id, force),
    stats: (id: string) => containersApi.stats(id).then(unwrap),
    logs: (id: string, tail?: number) => containersApi.logs(id, tail).then(unwrap),
    store: {
      list: (category?: string, search?: string) => storeApi.listApps(category, search).then(unwrap),
      install: (data: any) => storeApi.install(data).then(unwrap),
    },
    compose: {
      list: () => composeApi.listProjects().then(unwrap),
      get: (name: string) => composeApi.getProject(name).then(unwrap),
    },
    backups: {
      list: () => backupsApi.listProfiles().then(unwrap),
      run: (profileId: string) => backupsApi.createBackup(profileId).then(unwrap),
    },
  },

  // =========================================================================
  // Storage Service
  // =========================================================================
  storage: {
    buckets: {
      list: () => storageApi.listBuckets().then(unwrap),
      get: (name: string) => storageApi.getBucket(name).then(unwrap),
      create: (name: string) => storageApi.createBucket(name).then(unwrap),
    },
    files: {
      list: (bucket: string, prefix?: string) => storageApi.listFiles(bucket, prefix).then(unwrap),
      upload: (bucket: string, file: File) => storageApi.uploadFile(bucket, file).then(unwrap),
      delete: (bucket: string, key: string) => storageApi.deleteFile(bucket, key),
      download: (bucket: string, key: string) => storageApi.downloadFile(bucket, key),
    },
    quotas: {
      me: () => quotasApi.getMyQuota().then(unwrap),
      user: (userId: string) => quotasApi.getUserQuota(userId).then(unwrap),
      overLimit: () => quotasApi.getUsersOverLimit().then(unwrap),
    },
    shares: {
      list: () => sharesApi.list().then(unwrap),
      create: (data: any) => sharesApi.create(data).then(unwrap),
    },
    trash: {
      list: () => trashApi.list().then(unwrap),
      restore: (items: string[]) => trashApi.restore(items).then(unwrap),
    },
    stats: () => storageStatsApi.getStats().then(unwrap),
  },

  // =========================================================================
  // Mail Service
  // =========================================================================
  mail: {
    accounts: {
      list: () => mailApi.listAccounts().then(unwrap),
      get: (id: string) => mailApi.getAccount(id).then(unwrap),
    },
    emails: {
      list: (params?: any) => mailApi.listEmails(params).then(unwrap),
      get: (id: string) => mailApi.getEmail(id).then(unwrap),
      send: (data: SendEmailRequest) => mailApi.sendEmail(data).then(unwrap),
    },
    stats: () => mailApi.getStats().then(unwrap),
  },

  // =========================================================================
  // AI Service
  // =========================================================================
  ai: {
    chat: (question: string, options?: any) => aiApi.chat(question, options).then(unwrap),
    search: (query: string, limit?: number) => aiApi.search(query, limit).then(unwrap),
    stats: () => aiApi.stats().then(unwrap),
    models: (provider?: string) => aiApi.models(provider).then(unwrap),
    collections: {
      list: () => aiApi.listCollections().then(unwrap),
      get: (name: string) => aiApi.getCollection(name).then(unwrap),
    },
  },

  // =========================================================================
  // Metrics / Monitoring Service
  // =========================================================================
  metrics: {
    system: () => metricsApi.summary().then(unwrap),
    cpu: () => metricsApi.cpu().then(unwrap),
    memory: () => metricsApi.memory().then(unwrap),
    disk: () => metricsApi.disk().then(unwrap),
    history: (period: '5m' | '15m' | '1h' | '24h') => metricsApi.history(period).then(unwrap),
    alerts: {
      list: () => alertsApi.listConfigs().then(unwrap),
      active: () => alertsApi.listActive().then(unwrap),
      history: (limit?: number) => alertsApi.listHistory(limit).then(unwrap),
    },
  },

  // =========================================================================
  // Health Check
  // =========================================================================
  health: {
    check: (service: ServiceName) => checkServiceHealth(service),
    checkAll: async (): Promise<HealthCheckResult[]> => {
      const services = Object.values(ServiceName);
      return Promise.all(services.map(checkServiceHealth));
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Type exports for consumer code
// ---------------------------------------------------------------------------

export type {
  User, LoginRequest, LoginResponse, UserListResponse,
  CreateUserRequest, Role, CreateRoleRequest,
  Group, CreateGroupRequest,
  Webhook, CreateWebhookRequest,
  AuditLog, AuditLogFilters, AuditLogListResponse,
  ContainerInfo, ContainerStats, CreateContainerRequest,
  StoreApp, ComposeProject, BackupProfile,
  Bucket, UploadResponse, ListObjectsResponse, ObjectInfo,
  QuotaUsage, ShareLink, TrashItem, StorageStats,
  MailAccount, Email, SendEmailRequest, MailStats,
  ChatResponse, AIStats, Model, KnowledgeBase,
  SystemMetrics, MetricHistoryPoint, AlertConfig, AlertEvent,
  WorkloadMetrics, ResourceMetrics,
};

export type TypedClient = typeof typedClient;
