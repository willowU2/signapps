"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listFlags, upsertFlag, deleteFlag } from "@/lib/api/deploy";
import { FeatureFlagRow } from "@/components/admin/deploy/FeatureFlagRow";
import { FeatureFlagEditor } from "@/components/admin/deploy/FeatureFlagEditor";
import { ConfirmationDialog } from "@/components/admin/deploy/ConfirmationDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import type { FeatureFlag, UpsertFlagRequest } from "@/lib/api/deploy";

export default function FeatureFlagsPage() {
  const [editing, setEditing] = useState<FeatureFlag | "new" | null>(null);
  const [deleting, setDeleting] = useState<FeatureFlag | null>(null);
  const queryClient = useQueryClient();

  const flagsQ = useQuery({
    queryKey: ["deploy", "flags"],
    queryFn: () => listFlags(),
  });

  const upsertMut = useMutation({
    mutationFn: ({ key, req }: { key: string; req: UpsertFlagRequest }) =>
      upsertFlag(key, req),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["deploy", "flags"] }),
  });

  const deleteMut = useMutation({
    mutationFn: ({ key, env }: { key: string; env: string }) =>
      deleteFlag(key, env),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["deploy", "flags"] }),
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Feature Flags</CardTitle>
          <Button onClick={() => setEditing("new")}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau flag
          </Button>
        </CardHeader>
        <CardContent>
          {flagsQ.isLoading && <p>Chargement…</p>}
          {!flagsQ.isLoading && (flagsQ.data?.length ?? 0) === 0 && (
            <p className="text-muted-foreground">
              Aucun flag défini. Crée le premier via <em>Nouveau flag</em>.
            </p>
          )}
          {flagsQ.data && flagsQ.data.length > 0 && (
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
                {flagsQ.data.map((f) => (
                  <FeatureFlagRow
                    key={`${f.key}:${f.env}`}
                    flag={f}
                    onEdit={(flag) => setEditing(flag)}
                    onDelete={(flag) => setDeleting(flag)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <FeatureFlagEditor
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        initial={editing === "new" ? null : editing}
        onSave={async (key, req) => {
          await upsertMut.mutateAsync({ key, req });
        }}
      />

      {deleting && (
        <ConfirmationDialog
          open={true}
          onOpenChange={(o) => {
            if (!o) setDeleting(null);
          }}
          title={`Supprimer le flag '${deleting.key}' (${deleting.env})`}
          description="Cette action est irréversible."
          confirmationToken={`DELETE ${deleting.key}`}
          onConfirm={async () => {
            await deleteMut.mutateAsync({
              key: deleting.key,
              env: deleting.env,
            });
          }}
          danger
        />
      )}
    </>
  );
}
