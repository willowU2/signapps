"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, CheckCircle2, AlertCircle } from "lucide-react";

interface AuditLogEntry {
  id: string;
  timestamp: Date;
  actor: string;
  action: string;
  hash: string;
  previousHash: string;
  status: "success" | "warning" | "error";
}

interface ImmutableAuditProps {
  logs: AuditLogEntry[];
  chainIntegrity: "valid" | "compromised" | "unknown";
}

export const ImmutableAudit: React.FC<ImmutableAuditProps> = ({
  logs,
  chainIntegrity,
}) => {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const getStatusIcon = (status: AuditLogEntry["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="size-4 text-green-600" />;
      case "warning":
        return <AlertCircle className="size-4 text-yellow-600" />;
      case "error":
        return <AlertCircle className="size-4 text-red-600" />;
    }
  };

  const getStatusColor = (status: AuditLogEntry["status"]) => {
    switch (status) {
      case "success":
        return "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800";
      case "warning":
        return "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800";
      case "error":
        return "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800";
    }
  };

  const getIntegrityBadgeVariant = (
    integrity: ImmutableAuditProps["chainIntegrity"],
  ) => {
    switch (integrity) {
      case "valid":
        return "default";
      case "compromised":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getIntegrityLabel = (
    integrity: ImmutableAuditProps["chainIntegrity"],
  ) => {
    switch (integrity) {
      case "valid":
        return "Chaîne valide";
      case "compromised":
        return "Chaîne compromise";
      default:
        return "Statut inconnu";
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="size-5" />
              Audit Immuable
            </CardTitle>
            <CardDescription>
              Journal d'audit et intégrité de la chaîne
            </CardDescription>
          </div>
          <Badge
            variant={getIntegrityBadgeVariant(chainIntegrity)}
            className="whitespace-nowrap"
          >
            {getIntegrityLabel(chainIntegrity)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucune entrée d'audit trouvée
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={log.id}
                className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-muted/50 ${getStatusColor(log.status)}`}
                onClick={() =>
                  setExpandedLog(expandedLog === log.id ? null : log.id)
                }
              >
                <div className="flex items-start gap-3">
                  <div className="pt-1 flex-shrink-0">
                    {getStatusIcon(log.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{log.actor}</span>
                      <span className="text-muted-foreground text-sm">
                        {log.action}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {log.timestamp.toLocaleString("fr-FR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedLog === log.id && (
                  <div className="mt-3 pt-3 border-t space-y-2 text-xs">
                    <div>
                      <p className="text-muted-foreground font-medium">
                        Hash courant
                      </p>
                      <code className="bg-muted/50 rounded px-2 py-1 block mt-1 break-all text-muted-foreground">
                        {log.hash}
                      </code>
                    </div>
                    {index > 0 && (
                      <div>
                        <p className="text-muted-foreground font-medium">
                          Hash précédent
                        </p>
                        <code className="bg-muted/50 rounded px-2 py-1 block mt-1 break-all text-muted-foreground">
                          {log.previousHash}
                        </code>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-2 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block size-1.5 rounded-full bg-green-600" />
                        Bloc #{index + 1}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Chain Integrity Indicator */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-sm">
            <Link2 className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {logs.length} entrée{logs.length !== 1 ? "s" : ""} dans la chaîne
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
