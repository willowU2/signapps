"use client";

import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileBarChart,
  Download,
  Loader2,
  Users,
  FileText,
  HardDrive,
  ShieldAlert,
  Lock,
  Activity,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { usePageTitle } from "@/hooks/use-page-title";
import { PageHeader } from "@/components/ui/page-header";

// ─── Mock data generators ───────────────────────────────────────────────────

function generateUsageReport(from: string, to: string) {
  const days = Math.max(
    1,
    Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000),
  );
  return {
    period: { from, to, days },
    users: {
      total: 347,
      active: 289,
      new_registrations: Math.floor(days * 2.3),
      daily_active_avg: 184,
      peak_concurrent: 67,
      inactive_30d: 58,
    },
    documents: {
      total_created: Math.floor(days * 18.4),
      total_modified: Math.floor(days * 42.7),
      avg_per_user: 4.2,
      by_type: [
        { type: "PDF", count: Math.floor(days * 6.1) },
        { type: "DOCX", count: Math.floor(days * 4.8) },
        { type: "XLSX", count: Math.floor(days * 3.9) },
        { type: "Images", count: Math.floor(days * 2.7) },
        { type: "Autres", count: Math.floor(days * 0.9) },
      ],
    },
    storage: {
      total_gb: 248.7,
      used_gb: 182.3,
      growth_gb: +(days * 0.42).toFixed(1),
      top_consumers: [
        { user: "engineering@corp.fr", usage_gb: 34.2 },
        { user: "marketing@corp.fr", usage_gb: 28.9 },
        { user: "design@corp.fr", usage_gb: 22.1 },
        { user: "rh@corp.fr", usage_gb: 15.8 },
        { user: "finance@corp.fr", usage_gb: 12.4 },
      ],
    },
  };
}

function generateSecurityReport(from: string, to: string) {
  const days = Math.max(
    1,
    Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000),
  );
  return {
    period: { from, to, days },
    authentication: {
      total_logins: Math.floor(days * 312),
      failed_logins: Math.floor(days * 23),
      failed_rate: 6.8,
      locked_accounts: 4,
      mfa_adoption: 72.3,
      suspicious_ips: [
        { ip: "185.220.101.42", attempts: 847, country: "RU", blocked: true },
        { ip: "103.152.34.12", attempts: 234, country: "CN", blocked: true },
        { ip: "45.134.26.89", attempts: 112, country: "UA", blocked: false },
      ],
    },
    permissions: {
      role_changes: Math.floor(days * 3.1),
      privilege_escalations: Math.floor(days * 0.8),
      new_admin_grants: Math.floor(days * 0.3),
      revoked_accesses: Math.floor(days * 1.2),
      recent_changes: [
        {
          user: "j.martin",
          action: "role_change",
          from: "user",
          to: "editor",
          date: from,
          by: "admin",
        },
        {
          user: "l.dubois",
          action: "access_revoked",
          resource: "financial-reports",
          date: from,
          by: "admin",
        },
        {
          user: "m.bernard",
          action: "admin_grant",
          from: "editor",
          to: "admin",
          date: from,
          by: "superadmin",
        },
      ],
    },
    vulnerabilities: {
      critical: 0,
      high: 2,
      medium: 7,
      low: 14,
      patched_this_period: 5,
    },
  };
}

function generatePerformanceReport(from: string, to: string) {
  const days = Math.max(
    1,
    Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000),
  );
  return {
    period: { from, to, days },
    api: {
      total_requests: Math.floor(days * 48200),
      avg_response_ms: 42,
      p95_response_ms: 187,
      p99_response_ms: 523,
      slowest_endpoints: [
        {
          endpoint: "POST /api/v1/ai/generate",
          avg_ms: 2340,
          calls: Math.floor(days * 89),
        },
        {
          endpoint: "GET /api/v1/storage/files",
          avg_ms: 312,
          calls: Math.floor(days * 1200),
        },
        {
          endpoint: "POST /api/v1/documents/export",
          avg_ms: 287,
          calls: Math.floor(days * 340),
        },
        {
          endpoint: "GET /api/v1/search",
          avg_ms: 156,
          calls: Math.floor(days * 2100),
        },
        {
          endpoint: "POST /api/v1/auth/login",
          avg_ms: 89,
          calls: Math.floor(days * 312),
        },
      ],
    },
    errors: {
      total_errors: Math.floor(days * 142),
      error_rate: 0.29,
      by_status: [
        { status: 400, count: Math.floor(days * 48), label: "Bad Request" },
        { status: 401, count: Math.floor(days * 31), label: "Unauthorized" },
        { status: 404, count: Math.floor(days * 27), label: "Not Found" },
        { status: 429, count: Math.floor(days * 19), label: "Rate Limited" },
        { status: 500, count: Math.floor(days * 12), label: "Internal Error" },
        {
          status: 503,
          count: Math.floor(days * 5),
          label: "Service Unavailable",
        },
      ],
    },
    uptime: {
      percentage: 99.94,
      total_downtime_minutes: Math.floor(days * 0.086),
      incidents: 2,
      mttr_minutes: 12,
    },
    resources: {
      avg_cpu_percent: 34.2,
      peak_cpu_percent: 78.1,
      avg_memory_percent: 61.4,
      peak_memory_percent: 87.3,
      avg_db_connections: 24,
      peak_db_connections: 48,
    },
  };
}

// ─── Download helpers ───────────────────────────────────────────────────────

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function flattenForCsv(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenForCsv(value as Record<string, unknown>, newKey),
      );
    } else if (Array.isArray(value)) {
      result[newKey] = JSON.stringify(value);
    } else {
      result[newKey] = String(value ?? "");
    }
  }
  return result;
}

function downloadCsv(data: unknown, filename: string) {
  const flat = flattenForCsv(data as Record<string, unknown>);
  const rows = Object.entries(flat).map(([k, v]) => `"${k}","${v}"`);
  const csv = "Key,Value\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub: string;
  trend?: "up" | "down";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-2xl font-bold mt-1">{value}</p>
        <div className="flex items-center gap-1 mt-1">
          {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
          {trend === "down" && (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Usage Report Tab ───────────────────────────────────────────────────────

function UsageReportTab() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReturnType<
    typeof generateUsageReport
  > | null>(null);
  const [exportFormat, setExportFormat] = useState<"pdf" | "csv">("csv");

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setReport(generateUsageReport(from, to));
      setGenerating(false);
      toast.success("Rapport d'utilisation généré");
    }, 800);
  };

  const handleDownload = () => {
    if (!report) return;
    if (exportFormat === "csv") {
      downloadCsv(report, `rapport-utilisation-${from}-${to}.csv`);
    } else {
      downloadJson(report, `rapport-utilisation-${from}-${to}.json`);
    }
    toast.success(`Rapport telecharge en ${exportFormat.toUpperCase()}`);
  };

  return (
    <div className="space-y-6">
      {/* Date range + generate */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Date de debut</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date de fin</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-44"
              />
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileBarChart className="h-4 w-4 mr-2" />
              )}
              Generer le rapport
            </Button>
            {report && (
              <div className="flex items-center gap-2 ml-auto">
                <Select
                  value={exportFormat}
                  onValueChange={(v) => setExportFormat(v as "pdf" | "csv")}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="pdf">JSON</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Telecharger
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report data */}
      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              icon={Users}
              label="Utilisateurs actifs"
              value={report.users.active}
              sub={`sur ${report.users.total} au total`}
              trend="up"
            />
            <StatCard
              icon={Users}
              label="Nouvelles inscriptions"
              value={report.users.new_registrations}
              sub={`sur ${report.period.days} jours`}
              trend="up"
            />
            <StatCard
              icon={FileText}
              label="Documents crees"
              value={report.documents.total_created.toLocaleString()}
              sub={`${report.documents.avg_per_user} par utilisateur en moyenne`}
              trend="up"
            />
            <StatCard
              icon={HardDrive}
              label="Stockage utilise"
              value={`${report.storage.used_gb} Go`}
              sub={`+${report.storage.growth_gb} Go sur la periode`}
              trend="down"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Documents by type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documents par type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.documents.by_type.map((item) => (
                    <div
                      key={item.type}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm font-medium">{item.type}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{
                              width: `${(item.count / report.documents.total_created) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-12 text-right">
                          {item.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top storage consumers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Top consommateurs de stockage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.storage.top_consumers.map((item, i) => (
                    <div
                      key={item.user}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">
                          {i + 1}.
                        </span>
                        <span className="text-sm font-medium truncate">
                          {item.user}
                        </span>
                      </div>
                      <Badge variant="secondary">{item.usage_gb} Go</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Resume des utilisateurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Moyenne quotidienne active
                  </p>
                  <p className="text-xl font-bold">
                    {report.users.daily_active_avg}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Pic de connexions simultanées
                  </p>
                  <p className="text-xl font-bold">
                    {report.users.peak_concurrent}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Inactifs (30j+)
                  </p>
                  <p className="text-xl font-bold">
                    {report.users.inactive_30d}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Documents modifies
                  </p>
                  <p className="text-xl font-bold">
                    {report.documents.total_modified.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Security Report Tab ────────────────────────────────────────────────────

function SecurityReportTab() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReturnType<
    typeof generateSecurityReport
  > | null>(null);
  const [exportFormat, setExportFormat] = useState<"pdf" | "csv">("csv");

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setReport(generateSecurityReport(from, to));
      setGenerating(false);
      toast.success("Rapport de sécurité généré");
    }, 1000);
  };

  const handleDownload = () => {
    if (!report) return;
    if (exportFormat === "csv") {
      downloadCsv(report, `rapport-securite-${from}-${to}.csv`);
    } else {
      downloadJson(report, `rapport-securite-${from}-${to}.json`);
    }
    toast.success(`Rapport telecharge en ${exportFormat.toUpperCase()}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Date de debut</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date de fin</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-44"
              />
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldAlert className="h-4 w-4 mr-2" />
              )}
              Generer le rapport
            </Button>
            {report && (
              <div className="flex items-center gap-2 ml-auto">
                <Select
                  value={exportFormat}
                  onValueChange={(v) => setExportFormat(v as "pdf" | "csv")}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="pdf">JSON</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Telecharger
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              icon={Lock}
              label="Connexions echouees"
              value={report.authentication.failed_logins}
              sub={`taux d'echec: ${report.authentication.failed_rate}%`}
              trend="down"
            />
            <StatCard
              icon={ShieldAlert}
              label="Comptes verrouilles"
              value={report.authentication.locked_accounts}
              sub="sur la periode"
            />
            <StatCard
              icon={Lock}
              label="Adoption MFA"
              value={`${report.authentication.mfa_adoption}%`}
              sub="des utilisateurs actifs"
              trend="up"
            />
            <StatCard
              icon={AlertTriangle}
              label="Vulnerabilites"
              value={
                report.vulnerabilities.critical + report.vulnerabilities.high
              }
              sub={`${report.vulnerabilities.patched_this_period} corrigees`}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Suspicious IPs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  IP suspectes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.authentication.suspicious_ips.map((ip) => (
                    <div
                      key={ip.ip}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-mono">{ip.ip}</p>
                        <p className="text-xs text-muted-foreground">
                          {ip.attempts} tentatives - {ip.country}
                        </p>
                      </div>
                      <Badge variant={ip.blocked ? "destructive" : "secondary"}>
                        {ip.blocked ? "Bloque" : "Surveille"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Permission changes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Changements de permissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.permissions.recent_changes.map((change, i) => (
                    <div key={i} className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium">{change.user}</p>
                        <p className="text-xs text-muted-foreground">
                          {change.action === "role_change" &&
                            `Role: ${change.from} -> ${change.to}`}
                          {change.action === "access_revoked" &&
                            `Acces revoque: ${change.resource}`}
                          {change.action === "admin_grant" &&
                            `Promotion admin: ${change.from} -> ${change.to}`}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        par {change.by}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vulnerability summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Vulnerabilites par severite
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-red-500/10">
                  <p className="text-2xl font-bold text-red-600">
                    {report.vulnerabilities.critical}
                  </p>
                  <p className="text-xs text-muted-foreground">Critique</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-orange-500/10">
                  <p className="text-2xl font-bold text-orange-600">
                    {report.vulnerabilities.high}
                  </p>
                  <p className="text-xs text-muted-foreground">Haute</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                  <p className="text-2xl font-bold text-yellow-600">
                    {report.vulnerabilities.medium}
                  </p>
                  <p className="text-xs text-muted-foreground">Moyenne</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-500/10">
                  <p className="text-2xl font-bold text-blue-600">
                    {report.vulnerabilities.low}
                  </p>
                  <p className="text-xs text-muted-foreground">Basse</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Performance Report Tab ─────────────────────────────────────────────────

function PerformanceReportTab() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReturnType<
    typeof generatePerformanceReport
  > | null>(null);
  const [exportFormat, setExportFormat] = useState<"pdf" | "csv">("csv");

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setReport(generatePerformanceReport(from, to));
      setGenerating(false);
      toast.success("Rapport de performance généré");
    }, 600);
  };

  const handleDownload = () => {
    if (!report) return;
    if (exportFormat === "csv") {
      downloadCsv(report, `rapport-performance-${from}-${to}.csv`);
    } else {
      downloadJson(report, `rapport-performance-${from}-${to}.json`);
    }
    toast.success(`Rapport telecharge en ${exportFormat.toUpperCase()}`);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Date de debut</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date de fin</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-44"
              />
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Generer le rapport
            </Button>
            {report && (
              <div className="flex items-center gap-2 ml-auto">
                <Select
                  value={exportFormat}
                  onValueChange={(v) => setExportFormat(v as "pdf" | "csv")}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="pdf">JSON</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Telecharger
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              icon={Activity}
              label="Requetes totales"
              value={report.api.total_requests.toLocaleString()}
              sub={`sur ${report.period.days} jours`}
              trend="up"
            />
            <StatCard
              icon={Clock}
              label="Temps de reponse moyen"
              value={`${report.api.avg_response_ms} ms`}
              sub={`P95: ${report.api.p95_response_ms} ms`}
              trend="up"
            />
            <StatCard
              icon={AlertTriangle}
              label="Taux d'erreur"
              value={`${report.errors.error_rate}%`}
              sub={`${report.errors.total_errors} erreurs`}
              trend="down"
            />
            <StatCard
              icon={CheckCircle2}
              label="Disponibilite"
              value={`${report.uptime.percentage}%`}
              sub={`${report.uptime.total_downtime_minutes} min d'arret`}
              trend="up"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Slowest endpoints */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Endpoints les plus lents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.api.slowest_endpoints.map((ep) => (
                    <div
                      key={ep.endpoint}
                      className="flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1 mr-3">
                        <p className="text-sm font-mono truncate">
                          {ep.endpoint}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ep.calls.toLocaleString()} appels
                        </p>
                      </div>
                      <Badge
                        variant={
                          ep.avg_ms > 1000
                            ? "destructive"
                            : ep.avg_ms > 200
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {ep.avg_ms} ms
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Error breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Repartition des erreurs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.errors.by_status.map((err) => (
                    <div
                      key={err.status}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            err.status >= 500 ? "destructive" : "secondary"
                          }
                          className="font-mono text-xs"
                        >
                          {err.status}
                        </Badge>
                        <span className="text-sm">{err.label}</span>
                      </div>
                      <span className="text-sm font-medium">
                        {err.count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resource usage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Utilisation des ressources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 grid-cols-2 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    CPU moyen
                  </p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold">
                      {report.resources.avg_cpu_percent}%
                    </span>
                    <span className="text-xs text-muted-foreground mb-1">
                      pic: {report.resources.peak_cpu_percent}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${report.resources.avg_cpu_percent}%` }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Memoire moyenne
                  </p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold">
                      {report.resources.avg_memory_percent}%
                    </span>
                    <span className="text-xs text-muted-foreground mb-1">
                      pic: {report.resources.peak_memory_percent}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{
                        width: `${report.resources.avg_memory_percent}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Connexions DB
                  </p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold">
                      {report.resources.avg_db_connections}
                    </span>
                    <span className="text-xs text-muted-foreground mb-1">
                      pic: {report.resources.peak_db_connections}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{
                        width: `${(report.resources.avg_db_connections / report.resources.peak_db_connections) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ReportsPage() {
  usePageTitle("Rapports");
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <PageHeader
          title="Rapports"
          description="Generez des rapports detailles sur l'utilisation, la securite et la performance de la plateforme."
          icon={<FileBarChart className="h-5 w-5 text-primary" />}
        />

        <Tabs defaultValue="usage" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="usage" className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Utilisation</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Securite</span>
            </TabsTrigger>
            <TabsTrigger
              value="performance"
              className="flex items-center gap-1.5"
            >
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usage">
            <UsageReportTab />
          </TabsContent>
          <TabsContent value="security">
            <SecurityReportTab />
          </TabsContent>
          <TabsContent value="performance">
            <PerformanceReportTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
