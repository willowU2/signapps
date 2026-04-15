"use client";

import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

type SLAStatus = "Compliant" | "Breach" | "AtRisk";

interface SLAMetric {
  name: string;
  target: string;
  actual: string;
  status: SLAStatus;
}

interface SLAContract {
  id: string;
  client: string;
  metrics: SLAMetric[];
  startDate: string;
  endDate: string;
}

interface SLAContractsProps {
  contracts?: SLAContract[];
  onBreachAlert?: (contractId: string) => void;
}

export function SLAContracts({
  contracts = [
    {
      id: "SLA-001",
      client: "Acme Corp",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      metrics: [
        {
          name: "Uptime",
          target: "99.9%",
          actual: "99.95%",
          status: "Compliant",
        },
        {
          name: "Response Time",
          target: "< 2h",
          actual: "1h 45m",
          status: "Compliant",
        },
        {
          name: "Resolution Time",
          target: "< 24h",
          actual: "22h 30m",
          status: "Compliant",
        },
      ],
    },
    {
      id: "SLA-002",
      client: "Tech Solutions",
      startDate: "2024-02-01",
      endDate: "2025-01-31",
      metrics: [
        { name: "Uptime", target: "99.5%", actual: "98.8%", status: "Breach" },
        {
          name: "Response Time",
          target: "< 4h",
          actual: "3h 50m",
          status: "Compliant",
        },
        {
          name: "Resolution Time",
          target: "< 48h",
          actual: "45h 20m",
          status: "Compliant",
        },
      ],
    },
    {
      id: "SLA-003",
      client: "StartUp Inc",
      startDate: "2024-03-01",
      endDate: "2024-12-31",
      metrics: [
        {
          name: "Uptime",
          target: "99%",
          actual: "98.95%",
          status: "AtRisk",
        },
        {
          name: "Response Time",
          target: "< 6h",
          actual: "5h 40m",
          status: "Compliant",
        },
        {
          name: "Resolution Time",
          target: "< 72h",
          actual: "65h",
          status: "Compliant",
        },
      ],
    },
  ],
  onBreachAlert,
}: SLAContractsProps) {
  // Check for breaches on mount
  React.useEffect(() => {
    contracts.forEach((contract) => {
      const hasBreach = contract.metrics.some((m) => m.status === "Breach");
      if (hasBreach) {
        onBreachAlert?.(contract.id);
      }
    });
  }, [contracts, onBreachAlert]);

  const getStatusBadge = (status: SLAStatus) => {
    const styles = {
      Compliant:
        "bg-green-100 text-green-800 border border-green-200 flex items-center gap-1",
      AtRisk:
        "bg-yellow-100 text-yellow-800 border border-yellow-200 flex items-center gap-1",
      Breach:
        "bg-red-100 text-red-800 border border-red-200 flex items-center gap-1",
    };

    const icons = {
      Compliant: <CheckCircle2 className="h-4 w-4" />,
      AtRisk: <Clock className="h-4 w-4" />,
      Breach: <AlertTriangle className="h-4 w-4" />,
    };

    return (
      <Badge className={styles[status]}>
        {icons[status]}
        {status === "Compliant" && "Conforme"}
        {status === "AtRisk" && "À risque"}
        {status === "Breach" && "Violation"}
      </Badge>
    );
  };

  const contractStatus = (contract: SLAContract): SLAStatus => {
    if (contract.metrics.some((m) => m.status === "Breach")) return "Breach";
    if (contract.metrics.some((m) => m.status === "AtRisk")) return "AtRisk";
    return "Compliant";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Clock className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Contrats SLA</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Conformes</p>
              <p className="text-2xl font-bold">
                {
                  contracts.filter((c) => contractStatus(c) === "Compliant")
                    .length
                }
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-xs text-muted-foreground">À risque</p>
              <p className="text-2xl font-bold">
                {contracts.filter((c) => contractStatus(c) === "AtRisk").length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-xs text-muted-foreground">Violations</p>
              <p className="text-2xl font-bold">
                {contracts.filter((c) => contractStatus(c) === "Breach").length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Contracts Table */}
      <Card className="p-6">
        <h3 className="mb-4 font-semibold">Détail des Contrats</h3>
        <div className="space-y-6">
          {contracts.map((contract) => (
            <div
              key={contract.id}
              className="rounded-lg border border-border p-4"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">{contract.client}</h4>
                  <p className="text-xs text-muted-foreground">
                    {contract.id} • {contract.startDate} → {contract.endDate}
                  </p>
                </div>
                <div>{getStatusBadge(contractStatus(contract))}</div>
              </div>

              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Métrique</TableHead>
                    <TableHead>Cible</TableHead>
                    <TableHead>Réel</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contract.metrics.map((metric, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {metric.name}
                      </TableCell>
                      <TableCell>{metric.target}</TableCell>
                      <TableCell>{metric.actual}</TableCell>
                      <TableCell>{getStatusBadge(metric.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      </Card>

      {/* Breach Alerts */}
      {contracts.some((c) => contractStatus(c) === "Breach") && (
        <Card className="border-red-200 bg-red-50 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <div>
              <p className="font-semibold text-red-900">
                Violation SLA Détectée
              </p>
              <p className="text-sm text-red-800">
                {contracts.filter((c) => contractStatus(c) === "Breach").length}{" "}
                contrat(s) en violation. Action requise immédiate.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// Add React import for useEffect
import * as React from "react";
