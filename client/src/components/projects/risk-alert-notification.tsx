"use client";

// Feature 8: Project risk → send alert notification

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  BellRing,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RiskLevel = "critical" | "high" | "medium" | "low";
type RiskStatus = "open" | "mitigated" | "notified";

interface ProjectRisk {
  id: string;
  title: string;
  description: string;
  level: RiskLevel;
  status: RiskStatus;
  owner: string;
  projectName: string;
  affectedTeam: string[];
}

const LEVEL_CONFIG: Record<RiskLevel, { class: string; label: string }> = {
  critical: {
    class: "bg-red-100 text-red-800 border-red-200",
    label: "Critique",
  },
  high: {
    class: "bg-orange-100 text-orange-800 border-orange-200",
    label: "Élevé",
  },
  medium: {
    class: "bg-yellow-100 text-yellow-800 border-yellow-200",
    label: "Moyen",
  },
  low: {
    class: "bg-green-100 text-green-800 border-green-200",
    label: "Faible",
  },
};

const DEMO_RISKS: ProjectRisk[] = [
  {
    id: "r1",
    title: "Dépendance externe non confirmée",
    description:
      "Le service tiers Auth0 n'a pas confirmé la disponibilité de l'API v3.",
    level: "critical",
    status: "open",
    owner: "Alice Martin",
    projectName: "Refonte Backend Auth",
    affectedTeam: ["1", "2"],
  },
  {
    id: "r2",
    title: "Sous-effectif sur les tests",
    description: "Aucun QA disponible pour le sprint 4.",
    level: "high",
    status: "open",
    owner: "Bob Dupont",
    projectName: "Dashboard Analytics",
    affectedTeam: ["1", "5"],
  },
];

interface RiskAlertNotificationProps {
  risks?: ProjectRisk[];
}

export function RiskAlertNotification({
  risks: initialRisks = DEMO_RISKS,
}: RiskAlertNotificationProps) {
  const [risks, setRisks] = useState(initialRisks);
  const [expanded, setExpanded] = useState<string | null>(null);

  function sendAlert(risk: ProjectRisk) {
    setRisks((prev) =>
      prev.map((r) => (r.id === risk.id ? { ...r, status: "notified" } : r)),
    );
    toast.warning(`Alerte envoyée : ${risk.title}`, {
      description: `${risk.affectedTeam.length} membre(s) notifié(s) sur ${risk.projectName}.`,
    });
    window.dispatchEvent(
      new CustomEvent("agentiq:notification", {
        detail: {
          id: `risk-${risk.id}-${Date.now()}`,
          type: "risk",
          title: `Risque ${LEVEL_CONFIG[risk.level].label} : ${risk.title}`,
          message: risk.description,
          context: {
            projectName: risk.projectName,
            riskId: risk.id,
            level: risk.level,
          },
          recipients: risk.affectedTeam,
          createdAt: new Date().toISOString(),
          read: false,
        },
      }),
    );
  }

  const openRisks = risks.filter(
    (r) => r.level === "critical" || r.level === "high",
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-orange-500" />
          Risques actifs
          {openRisks.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {openRisks.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {risks.map((risk) => (
          <div
            key={risk.id}
            className={cn(
              "rounded-lg border p-2.5",
              LEVEL_CONFIG[risk.level].class,
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <button
                  className="flex w-full items-center gap-1 text-left text-sm font-medium"
                  onClick={() =>
                    setExpanded((e) => (e === risk.id ? null : risk.id))
                  }
                >
                  {expanded === risk.id ? (
                    <ChevronUp className="size-3.5 shrink-0" />
                  ) : (
                    <ChevronDown className="size-3.5 shrink-0" />
                  )}
                  {risk.title}
                </button>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge
                  className={cn("text-[10px]", LEVEL_CONFIG[risk.level].class)}
                >
                  {LEVEL_CONFIG[risk.level].label}
                </Badge>
                {risk.status === "notified" ? (
                  <Check className="size-4 text-green-600" />
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 gap-1 px-2 text-[10px]"
                    onClick={() => sendAlert(risk)}
                  >
                    <BellRing className="size-3" /> Alerter
                  </Button>
                )}
              </div>
            </div>
            {expanded === risk.id && (
              <div className="mt-2 space-y-1 text-xs">
                <p>{risk.description}</p>
                <p className="text-muted-foreground">
                  Responsable: {risk.owner} · {risk.projectName}
                </p>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
