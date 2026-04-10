"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Cloud,
  Server,
  Database,
  HardDrive,
  RefreshCw,
  Settings,
  AlertCircle,
  CheckCircle,
  XCircle,
  Inbox,
} from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  itAssetsApi,
  type CloudResource,
  type CloudCredentialStatus,
  type SaveCloudCredentialRequest,
} from "@/lib/api/it-assets";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = "azure" | "aws" | "gcp";

interface CloudCredentials {
  azure?: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    subscriptionId: string;
  };
  aws?: { accessKeyId: string; secretAccessKey: string; region: string };
  gcp?: { projectId: string; serviceAccountJson: string };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CloudResource["status"] }) {
  const map: Record<
    CloudResource["status"],
    {
      label: string;
      icon: React.ReactNode;
      variant: "default" | "secondary" | "destructive" | "outline";
    }
  > = {
    running: {
      label: "Running",
      icon: <CheckCircle className="h-3 w-3" />,
      variant: "default",
    },
    stopped: {
      label: "Stopped",
      icon: <XCircle className="h-3 w-3" />,
      variant: "secondary",
    },
    error: {
      label: "Error",
      icon: <AlertCircle className="h-3 w-3" />,
      variant: "destructive",
    },
    unknown: {
      label: "Unknown",
      icon: <AlertCircle className="h-3 w-3" />,
      variant: "outline",
    },
  };
  const { label, icon, variant } = map[status];
  return (
    <Badge variant={variant} className="gap-1">
      {icon}
      {label}
    </Badge>
  );
}

function ResourceTypeIcon({ type }: { type: CloudResource["type"] }) {
  const icons: Record<CloudResource["type"], React.ReactNode> = {
    vm: <Server className="h-4 w-4 text-blue-500" />,
    storage: <HardDrive className="h-4 w-4 text-orange-500" />,
    db: <Database className="h-4 w-4 text-purple-500" />,
    network: <Cloud className="h-4 w-4 text-cyan-500" />,
    other: <Settings className="h-4 w-4 text-muted-foreground" />,
  };
  return <>{icons[type]}</>;
}

// ── Skeleton loaders ──

function TableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Skeleton className="h-4 w-24" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-16" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-16" />
          </TableHead>
          <TableHead>
            <Skeleton className="h-4 w-20" />
          </TableHead>
          <TableHead className="text-right">
            <Skeleton className="h-4 w-24 ml-auto" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 4 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <Skeleton className="h-4 w-28" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-6 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell className="text-right">
              <Skeleton className="h-4 w-16 ml-auto" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Error state ──

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertCircle className="w-10 h-10 text-destructive mb-3" />
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="w-3.5 h-3.5 mr-2" />
        Retry
      </Button>
    </div>
  );
}

// ── Empty state ──

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="w-10 h-10 text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground">
        No resources found. Configure credentials above and sync.
      </p>
    </div>
  );
}

// ── Resource table with real data ──

function ResourceTable({ provider }: { provider: Provider }) {
  const {
    data: resourcesResp,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["cloud", "resources", provider],
    queryFn: () => itAssetsApi.listCloudResources(provider),
  });

  const resources: CloudResource[] = resourcesResp?.data ?? [];

  const syncMutation = useMutation({
    mutationFn: () => itAssetsApi.syncCloudResources(provider),
    onSuccess: () => {
      refetch();
      toast.success(`${provider.toUpperCase()} resources synced`);
    },
    onError: () => {
      toast.error(`Failed to sync ${provider.toUpperCase()} resources`);
    },
  });

  const total = resources.reduce((acc, r) => acc + (r.cost_estimate ?? 0), 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Resources</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || isLoading}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${syncMutation.isPending ? "animate-spin" : ""}`}
            />
            {resources.length === 0 ? "Sync resources" : "Refresh"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <ErrorState
            message={`Failed to load ${provider.toUpperCase()} resources.`}
            onRetry={() => refetch()}
          />
        ) : resources.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead className="text-right">
                    Est. monthly cost
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 capitalize">
                        <ResourceTypeIcon type={r.type} />
                        {r.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.region}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {r.cost_estimate != null
                        ? `$${r.cost_estimate.toFixed(2)}`
                        : "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end px-4 py-2 border-t text-sm font-semibold">
              Total: ${total.toFixed(2)} / mo
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Azure Credentials Panel ──────────────────────────────────────────────────

function AzureCredPanel({
  configured,
  onSave,
}: {
  configured: boolean;
  onSave: (creds: Record<string, string>) => void;
}) {
  const [form, setForm] = useState({
    tenantId: "",
    clientId: "",
    clientSecret: "",
    subscriptionId: "",
  });
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Azure Credentials
          {configured && (
            <Badge variant="default" className="ml-auto text-xs">
              Configured
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Tenant ID</Label>
            <Input
              className="mt-1"
              value={form.tenantId}
              onChange={(e) =>
                setForm((f) => ({ ...f, tenantId: e.target.value }))
              }
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>
          <div>
            <Label className="text-xs">Subscription ID</Label>
            <Input
              className="mt-1"
              value={form.subscriptionId}
              onChange={(e) =>
                setForm((f) => ({ ...f, subscriptionId: e.target.value }))
              }
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>
          <div>
            <Label className="text-xs">Client ID</Label>
            <Input
              className="mt-1"
              value={form.clientId}
              onChange={(e) =>
                setForm((f) => ({ ...f, clientId: e.target.value }))
              }
              placeholder="App (client) ID"
            />
          </div>
          <div>
            <Label className="text-xs">Client Secret</Label>
            <Input
              className="mt-1"
              type="password"
              value={form.clientSecret}
              onChange={(e) =>
                setForm((f) => ({ ...f, clientSecret: e.target.value }))
              }
              placeholder="Secret value"
            />
          </div>
        </div>
        <Button
          size="sm"
          className="mt-3"
          onClick={() =>
            onSave({
              tenant_id: form.tenantId,
              client_id: form.clientId,
              client_secret: form.clientSecret,
              subscription_id: form.subscriptionId,
            })
          }
        >
          Save credentials
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── AWS Credentials Panel ────────────────────────────────────────────────────

function AwsCredPanel({
  configured,
  onSave,
}: {
  configured: boolean;
  onSave: (creds: Record<string, string>) => void;
}) {
  const [form, setForm] = useState({
    accessKeyId: "",
    secretAccessKey: "",
    region: "us-east-1",
  });
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings className="h-4 w-4" />
          AWS Credentials
          {configured && (
            <Badge variant="default" className="ml-auto text-xs">
              Configured
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Access Key ID</Label>
            <Input
              className="mt-1"
              value={form.accessKeyId}
              onChange={(e) =>
                setForm((f) => ({ ...f, accessKeyId: e.target.value }))
              }
              placeholder="AKIA..."
            />
          </div>
          <div>
            <Label className="text-xs">Secret Access Key</Label>
            <Input
              className="mt-1"
              type="password"
              value={form.secretAccessKey}
              onChange={(e) =>
                setForm((f) => ({ ...f, secretAccessKey: e.target.value }))
              }
              placeholder="Secret..."
            />
          </div>
          <div>
            <Label className="text-xs">Default Region</Label>
            <Input
              className="mt-1"
              value={form.region}
              onChange={(e) =>
                setForm((f) => ({ ...f, region: e.target.value }))
              }
              placeholder="us-east-1"
            />
          </div>
        </div>
        <Button
          size="sm"
          className="mt-3"
          onClick={() =>
            onSave({
              access_key_id: form.accessKeyId,
              secret_access_key: form.secretAccessKey,
              region: form.region,
            })
          }
        >
          Save credentials
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── GCP Credentials Panel ────────────────────────────────────────────────────

function GcpCredPanel({
  configured,
  onSave,
}: {
  configured: boolean;
  onSave: (creds: Record<string, string>) => void;
}) {
  const [form, setForm] = useState({ projectId: "", serviceAccountJson: "" });
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings className="h-4 w-4" />
          GCP Credentials
          {configured && (
            <Badge variant="default" className="ml-auto text-xs">
              Configured
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <div>
            <Label className="text-xs">Project ID</Label>
            <Input
              className="mt-1"
              value={form.projectId}
              onChange={(e) =>
                setForm((f) => ({ ...f, projectId: e.target.value }))
              }
              placeholder="my-project-123"
            />
          </div>
          <div>
            <Label className="text-xs">Service Account JSON</Label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono min-h-24 resize-y"
              value={form.serviceAccountJson}
              onChange={(e) =>
                setForm((f) => ({ ...f, serviceAccountJson: e.target.value }))
              }
              placeholder='{"type":"service_account","project_id":"..."}'
            />
          </div>
        </div>
        <Button
          size="sm"
          className="mt-3"
          onClick={() =>
            onSave({
              project_id: form.projectId,
              service_account_json: form.serviceAccountJson,
            })
          }
        >
          Save credentials
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CloudMonitoringPage() {
  usePageTitle("Cloud Monitoring");
  const queryClient = useQueryClient();

  const { data: credStatusResp } = useQuery({
    queryKey: ["cloud", "credentials"],
    queryFn: () => itAssetsApi.getCloudCredentials(),
  });

  const credStatuses: CloudCredentialStatus[] = credStatusResp?.data ?? [];

  function isConfigured(provider: Provider): boolean {
    return credStatuses.some((c) => c.provider === provider && c.configured);
  }

  const saveCredMutation = useMutation({
    mutationFn: (data: SaveCloudCredentialRequest) =>
      itAssetsApi.saveCloudCredentials(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cloud", "credentials"] });
      queryClient.invalidateQueries({
        queryKey: ["cloud", "resources", variables.provider],
      });
      toast.success(`${variables.provider.toUpperCase()} credentials saved`);
    },
    onError: () => {
      toast.error("Failed to save credentials");
    },
  });

  function saveCred(provider: Provider, credentials: Record<string, string>) {
    saveCredMutation.mutate({ provider, credentials });
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cloud className="h-6 w-6 text-primary" />
            Cloud Monitoring
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor resources across Azure, AWS and GCP from a single pane
          </p>
        </div>

        <Tabs defaultValue="azure">
          <TabsList>
            <TabsTrigger value="azure">Azure</TabsTrigger>
            <TabsTrigger value="aws">AWS</TabsTrigger>
            <TabsTrigger value="gcp">GCP</TabsTrigger>
          </TabsList>

          {/* Azure */}
          <TabsContent value="azure" className="space-y-4 mt-4">
            <AzureCredPanel
              configured={isConfigured("azure")}
              onSave={(creds) => saveCred("azure", creds)}
            />
            <ResourceTable provider="azure" />
          </TabsContent>

          {/* AWS */}
          <TabsContent value="aws" className="space-y-4 mt-4">
            <AwsCredPanel
              configured={isConfigured("aws")}
              onSave={(creds) => saveCred("aws", creds)}
            />
            <ResourceTable provider="aws" />
          </TabsContent>

          {/* GCP */}
          <TabsContent value="gcp" className="space-y-4 mt-4">
            <GcpCredPanel
              configured={isConfigured("gcp")}
              onSave={(creds) => saveCred("gcp", creds)}
            />
            <ResourceTable provider="gcp" />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
