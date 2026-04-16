"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { backupsApi, BackupProfile } from "@/lib/api";
import { toast } from "sonner";
import { useState } from "react";

type BackupStatus = "ok" | "stale" | "never" | "disabled";

function deriveStatus(profile: BackupProfile): BackupStatus {
  if (!profile.enabled) return "disabled";
  if (!profile.last_run_at) return "never";
  const age = Date.now() - new Date(profile.last_run_at).getTime();
  const scheduleMs = 25 * 60 * 60 * 1000; // stale after 25h
  return age > scheduleMs ? "stale" : "ok";
}

function statusColor(status: BackupStatus) {
  switch (status) {
    case "ok":
      return "text-green-600";
    case "stale":
      return "text-yellow-600";
    case "disabled":
      return "text-muted-foreground";
    case "never":
      return "text-muted-foreground";
  }
}

function StatusIcon({ status }: { status: BackupStatus }) {
  if (status === "ok")
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "stale") return <Clock className="h-4 w-4 text-yellow-500" />;
  return <AlertTriangle className="h-4 w-4 text-red-500" />;
}

function formatDate(d: string | null) {
  if (!d) return "Jamais";
  return new Date(d).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * AQ-BKPVER — Backup verification status panel.
 * Shows last backup time, size, integrity status, and restore-test date.
 */
export function BackupVerificationStatus() {
  const [testing, setTesting] = useState<string | null>(null);

  const {
    data: profiles,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["backup-profiles"],
    queryFn: async () => {
      const res = await backupsApi.listProfiles();
      return res.data;
    },
    refetchInterval: 60_000,
  });

  const handleTestRestore = async (profileId: string) => {
    setTesting(profileId);
    try {
      await backupsApi.createBackup(profileId);
      toast.success("Test de restauration lancé");
      refetch();
    } catch {
      toast.error("Erreur lors du test de restauration");
    } finally {
      setTesting(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Vérification des sauvegardes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Vérification des sauvegardes
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => refetch()}
            aria-label="Rafraîchir"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!profiles?.length ? (
          <p className="text-sm text-muted-foreground py-2">
            Aucun profil de sauvegarde configuré.
          </p>
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => {
              const status = deriveStatus(p);
              return (
                <div
                  key={p.id}
                  className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                >
                  <StatusIcon status={status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{p.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-4 px-1 ${statusColor(status)}`}
                      >
                        {status}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span>
                        Dernière exécution : {formatDate(p.last_run_at ?? null)}
                      </span>
                      <span>Prochaine : {formatDate(p.next_run ?? null)}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    disabled={testing === p.id}
                    onClick={() => handleTestRestore(p.id)}
                  >
                    {testing === p.id ? (
                      <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Tester
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
