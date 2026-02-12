'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
} from 'lucide-react';
import { cn, getContainerUrl } from '@/lib/utils';
import { LogsDialog } from '@/components/containers/logs-dialog';
import { ContainerDialog } from '@/components/containers/container-dialog';
import { ContainerTerminal } from '@/components/containers/container-terminal';
import { useContainers, useContainerAction, Container } from '@/hooks/use-containers';

export default function ContainersPage() {
  const queryClient = useQueryClient();
  const { data: containers = [], isLoading } = useContainers();
  const containerAction = useContainerAction();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'user' | 'running' | 'stopped' | 'system'>('user');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
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

  const handleAction = (id: string, action: 'start' | 'stop' | 'restart' | 'remove' | 'update') => {
    containerAction.mutate({ id, action });
  };

  const filteredContainers = containers.filter((c: Container) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.image.toLowerCase().includes(search.toLowerCase());
    let matchesFilter = true;
    if (filter === 'running') matchesFilter = c.state === 'running';
    else if (filter === 'stopped') matchesFilter = c.state === 'stopped' || c.state === 'exited';
    else if (filter === 'system') matchesFilter = c.is_system;
    else if (filter === 'user') matchesFilter = !c.is_system;
    return matchesSearch && matchesFilter;
  });

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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Containers</h1>
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
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

        {/* Container List */}
        <div className="space-y-4">
          {filteredContainers.map((container) => (
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
                      <span className="font-semibold">{container.name}</span>
                      {getStatusBadge(container.state)}
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
                      <span>CPU {container.cpu}</span>
                      <span>RAM {container.memory}</span>
                      {container.ports.length > 0 && (
                        <span>Ports: {container.ports.join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
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
                          onClick={() => handleAction(container.id, 'stop')}
                        >
                          <Square className="mr-1 h-4 w-4" />
                          Stop
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction(container.id, 'start')}
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
                        onClick={() => handleAction(container.id, 'restart')}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Restart
                      </DropdownMenuItem>
                      {container.is_managed && !container.is_system && (
                        <DropdownMenuItem
                          onClick={() => handleAction(container.id, 'update')}
                        >
                          <ArrowUpCircle className="mr-2 h-4 w-4" />
                          Update
                        </DropdownMenuItem>
                      )}
                      {!container.is_system && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleAction(container.id, 'remove')}
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

        {/* Create Container Dialog */}
        <ContainerDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['containers'] })}
        />

        {/* Terminal Dialog */}
        <ContainerTerminal
          open={terminalDialog.open}
          onOpenChange={(open) => setTerminalDialog({ ...terminalDialog, open })}
          containerId={terminalDialog.id}
          containerName={terminalDialog.name}
        />
      </div>
    </AppLayout>
  );
}
