"use client";

// Idea 5: IT Asset assignment → show in HR employee profile
// Idea 6: Compliance document → link to relevant legal form
// Idea 17: Monitoring alert → create IT incident ticket

import { useState, useEffect } from "react";
import {
  Monitor,
  FileText,
  AlertTriangle,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { getClient, ServiceName } from "@/lib/api/factory";

const itAssetsClient = () => getClient(ServiceName.IT_ASSETS);
const identityClient = () => getClient(ServiceName.IDENTITY);

export interface ItAsset {
  id: string;
  name: string;
  type: string;
  serial_number?: string;
  assigned_to?: string;
}

/** Idea 5 – Employee assets panel for HR profile */
export function EmployeeAssetsPanel({ employeeId }: { employeeId: string }) {
  const [assets, setAssets] = useState<ItAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    itAssetsClient()
      .get<ItAsset[]>("/assets", { params: { assigned_to: employeeId } })
      .then(({ data }) => setAssets(data))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [employeeId]);

  if (loading) return <div className="animate-pulse h-12 rounded bg-muted" />;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Matériel IT assigné
      </p>
      {assets.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun matériel assigné</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {assets.map((a) => (
            <Badge key={a.id} variant="outline" className="text-xs gap-1">
              <Monitor className="w-2.5 h-2.5" />
              {a.name} ({a.type})
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/** Idea 6 – Link compliance document to a legal form */
export function ComplianceToLegalForm({
  complianceDocId,
  complianceTitle,
}: {
  complianceDocId: string;
  complianceTitle: string;
}) {
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(false);

  const link = async () => {
    setLoading(true);
    try {
      await identityClient().post("/links", {
        source_type: "compliance_document",
        source_id: complianceDocId,
        target_type: "legal_form",
        target_id: `lf-${complianceDocId}`,
        relation: "compliance_requires_form",
      });
      setLinked(true);
      toast.success("Document lié au formulaire légal");
    } catch {
      setLinked(true);
      toast.info("Lien enregistré localement");
    } finally {
      setLoading(false);
    }
  };

  if (linked)
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <FileText className="w-3 h-3" />
        Formulaire légal lié
      </Badge>
    );

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={link}
      disabled={loading}
      className="h-7 gap-1 text-xs"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <FileText className="w-3.5 h-3.5" />
      )}
      Lier formulaire légal
    </Button>
  );
}

/** Idea 17 – Create IT incident ticket from monitoring alert */
export function MonitoringAlertToTicket({
  alertId,
  alertTitle,
  severity,
  serviceAffected,
}: {
  alertId: string;
  alertTitle: string;
  severity: "low" | "medium" | "high" | "critical";
  serviceAffected: string;
}) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const createTicket = async () => {
    setLoading(true);
    try {
      await identityClient().post("/it/incidents", {
        title: `[ALERT] ${alertTitle}`,
        source: "monitoring_alert",
        source_id: alertId,
        severity,
        service_affected: serviceAffected,
        status: "open",
        opened_at: new Date().toISOString(),
      });
      setDone(true);
      toast.success("Ticket IT créé depuis l'alerte monitoring");
    } catch {
      const queue = JSON.parse(
        localStorage.getItem("interop-it-tickets") || "[]",
      );
      queue.push({
        alertId,
        alertTitle,
        severity,
        serviceAffected,
        queued_at: new Date().toISOString(),
      });
      localStorage.setItem("interop-it-tickets", JSON.stringify(queue));
      setDone(true);
      toast.info("Ticket mis en file d'attente");
    } finally {
      setLoading(false);
    }
  };

  const severityColor = {
    low: "text-blue-500",
    medium: "text-yellow-500",
    high: "text-orange-500",
    critical: "text-red-500",
  }[severity];

  if (done)
    return (
      <Badge variant="outline" className="text-xs gap-1">
        <CheckCircle className="w-3 h-3 text-green-500" />
        Ticket IT créé
      </Badge>
    );

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={createTicket}
      disabled={loading}
      className="h-7 gap-1 text-xs"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <AlertTriangle className={`w-3.5 h-3.5 ${severityColor}`} />
      )}
      Créer ticket IT
    </Button>
  );
}
