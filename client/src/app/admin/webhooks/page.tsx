"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { WebhookManager } from "@/components/admin/webhook-manager";
import { OrgWebhooksPanel } from "@/components/admin/org-webhooks-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Webhook,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Filter,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { DateDisplay } from "@/components/ui/date-display";

// ─── Mock delivery log ──────────────────────────────────────────────────────

interface DeliveryLogEntry {
  id: string;
  webhook_name: string;
  event: string;
  status: "success" | "failed" | "pending";
  status_code: number | null;
  duration_ms: number | null;
  timestamp: string;
  request_body: string;
  response_body: string | null;
  error: string | null;
}

function generateMockDeliveryLog(): DeliveryLogEntry[] {
  const webhooks = [
    "CI/CD Pipeline",
    "Slack Notifier",
    "Analytics Tracker",
    "Audit Logger",
  ];
  const events = [
    "user.created",
    "user.updated",
    "document.created",
    "document.updated",
    "auth.login",
    "auth.login_failed",
    "backup.completed",
    "container.started",
  ];
  const now = Date.now();

  return Array.from({ length: 25 }, (_, i) => {
    const success = Math.random() > 0.15;
    const pending = !success && Math.random() > 0.5;
    return {
      id: `del-${i}`,
      webhook_name: webhooks[Math.floor(Math.random() * webhooks.length)],
      event: events[Math.floor(Math.random() * events.length)],
      status: pending ? "pending" : success ? "success" : "failed",
      status_code: pending
        ? null
        : success
          ? 200
          : [400, 500, 502, 503, 0][Math.floor(Math.random() * 5)],
      duration_ms: pending ? null : Math.floor(Math.random() * 2000) + 50,
      timestamp: new Date(
        now - i * 3600000 * (0.5 + Math.random()),
      ).toISOString(),
      request_body: JSON.stringify({
        event: events[0],
        data: { id: `usr-${i}` },
      }),
      response_body: success
        ? '{"ok":true}'
        : pending
          ? null
          : '{"error":"timeout"}',
      error: pending
        ? null
        : success
          ? null
          : "Connection timeout after 5000ms",
    };
  });
}

// ─── Delivery Log Component ─────────────────────────────────────────────────

function DeliveryLog() {
  const [entries, setEntries] = useState<DeliveryLogEntry[]>(() =>
    generateMockDeliveryLog(),
  );
  const [filterStatus, setFilterStatus] = useState<
    "all" | "success" | "failed" | "pending"
  >("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredEntries =
    filterStatus === "all"
      ? entries
      : entries.filter((e) => e.status === filterStatus);

  const refresh = () => {
    setLoading(true);
    setTimeout(() => {
      setEntries(generateMockDeliveryLog());
      setLoading(false);
    }, 600);
  };

  const successCount = entries.filter((e) => e.status === "success").length;
  const failedCount = entries.filter((e) => e.status === "failed").length;
  const pendingCount = entries.filter((e) => e.status === "pending").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Journal des livraisons</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <Badge
                variant="outline"
                className="text-green-600 border-green-300 text-xs"
              >
                {successCount} OK
              </Badge>
              <Badge
                variant="outline"
                className="text-red-600 border-red-300 text-xs"
              >
                {failedCount} Echec
              </Badge>
              <Badge
                variant="outline"
                className="text-yellow-600 border-yellow-300 text-xs"
              >
                {pendingCount} En attente
              </Badge>
            </div>
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
            >
              <SelectTrigger className="w-32 h-8 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="success">Succes</SelectItem>
                <SelectItem value="failed">Echec</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {filteredEntries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune entree trouvee.
            </p>
          )}
          {filteredEntries.map((entry) => (
            <div key={entry.id}>
              <button
                className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                onClick={() =>
                  setExpandedId(expandedId === entry.id ? null : entry.id)
                }
              >
                {entry.status === "success" && (
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                )}
                {entry.status === "failed" && (
                  <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                )}
                {entry.status === "pending" && (
                  <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {entry.webhook_name}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {entry.event}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {entry.status_code !== null && entry.status_code > 0 && (
                    <Badge
                      variant={
                        entry.status_code >= 200 && entry.status_code < 300
                          ? "default"
                          : "destructive"
                      }
                      className="text-[10px]"
                    >
                      HTTP {entry.status_code}
                    </Badge>
                  )}
                  {entry.duration_ms !== null && (
                    <span className="text-xs text-muted-foreground">
                      {entry.duration_ms}ms
                    </span>
                  )}
                  <DateDisplay
                    date={entry.timestamp}
                    withTime
                    className="text-muted-foreground"
                  />
                </div>
              </button>
              {expandedId === entry.id && (
                <div className="ml-7 mb-2 p-3 bg-muted/30 rounded-lg text-xs space-y-2">
                  <div>
                    <span className="font-medium">Requete :</span>
                    <pre className="mt-1 bg-background rounded p-2 overflow-auto max-h-32 text-[11px]">
                      {entry.request_body}
                    </pre>
                  </div>
                  {entry.response_body && (
                    <div>
                      <span className="font-medium">Reponse :</span>
                      <pre className="mt-1 bg-background rounded p-2 overflow-auto max-h-32 text-[11px]">
                        {entry.response_body}
                      </pre>
                    </div>
                  )}
                  {entry.error && (
                    <div>
                      <span className="font-medium text-red-600">Erreur :</span>
                      <p className="mt-1 text-red-600">{entry.error}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  usePageTitle("Webhooks");
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          title="Gestion des webhooks"
          description="Configurez et surveillez vos webhooks et leurs livraisons."
          icon={<Webhook className="h-5 w-5" />}
        />
        <WebhookManager />
        {/* SO4 IN3 — org events fan-out */}
        <OrgWebhooksPanel />
        <DeliveryLog />
      </div>
    </AppLayout>
  );
}
