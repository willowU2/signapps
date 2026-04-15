"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
              La liste des déploiements on-premise et leur télémétrie anonymisée
              seront livrées en Phase 4, en même temps que le binaire{" "}
              <code>signapps-installer</code>.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
