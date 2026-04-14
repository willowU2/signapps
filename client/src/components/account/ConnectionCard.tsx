"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import type { AccountConnection } from "@/lib/api/account-connections";

interface Props {
  conn: AccountConnection;
  onDisconnect: (sourceTable: string, id: string) => void;
}

export function ConnectionCard({ conn, onDisconnect }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isHealthy = conn.status === "connected" && !conn.disabled;

  return (
    <>
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span>{conn.provider_key}</span>
              <Badge variant="outline" className="text-xs">
                {conn.source_table.split(".")[0]}
              </Badge>
            </div>
            {conn.display_email && (
              <div className="text-xs text-muted-foreground">
                {conn.display_email}
              </div>
            )}
            <div className="text-xs">
              {isHealthy ? (
                <span className="text-green-500">Connecté</span>
              ) : (
                <span className="text-red-500">
                  Reconnexion requise
                  {conn.last_error ? ` — ${conn.last_error}` : ""}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {!isHealthy && (
              <Button
                size="sm"
                onClick={() => {
                  window.location.href = `/api/v1/oauth/${conn.provider_key}/start?integration=1`;
                }}
              >
                Reconnecter
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(true)}
            >
              Déconnecter
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmer la déconnexion"
        description={`Voulez-vous vraiment déconnecter ${conn.provider_key}${conn.display_email ? ` (${conn.display_email})` : ""} ? L'accès sera révoqué immédiatement.`}
        onConfirm={() => onDisconnect(conn.source_table, conn.id)}
      />
    </>
  );
}
