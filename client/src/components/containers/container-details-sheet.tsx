"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, EyeOff, Copy, Globe, Plus } from "lucide-react";
import { useContainerDetails } from "@/hooks/use-container-details";
import { useRoutes } from "@/hooks/use-routes";
import { RouteDialog } from "@/components/routes/route-dialog";
import { Route } from "@/lib/api";
import { toast } from "sonner";

interface ContainerDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containerId: string;
  containerName: string;
  dockerId?: string;
  isManaged: boolean;
}

function formatBytes(bytes: number | undefined | null): string {
  if (!bytes || bytes <= 0) return "-";
  const mb = bytes / 1024 / 1024;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function formatNanoCpus(nano: number | undefined | null): string {
  if (!nano) return "-";
  return `${(nano / 1_000_000_000).toFixed(2)} cores`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copié dans le presse-papiers");
}

export function ContainerDetailsSheet({
  open,
  onOpenChange,
  containerId,
  containerName,
  dockerId,
  isManaged,
}: ContainerDetailsSheetProps) {
  const { data: details, isLoading } = useContainerDetails({
    containerId,
    dockerId,
    isManaged,
    enabled: open,
  });

  const [showEnvValues, setShowEnvValues] = useState(false);
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);

  // Fetch routes to show matching ones for this container
  const { data: allRoutes = [], refetch: refetchRoutes } = useRoutes();

  // Find routes whose target matches any port of this container
  const containerRoutes = allRoutes.filter((r: Route) => {
    if (!details?.ports) return false;
    return details.ports.some((p) => {
      if (!p.host_port) return false;
      return (
        r.target.includes(`:${p.host_port}`) ||
        r.target.includes(`localhost:${p.host_port}`) ||
        r.name.toLowerCase().includes(containerName.toLowerCase())
      );
    });
  });

  // Pre-fill route dialog with container info
  const firstHostPort = details?.ports?.find((p) => p.host_port)?.host_port;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-hidden flex flex-col"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {containerName}
            {details && (
              <Badge
                className={
                  details.state?.toLowerCase().includes("running")
                    ? "bg-green-500/10 text-green-600"
                    : "bg-gray-500/10 text-muted-foreground"
                }
              >
                {details.state}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {details?.image || "Chargement..."}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !details ? (
          <div className="p-4 text-muted-foreground">
            Failed to load container details
          </div>
        ) : (
          <Tabs defaultValue="overview" className="flex-1 overflow-hidden">
            <TabsList className="mx-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="ports">Ports</TabsTrigger>
              <TabsTrigger value="volumes">Volumes</TabsTrigger>
              <TabsTrigger value="env">Environment</TabsTrigger>
              <TabsTrigger value="labels">Labels</TabsTrigger>
              <TabsTrigger value="routes">Routes</TabsTrigger>
              {details.health && (
                <TabsTrigger value="health">Health</TabsTrigger>
              )}
            </TabsList>

            <ScrollArea className="flex-1 px-4 pb-4">
              {/* Overview */}
              <TabsContent value="overview">
                <div className="space-y-4">
                  <InfoSection title="General">
                    <InfoRow
                      label="Container ID"
                      value={details.id?.slice(0, 12)}
                      copyable={details.id}
                    />
                    <InfoRow label="Image" value={details.image} />
                    <InfoRow label="Created" value={details.created} />
                    <InfoRow label="Status" value={details.status} />
                    <InfoRow label="Hostname" value={details.hostname || "-"} />
                    <InfoRow label="User" value={details.user || "default"} />
                    <InfoRow
                      label="Working Dir"
                      value={details.working_dir || "-"}
                    />
                  </InfoSection>

                  <InfoSection title="Command">
                    {details.entrypoint && (
                      <InfoRow
                        label="Entrypoint"
                        value={details.entrypoint.join(" ")}
                        mono
                      />
                    )}
                    {details.cmd && (
                      <InfoRow label="Cmd" value={details.cmd.join(" ")} mono />
                    )}
                    {!details.entrypoint && !details.cmd && (
                      <p className="text-sm text-muted-foreground">
                        Default image command
                      </p>
                    )}
                  </InfoSection>

                  <InfoSection title="Restart Policy">
                    <InfoRow
                      label="Policy"
                      value={details.restart_policy || "no"}
                    />
                    {details.restart_count != null && (
                      <InfoRow
                        label="Restart Count"
                        value={String(details.restart_count)}
                      />
                    )}
                  </InfoSection>

                  <InfoSection title="Resources">
                    <InfoRow
                      label="Memory Limit"
                      value={formatBytes(details.resources?.memory_limit)}
                    />
                    <InfoRow
                      label="CPU"
                      value={formatNanoCpus(details.resources?.nano_cpus)}
                    />
                    {details.resources?.cpu_shares != null &&
                      details.resources.cpu_shares > 0 && (
                        <InfoRow
                          label="CPU Shares"
                          value={String(details.resources.cpu_shares)}
                        />
                      )}
                  </InfoSection>

                  {details.networks && details.networks.length > 0 && (
                    <InfoSection title="Networks">
                      <div className="flex flex-wrap gap-2">
                        {details.networks.map((n) => (
                          <Badge key={n} variant="outline">
                            {n}
                          </Badge>
                        ))}
                      </div>
                    </InfoSection>
                  )}
                </div>
              </TabsContent>

              {/* Ports */}
              <TabsContent value="ports">
                {details.ports.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No port mappings
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Host Port</TableHead>
                        <TableHead>Container Port</TableHead>
                        <TableHead>Protocol</TableHead>
                        <TableHead>Host IP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details.ports.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono">
                            {p.host_port ?? "-"}
                          </TableCell>
                          <TableCell className="font-mono">
                            {p.container_port}
                          </TableCell>
                          <TableCell>{p.protocol}</TableCell>
                          <TableCell>{p.host_ip || "0.0.0.0"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* Volumes */}
              <TabsContent value="volumes">
                {!details.mounts || details.mounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No volumes mounted
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Mode</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details.mounts.map((m, i) => (
                        <TableRow key={i}>
                          <TableCell
                            className="font-mono text-xs max-w-[200px] truncate"
                            title={m.source || "-"}
                          >
                            {m.source || "-"}
                          </TableCell>
                          <TableCell
                            className="font-mono text-xs max-w-[200px] truncate"
                            title={m.destination}
                          >
                            {m.destination}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{m.mount_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={m.rw ? "default" : "secondary"}>
                              {m.rw ? "RW" : "RO"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* Environment */}
              <TabsContent value="env">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {details.env?.length ?? 0} variables
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowEnvValues(!showEnvValues)}
                    >
                      {showEnvValues ? (
                        <>
                          <EyeOff className="mr-1 h-4 w-4" />
                          Hide Values
                        </>
                      ) : (
                        <>
                          <Eye className="mr-1 h-4 w-4" />
                          Show Values
                        </>
                      )}
                    </Button>
                  </div>
                  {!details.env || details.env.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      No environment variables
                    </p>
                  ) : (
                    <div className="space-y-1 font-mono text-xs">
                      {details.env.map((envVar, i) => {
                        const eqIdx = envVar.indexOf("=");
                        const key =
                          eqIdx >= 0 ? envVar.slice(0, eqIdx) : envVar;
                        const value = eqIdx >= 0 ? envVar.slice(eqIdx + 1) : "";
                        const isSensitive = /password|secret|key|token/i.test(
                          key,
                        );
                        return (
                          <div
                            key={i}
                            className="flex items-start gap-2 py-1 px-2 rounded hover:bg-muted group"
                          >
                            <span className="text-blue-500 font-semibold shrink-0">
                              {key}
                            </span>
                            <span className="text-muted-foreground">=</span>
                            <span className="break-all flex-1">
                              {showEnvValues || !isSensitive
                                ? value
                                : "********"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
                              onClick={() => copyToClipboard(envVar)}
                              aria-label="Copier"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Labels */}
              <TabsContent value="labels">
                {!details.labels || Object.keys(details.labels).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No labels
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead>Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(details.labels)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell
                              className="font-mono text-xs max-w-[250px] truncate"
                              title={key}
                            >
                              {key}
                            </TableCell>
                            <TableCell
                              className="font-mono text-xs max-w-[250px] truncate"
                              title={value}
                            >
                              {value}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* Routes */}
              <TabsContent value="routes">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {containerRoutes.length} route(s) linked
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRouteDialogOpen(true)}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Create Route
                    </Button>
                  </div>
                  {containerRoutes.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                      <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        No routes configured for this container
                      </p>
                      <p className="text-xs mt-1">
                        Create a route to expose this container to the web
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {containerRoutes.map((route) => (
                        <div
                          key={route.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 text-blue-500" />
                              <span className="font-medium text-sm">
                                {route.name}
                              </span>
                              <Badge
                                className={
                                  route.enabled
                                    ? "bg-green-500/10 text-green-600"
                                    : "bg-gray-500/10 text-muted-foreground"
                                }
                              >
                                {route.enabled ? "Active" : "Disabled"}
                              </Badge>
                              {route.tls_enabled && (
                                <Badge variant="outline" className="text-xs">
                                  HTTPS
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono">
                              {route.host} → {route.target}
                            </p>
                          </div>
                          <Badge variant="outline">{route.mode}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <RouteDialog
                  open={routeDialogOpen}
                  onOpenChange={setRouteDialogOpen}
                  route={null}
                  onSuccess={() => refetchRoutes()}
                />
              </TabsContent>

              {/* Health */}
              {details.health && (
                <TabsContent value="health">
                  <div className="space-y-4">
                    <InfoSection title="Health Check">
                      <InfoRow label="Status">
                        <HealthBadge status={details.health.status} />
                      </InfoRow>
                      <InfoRow
                        label="Failing Streak"
                        value={String(details.health.failing_streak)}
                      />
                      {details.health.test && (
                        <InfoRow
                          label="Test Command"
                          value={details.health.test.join(" ")}
                          mono
                        />
                      )}
                    </InfoSection>
                  </div>
                </TabsContent>
              )}
            </ScrollArea>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      <div className="rounded-lg border p-3 space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  copyable,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  copyable?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      {children ? (
        children
      ) : (
        <div className="flex items-center gap-1">
          <span
            className={`text-sm text-right truncate max-w-[300px] ${mono ? "font-mono text-xs" : ""}`}
            title={value}
          >
            {value}
          </span>
          {copyable && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0"
              onClick={() => copyToClipboard(copyable)}
              aria-label="Copier"
            >
              <Copy className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function HealthBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  if (lower.includes("healthy")) {
    return <Badge className="bg-green-500/10 text-green-600">Healthy</Badge>;
  }
  if (lower.includes("unhealthy")) {
    return <Badge className="bg-red-500/10 text-red-600">Unhealthy</Badge>;
  }
  if (lower.includes("starting")) {
    return <Badge className="bg-yellow-500/10 text-yellow-600">Starting</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}
