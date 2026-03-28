'use client';

import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTableSkeleton } from '@/components/ui/skeleton-loader';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  Play,
  Square,
  RotateCcw,
  MoreVertical,
  FileText,
  Trash2,
  RefreshCw,
  Terminal,
  Shield,
  ArrowUpCircle,
  ExternalLink,
  FileCode,
  Info,
} from 'lucide-react';
import { cn, getContainerUrl } from '@/lib/utils';
import { LogsDialog } from '@/components/containers/logs-dialog';
import { ContainerSheet } from '@/components/containers/container-sheet';
import { ContainerTerminal } from '@/components/containers/container-terminal';
import { ComposeImportSheet } from '@/components/containers/compose-import-sheet';
import { ContainerDetailsSheet } from '@/components/containers/container-details-sheet';
import { RouteDialog } from '@/components/routes/route-dialog';
import { useContainers, useContainerAction, Container } from '@/hooks/use-containers';
import { usePageContext } from '@/lib/store/page-context';
import { Globe } from 'lucide-react';

export default function ContainersPage() {
  const queryClient = useQueryClient();
  const { data: containers = [], isLoading, isError } = useContainers();

  useEffect(() => {
    if (isError) toast.error('Impossible de charger les conteneurs');
  }, [isError]);
  const containerAction = useContainerAction();
  const pageContext = usePageContext();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'user' | 'running' | 'stopped' | 'system'>('user');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [composeDialogOpen, setComposeDialogOpen] = useState(false);
  const [logsDialog, setLogsDialog] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: '',
    name: '',
  });
  const [terminalDialog, setTerminalDialog] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: '',
    name: '',
  });
  const [detailsSheet, setDetailsSheet] = useState<{
    open: boolean;
    id: string;
    name: string;
    dockerId?: string;
    isManaged: boolean;
  }>({
    open: false,
    id: '',
    name: '',
    isManaged: true,
  });
  const [routeDialog, setRouteDialog] = useState<{
    open: boolean;
    containerName: string;
    hostPort?: string;
  }>({
    open: false,
    containerName: '',
  });

  const handleAction = (container: Container, action: 'start' | 'stop' | 'restart' | 'remove' | 'update') => {
    containerAction.mutate({
      id: container.id,
      dockerId: container.docker_id,
      isManaged: container.is_managed,
      action
    });
  };

  // Extract unique categories from containers
  const categories = useMemo(() => {
    const catSet = new Set<string>();
    containers.forEach((c) => {
      if (c.category) catSet.add(c.category);
    });
    return Array.from(catSet).sort();
  }, [containers]);

  const filteredContainers = useMemo(() => {
    return containers.filter((c: Container) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.image.toLowerCase().includes(search.toLowerCase());
      let matchesFilter = true;
      if (filter === 'running') matchesFilter = c.state === 'running';
      else if (filter === 'stopped') matchesFilter = c.state === 'stopped' || c.state === 'exited';
      else if (filter === 'system') matchesFilter = c.is_system;
      else if (filter === 'user') matchesFilter = !c.is_system;
      const matchesCategory =
        activeCategory === 'all' || c.category === activeCategory;
      return matchesSearch && matchesFilter && matchesCategory;
    });
  }, [containers, search, filter, activeCategory]);

  // Group containers by category for display
  const groupedContainers = useMemo(() => {
    const groups = new Map<string, Container[]>();
    for (const c of filteredContainers) {
      const cat = c.category || 'Other';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(c);
    }
    return groups;
  }, [filteredContainers]);

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'running':
        return <Badge className="bg-green-500/10 text-green-600">Running</Badge>;
      case 'stopped':
      case 'exited':
        return <Badge variant="secondary">Stopped</Badge>;
      case 'restarting':
        return <Badge className="bg-yellow-500/10 text-yellow-600">Restarting</Badge>;
      case 'paused':
        return <Badge className="bg-orange-500/10 text-orange-600">Paused</Badge>;
      default:
        return <Badge variant="outline">{state}</Badge>;
    }
  };

  const setContext = pageContext.setContext;
  const proactiveMessage = pageContext.proactiveMessage;
  const setProactiveMessage = pageContext.setProactiveMessage;

  // Autopilot Context: If the AI detects a crashed/exited container in the user's filtered view,
  // it proactively offers to restart and fetch the IT ticket solution
  useEffect(() => {
    // We only trigger this if the page finishes loading
    if (!isLoading && containers.length > 0) {
      setContext('containers_dashboard');
      
      const crashedContainer = containers.find((c: Container) => c.state === 'exited' || c.state === 'stopped' || c.state === 'restarting');
      if (crashedContainer && !proactiveMessage) {
         // Proactive Trigger
         setProactiveMessage(
           `Container "${crashedContainer.name}" is stopped/crashed. Would you like me to analyze its logs and restart it?`,
           'warning'
         );
      }
    }
  }, [isLoading, containers, setContext, proactiveMessage, setProactiveMessage]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Containers</h1>
          </div>
          <DataTableSkeleton count={8} />
        </div>
      </AppLayout>
    );
  }

  if (isError && containers.length === 0) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Containers</h1>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['containers'] })}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Réessayer
            </Button>
          </div>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
                <RefreshCw className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold">Impossible de charger les conteneurs</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Le service de conteneurs est peut-être indisponible. Vérifiez votre connexion et réessayez.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Containers</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['containers'] })}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => setComposeDialogOpen(true)}>
              <FileCode className="mr-2 h-4 w-4" />
              Import Compose
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Container
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search containers..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'user', 'running', 'stopped', 'system'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Category filters */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory('all')}
            >
              All Categories
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={activeCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        )}

        {/* Container List — grouped by category */}
        <div className="space-y-6">
          {Array.from(groupedContainers.entries()).map(([category, items]) => (
            <div key={category} className="space-y-3">
              {groupedContainers.size > 1 && (
                <h2 className="text-lg font-semibold text-muted-foreground border-b pb-1">
                  {category}
                  <span className="ml-2 text-sm font-normal">({items.length})</span>
                </h2>
              )}
              <div className="space-y-4">
                {items.map((container) => (
                  <Card key={container.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            'h-3 w-3 rounded-full',
                            container.state === 'running'
                              ? 'bg-green-500'
                              : container.state === 'restarting'
                                ? 'bg-yellow-500'
                                : 'bg-gray-400'
                          )}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <button
                              className="font-semibold hover:underline cursor-pointer text-left"
                              onClick={() =>
                                setDetailsSheet({
                                  open: true,
                                  id: container.id,
                                  name: container.name,
                                  dockerId: container.docker_id,
                                  isManaged: container.is_managed,
                                })
                              }
                            >
                              {container.name}
                            </button>
                            {getStatusBadge(container.state)}
                            {container.category && (
                              <Badge variant="outline" className="text-xs">
                                {container.category}
                              </Badge>
                            )}
                            {container.is_system && (
                              <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
                                <Shield className="mr-1 h-3 w-3" />
                                System
                              </Badge>
                            )}
                            {!container.is_managed && !container.is_system && (
                              <Badge variant="outline">Unmanaged</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{container.image}</span>
                            <span>CPU {container.cpu ?? '-'}</span>
                            <span>RAM {container.memory ?? '-'}</span>
                            {(container.ports?.length ?? 0) > 0 && (
                              <span>Ports: {container.ports.join(', ')}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setDetailsSheet({
                              open: true,
                              id: container.id,
                              name: container.name,
                              dockerId: container.docker_id,
                              isManaged: container.is_managed,
                            })
                          }
                        >
                          <Info className="mr-1 h-4 w-4" />
                          Details
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogsDialog({ open: true, id: container.id, name: container.name })}
                        >
                          <FileText className="mr-1 h-4 w-4" />
                          Logs
                        </Button>

                        {container.state === 'running' && getContainerUrl(container.portMappings) && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a
                              href={getContainerUrl(container.portMappings)!}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="mr-1 h-4 w-4" />
                              Open
                            </a>
                          </Button>
                        )}

                        {container.state === 'running' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTerminalDialog({ open: true, id: container.id, name: container.name })}
                          >
                            <Terminal className="mr-1 h-4 w-4" />
                            Terminal
                          </Button>
                        )}

                        {!container.is_system && (
                          <>
                            {container.state === 'running' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAction(container, 'stop')}
                              >
                                <Square className="mr-1 h-4 w-4" />
                                Stop
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAction(container, 'start')}
                              >
                                <Play className="mr-1 h-4 w-4" />
                                Start
                              </Button>
                            )}
                          </>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleAction(container, 'restart')}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Restart
                            </DropdownMenuItem>
                            {container.is_managed && !container.is_system && (
                              <DropdownMenuItem
                                onClick={() => handleAction(container, 'update')}
                              >
                                <ArrowUpCircle className="mr-2 h-4 w-4" />
                                Update
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => {
                                const firstPort = container.ports[0]?.split(':')[0];
                                setRouteDialog({
                                  open: true,
                                  containerName: container.name,
                                  hostPort: firstPort,
                                });
                              }}
                            >
                              <Globe className="mr-2 h-4 w-4" />
                              Create Route
                            </DropdownMenuItem>
                            {!container.is_system && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleAction(container, 'remove')}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {filteredContainers.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No containers found
            </div>
          )}
        </div>

        {/* Logs Dialog */}
        <LogsDialog
          open={logsDialog.open}
          onOpenChange={(open) => setLogsDialog({ ...logsDialog, open })}
          containerId={logsDialog.id}
          containerName={logsDialog.name}
        />

        {/* Create Container Sheet */}
        <ContainerSheet
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['containers'] })}
        />

        {/* Import Compose Sheet */}
        <ComposeImportSheet
          open={composeDialogOpen}
          onOpenChange={setComposeDialogOpen}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['containers'] })}
        />

        {/* Terminal Dialog */}
        <ContainerTerminal
          open={terminalDialog.open}
          onOpenChange={(open) => setTerminalDialog({ ...terminalDialog, open })}
          containerId={terminalDialog.id}
          containerName={terminalDialog.name}
        />

        {/* Container Details Sheet */}
        <ContainerDetailsSheet
          open={detailsSheet.open}
          onOpenChange={(open) => setDetailsSheet({ ...detailsSheet, open })}
          containerId={detailsSheet.id}
          containerName={detailsSheet.name}
          dockerId={detailsSheet.dockerId}
          isManaged={detailsSheet.isManaged}
        />

        {/* Route Dialog */}
        <RouteDialog
          open={routeDialog.open}
          onOpenChange={(open) => setRouteDialog({ ...routeDialog, open })}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['routes'] })}
        />
      </div>
    </AppLayout>
  );
}
