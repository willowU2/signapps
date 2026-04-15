"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toggleMaintenance } from "@/lib/api/deploy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function MaintenancePage() {
  const queryClient = useQueryClient();
  const maintMut = useMutation({
    mutationFn: ({ env, enable }: { env: "prod" | "dev"; enable: boolean }) =>
      toggleMaintenance(env, enable),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deploy"] }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Maintenance manuelle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(["prod", "dev"] as const).map((env) => (
            <div
              key={env}
              className="flex items-center justify-between rounded-lg border border-border p-4"
            >
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
          La gestion des fenêtres de maintenance planifiées est disponible via
          CLI :{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono">
            just schedule-maintenance prod 2026-04-20T03:00:00Z 15
            &quot;msg&quot;
          </code>
          . Les endpoints API correspondants arriveront en Phase 3c.
        </AlertDescription>
      </Alert>
    </div>
  );
}
