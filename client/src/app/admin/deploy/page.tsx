"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listEnvs,
  getEnvHealth,
  deploy,
  rollback,
  toggleMaintenance,
  promote,
} from "@/lib/api/deploy";
import { EnvCard } from "@/components/admin/deploy/EnvCard";
import { ConfirmationDialog } from "@/components/admin/deploy/ConfirmationDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PendingAction =
  | { kind: "deploy"; env: "prod" | "dev" }
  | { kind: "rollback"; env: "prod" | "dev" }
  | { kind: "promote" }
  | null;

export default function DeployEnvsPage() {
  const [pending, setPending] = useState<PendingAction>(null);
  const [version, setVersion] = useState("");
  const queryClient = useQueryClient();

  const envsQ = useQuery({
    queryKey: ["deploy", "envs"],
    queryFn: listEnvs,
    refetchInterval: 10_000,
  });
  const prodH = useQuery({
    queryKey: ["deploy", "health", "prod"],
    queryFn: () => getEnvHealth("prod"),
    refetchInterval: 10_000,
  });
  const devH = useQuery({
    queryKey: ["deploy", "health", "dev"],
    queryFn: () => getEnvHealth("dev"),
    refetchInterval: 10_000,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["deploy"] });

  const deployMut = useMutation({
    mutationFn: ({
      env,
      version,
      confirm,
    }: {
      env: "prod" | "dev";
      version: string;
      confirm: string;
    }) => deploy(env, version, confirm),
    onSuccess: invalidate,
  });
  const rollbackMut = useMutation({
    mutationFn: ({ env, confirm }: { env: "prod" | "dev"; confirm: string }) =>
      rollback(env, confirm),
    onSuccess: invalidate,
  });
  const maintMut = useMutation({
    mutationFn: ({ env, enable }: { env: "prod" | "dev"; enable: boolean }) =>
      toggleMaintenance(env, enable),
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
        <Button onClick={() => setPending({ kind: "promote" })}>
          Promouvoir dev → prod
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {envs.map((e) => (
          <EnvCard
            key={e.env}
            status={e}
            health={
              e.env === "prod" ? (prodH.data ?? null) : (devH.data ?? null)
            }
            onDeploy={() => {
              setVersion("");
              setPending({ kind: "deploy", env: e.env });
            }}
            onRollback={() => setPending({ kind: "rollback", env: e.env })}
            onToggleMaintenance={(enable) =>
              maintMut.mutate({ env: e.env, enable })
            }
          />
        ))}
      </div>

      {pending?.kind === "deploy" && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <Label htmlFor="version-input">
            Version à déployer sur <strong>{pending.env}</strong>
          </Label>
          <Input
            id="version-input"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="v1.2.3"
            autoFocus
          />
          {version && (
            <ConfirmationDialog
              open={true}
              onOpenChange={(o) => {
                if (!o) setPending(null);
              }}
              title={`Déployer ${version} sur ${pending.env}`}
              description={
                pending.env === "prod"
                  ? "Action destructive en production."
                  : "Déploiement sur l'env de staging."
              }
              confirmationToken={
                pending.env === "prod"
                  ? `DEPLOY PROD ${version}`
                  : `DEPLOY DEV ${version}`
              }
              onConfirm={async () => {
                await deployMut.mutateAsync({
                  env: pending.env,
                  version,
                  confirm:
                    pending.env === "prod"
                      ? `DEPLOY PROD ${version}`
                      : `DEPLOY DEV ${version}`,
                });
              }}
              danger={pending.env === "prod"}
            />
          )}
        </div>
      )}

      {pending?.kind === "rollback" && (
        <ConfirmationDialog
          open={true}
          onOpenChange={(o) => {
            if (!o) setPending(null);
          }}
          title={`Rollback ${pending.env}`}
          description="Revient à la dernière version déployée avec succès."
          confirmationToken={
            pending.env === "prod" ? "ROLLBACK PROD" : "ROLLBACK DEV"
          }
          onConfirm={async () => {
            await rollbackMut.mutateAsync({
              env: pending.env,
              confirm:
                pending.env === "prod" ? "ROLLBACK PROD" : "ROLLBACK DEV",
            });
          }}
          danger
        />
      )}

      {pending?.kind === "promote" && (
        <ConfirmationDialog
          open={true}
          onOpenChange={(o) => {
            if (!o) setPending(null);
          }}
          title="Promouvoir dev vers prod"
          description="La dernière version déployée sur dev sera redéployée sur prod."
          confirmationToken="PROMOTE TO PROD"
          onConfirm={async () => {
            await promoteMut.mutateAsync("PROMOTE TO PROD");
          }}
          danger
        />
      )}
    </div>
  );
}
