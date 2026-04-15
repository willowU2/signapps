# Multi-Env Deployment — Phase 3b (Admin UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer 6 pages admin Next.js qui pilotent l'API Phase 3a : environnements, versions, feature flags, maintenance, runtime config, clients on-premise. L'admin peut déployer, rollback, promouvoir, activer des flags et programmer des maintenances — tout depuis le navigateur.

**Architecture:** Pages sous `client/src/app/admin/deploy/`. Un seul API client `deploy.ts` (pattern `getClient(ServiceName.DEPLOY)` existant). Un store Zustand pour l'état partagé (environnements, versions en cours). Un hook WebSocket `useDeployEvents` qui écoute `/api/v1/deploy/events` et propage les événements dans le store. Composants UI en shadcn (déjà en place). Auth gating via le middleware existant qui redirige les non-superadmins.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4 (tokens sémantiques), shadcn/ui, Zustand, react-hook-form + zod, Axios (via factory), tanstack-query pour fetch/mutations, native WebSocket API.

**Scope:** Phase 3b uniquement. Prérequis : Phase 3a (API backend) disponible sur `DEPLOY_PORT=3700` avec `DEPLOY_API_ENABLED=true`.

---

## File Structure

### Fichiers créés

| Fichier | Responsabilité |
|---|---|
| `client/src/lib/api/deploy.ts` | API client : types + wrappers pour les 13 endpoints Phase 3a |
| `client/src/hooks/useDeployEvents.ts` | WebSocket subscription, reconnexion exponentielle, push dans le store |
| `client/src/stores/deploy-store.ts` | Zustand : envs, versions courantes, deploy en cours, logs |
| `client/src/app/admin/deploy/layout.tsx` | Sub-layout avec onglets (6 pages) |
| `client/src/app/admin/deploy/page.tsx` | Page "Environnements" (dashboard) |
| `client/src/app/admin/deploy/versions/page.tsx` | Page "Versions" |
| `client/src/app/admin/deploy/feature-flags/page.tsx` | Page "Feature Flags" |
| `client/src/app/admin/deploy/maintenance/page.tsx` | Page "Maintenance" |
| `client/src/app/admin/deploy/runtime-config/page.tsx` | Page "Runtime Config" |
| `client/src/app/admin/deploy/on-premise/page.tsx` | Page "Clients on-premise" (placeholder) |
| `client/src/components/admin/deploy/EnvCard.tsx` | Carte d'environnement |
| `client/src/components/admin/deploy/ConfirmationDialog.tsx` | Dialog "Tapez X pour confirmer" |
| `client/src/components/admin/deploy/DeployDrawer.tsx` | Drawer logs live + statut d'un deploy |
| `client/src/components/admin/deploy/FeatureFlagRow.tsx` | Ligne tableau feature flag |
| `client/src/components/admin/deploy/FeatureFlagEditor.tsx` | Form drawer pour éditer un flag |
| `client/src/components/admin/deploy/MaintenanceWindowCard.tsx` | Carte fenêtre de maintenance |
| `client/src/components/admin/deploy/ScheduleMaintenanceForm.tsx` | Form pour programmer une maintenance |
| `client/tests/e2e/admin-deploy.spec.ts` | Tests Playwright E2E |

### Fichiers modifiés

| Fichier | Modification |
|---|---|
| `client/src/lib/api/factory.ts` | Ajouter `DEPLOY = "deploy"` à `ServiceName` + `SERVICE_CONFIG` entry (port 3700) + case dans `getServiceBaseUrl` |
| `client/src/app/admin/layout.tsx` ou équivalent | Ajouter entrée "Déploiement" dans la navigation admin |
| `.env.example` (client) | `NEXT_PUBLIC_DEPLOY_URL=http://localhost:3700` |

---

## Task 1: API client — `ServiceName.DEPLOY` + factory config

**Files:**
- Modify: `client/src/lib/api/factory.ts`
- Modify: `client/.env.example` (ou `client/src/env.d.ts` selon la convention)

- [ ] **Step 1: Ajouter DEPLOY au ServiceName enum**

Dans `client/src/lib/api/factory.ts`, ligne 35 (`export enum ServiceName`), ajouter après `COLLABORATION_SVC = "collaboration-svc",` :

```typescript
  DEPLOY = "deploy",
```

- [ ] **Step 2: Ajouter la config du service**

Dans le même fichier, dans `const SERVICE_CONFIG: Record<ServiceName, ServiceConfig>`, ajouter :

```typescript
  [ServiceName.DEPLOY]: {
    port: 3700,
    envVar: "NEXT_PUBLIC_DEPLOY_URL",
    healthPath: "/health",
  },
```

- [ ] **Step 3: Propager dans les switch statements**

Dans `getServiceBaseUrl` (ligne ~326 et ~447 selon ce qui existe), ajouter :

```typescript
    case ServiceName.DEPLOY:
      envValue = process.env.NEXT_PUBLIC_DEPLOY_URL || null;
      break;
```

- [ ] **Step 4: Vérifier type-check**

Run : `cd client && npx tsc --noEmit 2>&1 | tail -10`
Expected : 0 nouvelle erreur.

- [ ] **Step 5: Commit**

```bash
rtk git add client/src/lib/api/factory.ts
rtk git commit -m "feat(client): add DEPLOY service to API factory (port 3700)"
```

---

## Task 2: API client `deploy.ts` — types + wrappers

**Files:**
- Create: `client/src/lib/api/deploy.ts`

- [ ] **Step 1: Écrire le fichier**

```typescript
/**
 * Deploy API Module
 *
 * Wraps the 13 endpoints of signapps-deploy exposed under /api/v1/deploy/.
 * Auth via the global Axios interceptor (JWT in Authorization header).
 */
import { getClient, ServiceName } from './factory';

const deployClient = getClient(ServiceName.DEPLOY);
const PREFIX = '/api/v1/deploy';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnvStatus {
  env: 'prod' | 'dev';
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
  status: 'pending' | 'running' | 'success' | 'failed' | 'rolled_back';
  triggered_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
}

export interface FeatureFlag {
  id: string;
  key: string;
  env: 'prod' | 'dev' | 'all';
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
  env: 'prod' | 'dev' | 'all';
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

export async function getEnvHealth(env: 'prod' | 'dev'): Promise<EnvHealth> {
  const { data } = await deployClient.get<EnvHealth>(`${PREFIX}/envs/${env}/health`);
  return data;
}

export async function listVersions(): Promise<VersionEntry[]> {
  const { data } = await deployClient.get<VersionEntry[]>(`${PREFIX}/versions`);
  return data;
}

export async function listHistory(env?: string, limit = 50): Promise<DeploymentEntry[]> {
  const params: Record<string, string | number> = { limit };
  if (env) params.env = env;
  const { data } = await deployClient.get<DeploymentEntry[]>(`${PREFIX}/history`, { params });
  return data;
}

export async function deploy(env: 'prod' | 'dev', version: string, confirm: string): Promise<{ status: string }> {
  const { data } = await deployClient.post(`${PREFIX}/envs/${env}/deploy`, { version, confirm });
  return data;
}

export async function rollback(env: 'prod' | 'dev', confirm: string): Promise<{ status: string }> {
  const { data } = await deployClient.post(`${PREFIX}/envs/${env}/rollback`, { confirm });
  return data;
}

export async function toggleMaintenance(env: 'prod' | 'dev', enable: boolean): Promise<{ env: string; enabled: boolean }> {
  const { data } = await deployClient.post(`${PREFIX}/envs/${env}/maintenance`, { enable });
  return data;
}

export async function promote(confirm: string): Promise<{ status: string }> {
  const { data } = await deployClient.post(`${PREFIX}/promote`, { confirm });
  return data;
}

export async function listFlags(env?: string): Promise<FeatureFlag[]> {
  const params = env ? { env } : undefined;
  const { data } = await deployClient.get<FeatureFlag[]>(`${PREFIX}/feature-flags`, { params });
  return data;
}

export async function getFlag(key: string, env = 'prod'): Promise<FeatureFlag> {
  const { data } = await deployClient.get<FeatureFlag>(`${PREFIX}/feature-flags/${key}`, {
    params: { env },
  });
  return data;
}

export async function upsertFlag(key: string, req: UpsertFlagRequest): Promise<FeatureFlag> {
  const { data } = await deployClient.put<FeatureFlag>(`${PREFIX}/feature-flags/${key}`, req);
  return data;
}

export async function deleteFlag(key: string, env = 'prod'): Promise<{ deleted: boolean }> {
  const { data } = await deployClient.delete(`${PREFIX}/feature-flags/${key}`, {
    params: { env },
  });
  return data;
}
```

- [ ] **Step 2: Type-check**

Run : `cd client && npx tsc --noEmit 2>&1 | grep "src/lib/api/deploy" | head -5`
Expected : 0 erreurs.

- [ ] **Step 3: Commit**

```bash
rtk git add client/src/lib/api/deploy.ts
rtk git commit -m "feat(client): deploy API wrapper with 13 endpoints"
```

---

## Task 3: WebSocket hook `useDeployEvents`

**Files:**
- Create: `client/src/hooks/useDeployEvents.ts`

- [ ] **Step 1: Écrire le hook**

```typescript
/**
 * Subscribe to /api/v1/deploy/events WebSocket.
 *
 * Auto-reconnects with exponential backoff (1s, 2s, 4s, 8s, max 30s).
 * Emits each JSON frame to the provided callback.
 */
import { useEffect, useRef } from 'react';
import { getServiceBaseUrl, ServiceName } from '@/lib/api/factory';

export interface DeployEvent {
  channel: string;
  payload: unknown;
}

export function useDeployEvents(onEvent: (event: DeployEvent) => void) {
  const reconnectDelay = useRef(1000);
  const shouldRun = useRef(true);

  useEffect(() => {
    shouldRun.current = true;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!shouldRun.current) return;

      const baseUrl = getServiceBaseUrl(ServiceName.DEPLOY);
      const wsUrl = baseUrl.replace(/^http/, 'ws') + '/api/v1/deploy/events';
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        reconnectDelay.current = 1000;
      };

      socket.onmessage = (e) => {
        try {
          const frame: DeployEvent = JSON.parse(e.data);
          onEvent(frame);
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        if (!shouldRun.current) return;
        reconnectTimer = setTimeout(connect, reconnectDelay.current);
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      shouldRun.current = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [onEvent]);
}
```

- [ ] **Step 2: Type-check**

Run : `cd client && npx tsc --noEmit 2>&1 | grep "useDeployEvents" | head`
Expected : 0 erreurs.

- [ ] **Step 3: Commit**

```bash
rtk git add client/src/hooks/useDeployEvents.ts
rtk git commit -m "feat(client): WebSocket hook for deploy events with auto-reconnect"
```

---

## Task 4: Zustand store `deploy-store.ts`

**Files:**
- Create: `client/src/stores/deploy-store.ts`

- [ ] **Step 1: Écrire le store**

```typescript
/**
 * Deploy page state. Holds the envs list, currently running deploy (if any),
 * and a short log ring for the WebSocket frames.
 */
import { create } from 'zustand';
import type { EnvStatus, DeploymentEntry } from '@/lib/api/deploy';

const MAX_LOG_FRAMES = 200;

interface LogFrame {
  timestamp: string;
  channel: string;
  payload: unknown;
}

interface DeployState {
  envs: EnvStatus[];
  activeDeployment: DeploymentEntry | null;
  logFrames: LogFrame[];
  setEnvs: (envs: EnvStatus[]) => void;
  setActiveDeployment: (d: DeploymentEntry | null) => void;
  pushLogFrame: (frame: Omit<LogFrame, 'timestamp'>) => void;
  clearLogs: () => void;
}

export const useDeployStore = create<DeployState>((set) => ({
  envs: [],
  activeDeployment: null,
  logFrames: [],
  setEnvs: (envs) => set({ envs }),
  setActiveDeployment: (activeDeployment) => set({ activeDeployment }),
  pushLogFrame: (frame) =>
    set((state) => ({
      logFrames: [
        { ...frame, timestamp: new Date().toISOString() },
        ...state.logFrames,
      ].slice(0, MAX_LOG_FRAMES),
    })),
  clearLogs: () => set({ logFrames: [] }),
}));
```

- [ ] **Step 2: Type-check + commit**

```bash
cd client && npx tsc --noEmit 2>&1 | grep "deploy-store" | head
rtk git add client/src/stores/deploy-store.ts
rtk git commit -m "feat(client): Zustand store for deploy UI"
```

---

## Task 5: `ConfirmationDialog` component (shared)

**Files:**
- Create: `client/src/components/admin/deploy/ConfirmationDialog.tsx`

- [ ] **Step 1: Écrire le composant**

```tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** The exact text the operator must type to confirm. */
  confirmationToken: string;
  onConfirm: () => void | Promise<void>;
  danger?: boolean;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmationToken,
  onConfirm,
  danger = false,
}: ConfirmationDialogProps) {
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const matches = input === confirmationToken;

  const handle = async () => {
    if (!matches) return;
    setSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
      setInput('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-input">
            Tape <code className="rounded bg-muted px-1 py-0.5 font-mono">{confirmationToken}</code> pour confirmer
          </Label>
          <Input
            id="confirm-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={confirmationToken}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            variant={danger ? 'destructive' : 'default'}
            disabled={!matches || submitting}
            onClick={handle}
          >
            {submitting ? 'En cours…' : 'Confirmer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd client && npx tsc --noEmit 2>&1 | grep ConfirmationDialog | head
rtk git add client/src/components/admin/deploy/ConfirmationDialog.tsx
rtk git commit -m "feat(client): ConfirmationDialog component for destructive actions"
```

---

## Task 6: Sub-layout `/admin/deploy` + navigation

**Files:**
- Create: `client/src/app/admin/deploy/layout.tsx`
- Modify: admin sidebar (grep pour trouver où ajouter "Déploiement")

- [ ] **Step 1: Créer le layout avec onglets**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/admin/deploy', label: 'Environnements' },
  { href: '/admin/deploy/versions', label: 'Versions' },
  { href: '/admin/deploy/feature-flags', label: 'Feature Flags' },
  { href: '/admin/deploy/maintenance', label: 'Maintenance' },
  { href: '/admin/deploy/runtime-config', label: 'Runtime Config' },
  { href: '/admin/deploy/on-premise', label: 'On-premise' },
];

export default function DeployLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Déploiement</h1>
        <p className="text-muted-foreground">
          Gestion des environnements prod/dev, versions, feature flags et maintenances.
        </p>
      </div>

      <nav className="border-b border-border">
        <ul className="flex gap-1">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={cn(
                    'inline-block rounded-t-md px-4 py-2 text-sm transition-colors',
                    active
                      ? 'bg-card text-foreground border-b-2 border-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div>{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Ajouter l'entrée dans le shell admin**

Run : `rtk grep -l "admin.*sidebar\|admin-nav\|admin/users" client/src/components/admin/ client/src/app/admin/ 2>&1 | head`

Identifier le composant sidebar. Ajouter une entrée :

```tsx
{ href: '/admin/deploy', label: 'Déploiement', icon: <Rocket /> }
```

(Adapter l'icône au pattern lucide-react utilisé dans le projet.)

- [ ] **Step 3: Commit**

```bash
rtk git add client/src/app/admin/deploy/layout.tsx client/src/components/admin/
rtk git commit -m "feat(client): /admin/deploy sub-layout with 6 tabs"
```

---

## Task 7: Page "Environnements"

**Files:**
- Create: `client/src/app/admin/deploy/page.tsx`
- Create: `client/src/components/admin/deploy/EnvCard.tsx`

- [ ] **Step 1: EnvCard component**

```tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { EnvStatus, EnvHealth } from '@/lib/api/deploy';

interface Props {
  status: EnvStatus;
  health: EnvHealth | null;
  onDeploy: () => void;
  onRollback: () => void;
  onToggleMaintenance: (enable: boolean) => void;
}

export function EnvCard({ status, health, onDeploy, onRollback, onToggleMaintenance }: Props) {
  const healthy = health && health.total > 0 && health.healthy === health.total;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-lg capitalize">{status.env}</CardTitle>
        {health && (
          <Badge variant={healthy ? 'default' : 'destructive'}>
            {health.healthy}/{health.total} healthy
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Version actuelle</p>
          <p className="font-mono">{status.current_version ?? '—'}</p>
        </div>
        {status.deployed_at && (
          <div>
            <p className="text-sm text-muted-foreground">Déployée le</p>
            <p className="text-sm">{new Date(status.deployed_at).toLocaleString()}</p>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={onDeploy}>Déployer…</Button>
          <Button size="sm" variant="outline" onClick={onRollback}>Rollback</Button>
          <Button size="sm" variant="ghost" onClick={() => onToggleMaintenance(true)}>
            Maintenance ON
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onToggleMaintenance(false)}>
            Maintenance OFF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Page Environnements**

```tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  listEnvs,
  getEnvHealth,
  deploy,
  rollback,
  toggleMaintenance,
  promote,
} from '@/lib/api/deploy';
import { EnvCard } from '@/components/admin/deploy/EnvCard';
import { ConfirmationDialog } from '@/components/admin/deploy/ConfirmationDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type PendingAction =
  | { kind: 'deploy'; env: 'prod' | 'dev' }
  | { kind: 'rollback'; env: 'prod' | 'dev' }
  | { kind: 'promote' }
  | null;

export default function DeployEnvsPage() {
  const [pending, setPending] = useState<PendingAction>(null);
  const [version, setVersion] = useState('');
  const queryClient = useQueryClient();

  const envsQ = useQuery({ queryKey: ['deploy', 'envs'], queryFn: listEnvs, refetchInterval: 10_000 });
  const prodH = useQuery({ queryKey: ['deploy', 'health', 'prod'], queryFn: () => getEnvHealth('prod'), refetchInterval: 10_000 });
  const devH = useQuery({ queryKey: ['deploy', 'health', 'dev'], queryFn: () => getEnvHealth('dev'), refetchInterval: 10_000 });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['deploy'] });

  const deployMut = useMutation({
    mutationFn: ({ env, version, confirm }: { env: 'prod' | 'dev'; version: string; confirm: string }) =>
      deploy(env, version, confirm),
    onSuccess: invalidate,
  });
  const rollbackMut = useMutation({
    mutationFn: ({ env, confirm }: { env: 'prod' | 'dev'; confirm: string }) => rollback(env, confirm),
    onSuccess: invalidate,
  });
  const maintMut = useMutation({
    mutationFn: ({ env, enable }: { env: 'prod' | 'dev'; enable: boolean }) => toggleMaintenance(env, enable),
    onSuccess: invalidate,
  });
  const promoteMut = useMutation({
    mutationFn: (confirm: string) => promote(confirm),
    onSuccess: invalidate,
  });

  if (envsQ.isLoading) return <div>Chargement…</div>;
  const envs = envsQ.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-medium">Environnements</h2>
        <Button onClick={() => setPending({ kind: 'promote' })}>
          Promouvoir dev → prod
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {envs.map((e) => (
          <EnvCard
            key={e.env}
            status={e}
            health={e.env === 'prod' ? prodH.data ?? null : devH.data ?? null}
            onDeploy={() => setPending({ kind: 'deploy', env: e.env })}
            onRollback={() => setPending({ kind: 'rollback', env: e.env })}
            onToggleMaintenance={(enable) => maintMut.mutate({ env: e.env, enable })}
          />
        ))}
      </div>

      {pending?.kind === 'deploy' && (
        <>
          <div className="rounded-lg border border-border bg-card p-4">
            <Label htmlFor="version-input">Version à déployer</Label>
            <Input id="version-input" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1.2.3" />
          </div>
          <ConfirmationDialog
            open={true}
            onOpenChange={(o) => { if (!o) setPending(null); }}
            title={`Déployer ${version} sur ${pending.env}`}
            description={pending.env === 'prod' ? 'Action destructive en production.' : 'Déploiement sur l\'env de staging.'}
            confirmationToken={pending.env === 'prod' ? `DEPLOY PROD ${version}` : `deploy-dev-${version}`}
            onConfirm={() => deployMut.mutateAsync({ env: pending.env, version, confirm: pending.env === 'prod' ? `DEPLOY PROD ${version}` : `deploy-dev-${version}` })}
            danger={pending.env === 'prod'}
          />
        </>
      )}

      {pending?.kind === 'rollback' && (
        <ConfirmationDialog
          open={true}
          onOpenChange={(o) => { if (!o) setPending(null); }}
          title={`Rollback ${pending.env}`}
          description="Revient à la dernière version déployée avec succès."
          confirmationToken={pending.env === 'prod' ? 'ROLLBACK PROD' : 'ROLLBACK DEV'}
          onConfirm={() => rollbackMut.mutateAsync({ env: pending.env, confirm: pending.env === 'prod' ? 'ROLLBACK PROD' : 'ROLLBACK DEV' })}
          danger
        />
      )}

      {pending?.kind === 'promote' && (
        <ConfirmationDialog
          open={true}
          onOpenChange={(o) => { if (!o) setPending(null); }}
          title="Promouvoir dev vers prod"
          description="La dernière version déployée sur dev sera redéployée sur prod."
          confirmationToken="PROMOTE TO PROD"
          onConfirm={() => promoteMut.mutateAsync('PROMOTE TO PROD')}
          danger
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check + smoke test (pas besoin de backend tant qu'on test compilation seule)**

```bash
cd client && npx tsc --noEmit 2>&1 | grep -E "admin/deploy|EnvCard" | head
```

- [ ] **Step 4: Commit**

```bash
rtk git add client/src/app/admin/deploy/page.tsx client/src/components/admin/deploy/EnvCard.tsx
rtk git commit -m "feat(client): /admin/deploy Environnements page with EnvCard"
```

---

## Task 8: Page "Versions"

**Files:**
- Create: `client/src/app/admin/deploy/versions/page.tsx`

- [ ] **Step 1: Écrire la page**

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { listVersions, listHistory } from '@/lib/api/deploy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function VersionsPage() {
  const versions = useQuery({ queryKey: ['deploy', 'versions'], queryFn: listVersions });
  const history = useQuery({ queryKey: ['deploy', 'history'], queryFn: () => listHistory(undefined, 50) });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Versions distinctes</CardTitle>
        </CardHeader>
        <CardContent>
          {versions.isLoading && <p>Chargement…</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Dernier déploiement</TableHead>
                <TableHead>Environnements</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.data?.map((v) => (
                <TableRow key={v.version}>
                  <TableCell className="font-mono">{v.version}</TableCell>
                  <TableCell>{new Date(v.last_deployed_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {v.envs.map((env) => (
                      <Badge key={env} variant="secondary" className="mr-1">
                        {env}
                      </Badge>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Env</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Durée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.data?.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{new Date(d.triggered_at).toLocaleString()}</TableCell>
                  <TableCell>{d.env}</TableCell>
                  <TableCell className="font-mono">{d.version}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        d.status === 'success'
                          ? 'default'
                          : d.status === 'failed' || d.status === 'rolled_back'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{d.duration_seconds ? `${d.duration_seconds}s` : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + commit**

```bash
cd client && npx tsc --noEmit 2>&1 | grep versions | head
rtk git add client/src/app/admin/deploy/versions/page.tsx
rtk git commit -m "feat(client): /admin/deploy/versions page (versions + history)"
```

---

## Task 9: Page "Feature Flags" + éditeur

**Files:**
- Create: `client/src/app/admin/deploy/feature-flags/page.tsx`
- Create: `client/src/components/admin/deploy/FeatureFlagRow.tsx`
- Create: `client/src/components/admin/deploy/FeatureFlagEditor.tsx`

- [ ] **Step 1: FeatureFlagRow**

```tsx
'use client';

import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import type { FeatureFlag } from '@/lib/api/deploy';

interface Props {
  flag: FeatureFlag;
  onEdit: (flag: FeatureFlag) => void;
  onDelete: (flag: FeatureFlag) => void;
}

export function FeatureFlagRow({ flag, onEdit, onDelete }: Props) {
  return (
    <TableRow>
      <TableCell className="font-mono">{flag.key}</TableCell>
      <TableCell>
        <Badge variant="outline">{flag.env}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={flag.enabled ? 'default' : 'secondary'}>
          {flag.enabled ? 'ON' : 'OFF'}
        </Badge>
      </TableCell>
      <TableCell>{flag.rollout_percent}%</TableCell>
      <TableCell>
        {flag.target_users.length} users, {flag.target_orgs.length} orgs
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">{flag.description ?? '—'}</TableCell>
      <TableCell className="text-right">
        <Button size="icon" variant="ghost" onClick={() => onEdit(flag)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onDelete(flag)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
```

- [ ] **Step 2: FeatureFlagEditor (drawer form)**

```tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FeatureFlag, UpsertFlagRequest } from '@/lib/api/deploy';

const schema = z.object({
  key: z.string().min(1),
  env: z.enum(['prod', 'dev', 'all']),
  enabled: z.boolean(),
  rollout_percent: z.number().int().min(0).max(100),
  description: z.string().optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: FeatureFlag | null;
  onSave: (key: string, req: UpsertFlagRequest) => Promise<void>;
}

export function FeatureFlagEditor({ open, onOpenChange, initial, onSave }: Props) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      key: initial?.key ?? '',
      env: initial?.env ?? 'prod',
      enabled: initial?.enabled ?? false,
      rollout_percent: initial?.rollout_percent ?? 100,
      description: initial?.description ?? '',
    },
  });

  const submit = form.handleSubmit(async (data) => {
    await onSave(data.key, {
      env: data.env,
      enabled: data.enabled,
      rollout_percent: data.rollout_percent,
      target_orgs: initial?.target_orgs ?? [],
      target_users: initial?.target_users ?? [],
      description: data.description || undefined,
    });
    onOpenChange(false);
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>{initial ? `Édition: ${initial.key}` : 'Nouveau feature flag'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={submit} className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="key">Clé</Label>
            <Input id="key" {...form.register('key')} disabled={!!initial} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="env">Environnement</Label>
            <Select value={form.watch('env')} onValueChange={(v) => form.setValue('env', v as 'prod' | 'dev' | 'all')}>
              <SelectTrigger id="env"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prod">prod</SelectItem>
                <SelectItem value="dev">dev</SelectItem>
                <SelectItem value="all">all</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="enabled"
              checked={form.watch('enabled')}
              onCheckedChange={(checked) => form.setValue('enabled', checked)}
            />
            <Label htmlFor="enabled">Activé</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rollout">Rollout (%)</Label>
            <Input
              id="rollout"
              type="number"
              min={0}
              max={100}
              {...form.register('rollout_percent', { valueAsNumber: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...form.register('description')} />
          </div>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Page Feature Flags**

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listFlags, upsertFlag, deleteFlag } from '@/lib/api/deploy';
import { FeatureFlagRow } from '@/components/admin/deploy/FeatureFlagRow';
import { FeatureFlagEditor } from '@/components/admin/deploy/FeatureFlagEditor';
import { ConfirmationDialog } from '@/components/admin/deploy/ConfirmationDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { FeatureFlag } from '@/lib/api/deploy';

export default function FeatureFlagsPage() {
  const [editing, setEditing] = useState<FeatureFlag | 'new' | null>(null);
  const [deleting, setDeleting] = useState<FeatureFlag | null>(null);
  const queryClient = useQueryClient();

  const flagsQ = useQuery({ queryKey: ['deploy', 'flags'], queryFn: () => listFlags() });
  const upsertMut = useMutation({
    mutationFn: ({ key, req }: { key: string; req: Parameters<typeof upsertFlag>[1] }) => upsertFlag(key, req),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deploy', 'flags'] }),
  });
  const deleteMut = useMutation({
    mutationFn: ({ key, env }: { key: string; env: string }) => deleteFlag(key, env),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deploy', 'flags'] }),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Feature Flags</CardTitle>
        <Button onClick={() => setEditing('new')}>Nouveau flag</Button>
      </CardHeader>
      <CardContent>
        {flagsQ.isLoading && <p>Chargement…</p>}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clé</TableHead>
              <TableHead>Env</TableHead>
              <TableHead>Activé</TableHead>
              <TableHead>Rollout</TableHead>
              <TableHead>Ciblage</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flagsQ.data?.map((f) => (
              <FeatureFlagRow
                key={`${f.key}:${f.env}`}
                flag={f}
                onEdit={(flag) => setEditing(flag)}
                onDelete={(flag) => setDeleting(flag)}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <FeatureFlagEditor
        open={editing !== null}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        initial={editing === 'new' ? null : editing}
        onSave={async (key, req) => { await upsertMut.mutateAsync({ key, req }); }}
      />

      {deleting && (
        <ConfirmationDialog
          open={true}
          onOpenChange={(o) => { if (!o) setDeleting(null); }}
          title={`Supprimer le flag '${deleting.key}' (${deleting.env})`}
          description="Cette action est irréversible."
          confirmationToken={`DELETE ${deleting.key}`}
          onConfirm={async () => { await deleteMut.mutateAsync({ key: deleting.key, env: deleting.env }); }}
          danger
        />
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Type-check + commit**

```bash
cd client && npx tsc --noEmit 2>&1 | grep feature-flags | head
rtk git add client/src/app/admin/deploy/feature-flags/page.tsx client/src/components/admin/deploy/FeatureFlag*
rtk git commit -m "feat(client): feature-flags page with CRUD editor"
```

---

## Task 10: Page "Maintenance"

**Files:**
- Create: `client/src/app/admin/deploy/maintenance/page.tsx`

Note : la liste des maintenances passées/planifiées n'est pas exposée par l'API Phase 3a (seulement via CLI `list-maintenance`). Pour Phase 3b on montre :
- Toggle direct : enable/disable maintenance flag sur prod/dev (via `POST /envs/{env}/maintenance`)
- Texte informatif : "Pour programmer une fenêtre de maintenance à l'avance, utilise la CLI : `just schedule-maintenance prod 2026-04-20T03:00:00Z 15 "msg"` (endpoint API à venir en Phase 3c)"

- [ ] **Step 1: Écrire la page**

```tsx
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toggleMaintenance } from '@/lib/api/deploy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function MaintenancePage() {
  const queryClient = useQueryClient();
  const maintMut = useMutation({
    mutationFn: ({ env, enable }: { env: 'prod' | 'dev'; enable: boolean }) => toggleMaintenance(env, enable),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deploy'] }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Maintenance manuelle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(['prod', 'dev'] as const).map((env) => (
            <div key={env} className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="font-medium capitalize">{env}</p>
                <p className="text-sm text-muted-foreground">
                  Quand activé, le proxy sert la page de maintenance pour {env}.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => maintMut.mutate({ env, enable: true })}
                  disabled={maintMut.isPending}
                >
                  Activer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => maintMut.mutate({ env, enable: false })}
                  disabled={maintMut.isPending}
                >
                  Désactiver
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Alert>
        <AlertDescription>
          La gestion des fenêtres de maintenance planifiées est disponible via CLI :{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">just schedule-maintenance prod 2026-04-20T03:00:00Z 15 &quot;msg&quot;</code>.
          Les endpoints API correspondants arriveront en Phase 3c.
        </AlertDescription>
      </Alert>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd client && npx tsc --noEmit 2>&1 | grep maintenance | head
rtk git add client/src/app/admin/deploy/maintenance/page.tsx
rtk git commit -m "feat(client): /admin/deploy/maintenance page (toggle + info)"
```

---

## Task 11: Pages "Runtime Config" + "On-premise" (placeholders)

**Files:**
- Create: `client/src/app/admin/deploy/runtime-config/page.tsx`
- Create: `client/src/app/admin/deploy/on-premise/page.tsx`

Ces 2 pages sont des placeholders pour Phase 3b. Leurs backends n'existent pas encore (runtime_config table est là mais pas d'endpoints ; on-premise est Phase 4 entièrement).

- [ ] **Step 1: Runtime Config placeholder**

```tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function RuntimeConfigPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Runtime Config</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTitle>Bientôt disponible</AlertTitle>
            <AlertDescription>
              La table <code>runtime_config</code> est en place (migration 307), mais les endpoints
              REST correspondants seront livrés en Phase 3c. En attendant, la config runtime reste
              pilotée via variables d&apos;environnement au boot de chaque service.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: On-premise placeholder**

```tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function OnPremisePage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Clients on-premise</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTitle>Phase 4</AlertTitle>
            <AlertDescription>
              La liste des déploiements on-premise et leur télémétrie anonymisée seront
              livrées en Phase 4, en même temps que le binaire <code>signapps-installer</code>.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
rtk git add client/src/app/admin/deploy/runtime-config/ client/src/app/admin/deploy/on-premise/
rtk git commit -m "feat(client): /admin/deploy runtime-config + on-premise placeholders"
```

---

## Task 12: Tests E2E Playwright

**Files:**
- Create: `client/tests/e2e/admin-deploy.spec.ts`

Note : ces tests nécessitent que `signapps-deploy-server` tourne et que l'utilisateur soit logged in comme superadmin. Un setup Playwright `auth.setup.ts` doit déjà exister ; sinon, marquer les tests comme `test.skip` avec le motif.

- [ ] **Step 1: Écrire le spec**

```typescript
import { test, expect } from '@playwright/test';

test.describe('/admin/deploy', () => {
  test('Environnements page affiche prod et dev', async ({ page }) => {
    await page.goto('/admin/deploy');
    await expect(page.getByRole('heading', { name: 'Environnements' })).toBeVisible();
    // The 2 env cards
    await expect(page.getByText(/^prod$/i)).toBeVisible();
    await expect(page.getByText(/^dev$/i)).toBeVisible();
  });

  test('Navigation entre les 6 onglets', async ({ page }) => {
    await page.goto('/admin/deploy');
    const tabs = ['Versions', 'Feature Flags', 'Maintenance', 'Runtime Config', 'On-premise'];
    for (const tab of tabs) {
      await page.getByRole('link', { name: tab }).click();
      await expect(page).toHaveURL(new RegExp(`/admin/deploy/`));
    }
  });

  test("Confirmation dialog n'active le bouton que si le texte matche", async ({ page }) => {
    await page.goto('/admin/deploy');
    // Click "Rollback" on prod card (could be the first card)
    const prodCard = page.locator('text=prod').first().locator('..');
    // This is brittle; adapt to the actual DOM once rendered
    await prodCard.getByRole('button', { name: 'Rollback' }).click();

    const confirmButton = page.getByRole('button', { name: 'Confirmer' });
    await expect(confirmButton).toBeDisabled();

    await page.getByPlaceholder('ROLLBACK PROD').fill('WRONG');
    await expect(confirmButton).toBeDisabled();

    await page.getByPlaceholder('ROLLBACK PROD').fill('ROLLBACK PROD');
    await expect(confirmButton).toBeEnabled();
  });
});
```

Adapt le selector Rollback si la carte prod est au 2e position, etc. (vérifier visuellement).

- [ ] **Step 2: Run local**

```
cd client && npx playwright test admin-deploy --reporter=list
```

Si le test échoue parce que le backend n'est pas up, noter et commit quand même (les tests sont utiles en tant que doc + CI).

- [ ] **Step 3: Commit**

```bash
rtk git add client/tests/e2e/admin-deploy.spec.ts
rtk git commit -m "test(client): E2E admin-deploy spec (3 scenarios)"
```

---

## Task 13: Docs + validation finale

**Files:**
- Modify: `services/signapps-deploy/README.md` (ajouter section UI)
- Modify: `.env.example` (root ou client)

- [ ] **Step 1: README**

Ajouter à la fin de `services/signapps-deploy/README.md` :

````markdown
## Phase 3b additions — Admin UI

Le frontend expose maintenant les pages :

- `/admin/deploy` — Environnements (dashboard : versions en cours, health, actions deploy/rollback/maintenance/promote)
- `/admin/deploy/versions` — Versions déployables + historique
- `/admin/deploy/feature-flags` — CRUD feature flags (rollout, targeting)
- `/admin/deploy/maintenance` — Toggle manuel de maintenance
- `/admin/deploy/runtime-config` — Placeholder (Phase 3c)
- `/admin/deploy/on-premise` — Placeholder (Phase 4)

Toutes les actions utilisent la double confirmation textuelle (même token que les recettes justfile) : `DEPLOY PROD v1.2.3`, `ROLLBACK PROD`, `PROMOTE TO PROD`, `DELETE <key>`.

### Variables d'env frontend

Dans `.env` du frontend ou via Next.js runtime config :

```
NEXT_PUBLIC_DEPLOY_URL=http://localhost:3700
```

### Auth

Les pages `/admin/deploy/*` sont accessibles uniquement aux utilisateurs avec rôle `3` (SuperAdmin), conformément à la garde backend du Phase 3a. Le middleware existant du `/admin` redirige déjà les non-superadmins.
````

- [ ] **Step 2: Ajouter au .env.example (root)**

Dans `.env.example`, ajouter :

```
# Deploy API URL (Phase 3b UI)
NEXT_PUBLIC_DEPLOY_URL=http://localhost:3700
```

- [ ] **Step 3: Pipeline qualité**

```bash
cd client && npx tsc --noEmit 2>&1 | tail -10
cd client && npx eslint src/app/admin/deploy src/components/admin/deploy src/hooks/useDeployEvents.ts src/lib/api/deploy.ts src/stores/deploy-store.ts 2>&1 | tail -10
cd client && npm run build 2>&1 | tail -10
```

Chaque doit passer (`tsc` = 0 nouvelle erreur, `eslint` = 0 erreur sur les nouveaux fichiers, `build` = SUCCESS).

- [ ] **Step 4: Tag**

```bash
rtk git tag -a phase3b-admin-ui-complete -m "Phase 3b: Admin UI complete"
```

- [ ] **Step 5: Commit docs**

```bash
rtk git add services/signapps-deploy/README.md .env.example
rtk git commit -m "docs(deploy): document Phase 3b Admin UI"
```

---

## Review Checklist

- [ ] 6 pages `/admin/deploy/*` naviguables via les onglets
- [ ] Double confirmation bloque l'action tant que le texte n'est pas exact
- [ ] Liste des envs se rafraîchit toutes les 10s (via `refetchInterval`)
- [ ] Feature flags CRUD complet (list, create, edit, delete)
- [ ] Maintenance toggle fonctionne en UI (POST vers backend)
- [ ] Runtime Config et On-premise affichent leurs placeholders
- [ ] WebSocket `useDeployEvents` se reconnecte exponentiellement
- [ ] TypeScript strict passe
- [ ] ESLint passe
- [ ] `npm run build` réussit
- [ ] 3 tests Playwright commités
- [ ] Tag `phase3b-admin-ui-complete` créé localement
