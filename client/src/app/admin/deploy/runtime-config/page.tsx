"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
              La table <code>runtime_config</code> est en place (migration 307),
              mais les endpoints REST correspondants seront livrés en Phase 3c.
              En attendant, la config runtime reste pilotée via variables
              d&apos;environnement au boot de chaque service.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
